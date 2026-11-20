// Head lecturer (admin) side of live tests, and lecturer accounts.
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Test = require("../models/Test");
const Exam = require("../models/Exam");
const Subject = require("../models/Subject");
const User = require("../models/User");
const Question = require("../models/Question");
const TestAttempt = require("../models/TestAttempt");
const { sectionsFor, patternFor, canSplitBiology, subjectKey } = require("../utils/livePattern");

const isValidId = (id) => mongoose.isValidObjectId(id);
const userError = (message, status = 400) => Object.assign(new Error(message), { status });
const handle = (where, fn) => async (req, res) => {
    try {
        await fn(req, res);
    } catch (error) {
        if (error.status) return res.status(error.status).json({ message: error.message });
        if (error.name === "ValidationError") return res.status(400).json({ message: Object.values(error.errors)[0]?.message || error.message });
        console.error(`${where} error:`, error);
        res.status(500).json({ message: "Something went wrong on the server" });
    }
};

const toDate = (v, label) => {
    const d = new Date(v);
    if (!v || Number.isNaN(d.getTime())) throw userError(`${label} is not a valid date and time`);
    return d;
};
const clampInt = (v, min, max, fallback) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

// What each part of a live test looks like in lists
const sectionSummary = (s, lecturersById) => {
    const lecturer = s.lecturerId ? lecturersById.get(String(s.lecturerId)) : null;
    return {
        key: s.key,
        name: s.name,
        subjectId: s.subjectId,
        lecturer: lecturer ? { _id: lecturer._id, name: lecturer.name, email: lecturer.email } : null,
        mcqCount: s.mcqCount || 0,
        numericalCount: s.numericalCount || 0,
        picked: (s.questionIds || []).length,
        dueAt: s.dueAt || null,
        submittedAt: s.submittedAt || null,
    };
};

const lecturerMap = async (tests) => {
    const ids = [...new Set(tests.flatMap((t) => t.sections.map((s) => String(s.lecturerId || ""))).filter(Boolean))];
    const users = ids.length ? await User.find({ _id: { $in: ids } }).select("name email").lean() : [];
    return new Map(users.map((u) => [String(u._id), u]));
};

const phase = (test, now = new Date()) => {
    if (test.status === "draft") return "draft";
    if (test.status === "archived") return "archived";
    if (now < new Date(test.availability.startsAt)) return "scheduled";
    if (now <= new Date(test.availability.endsAt)) return "open";
    return "closed";
};

// ---------- Lecturer accounts ----------

// GET /api/admin/lecturers   (lecturers, plus admins, who can also pick questions)
const listLecturers = handle("listLecturers", async (req, res) => {
    const users = await User.find({ role: { $in: ["lecturer", "admin"] } })
        .sort({ role: -1, name: 1 })
        .select("name email role status lastLoginAt createdAt")
        .lean();
    const counts = await Test.aggregate([
        { $match: { type: "live", status: { $ne: "archived" } } },
        { $unwind: "$sections" },
        { $group: { _id: "$sections.lecturerId", sections: { $sum: 1 } } },
    ]);
    const byId = new Map(counts.map((c) => [String(c._id), c.sections]));
    res.json({ lecturers: users.map((u) => ({ ...u, sections: byId.get(String(u._id)) || 0 })) });
});

// POST /api/admin/lecturers   { name, email, password }
const createLecturer = handle("createLecturer", async (req, res) => {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    if (name.length < 2) throw userError("Enter the lecturer's name");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw userError("Enter a valid email address");
    if (password.length < 8) throw userError("The password needs at least 8 characters");

    const existing = await User.findOne({ email }).select("role").lean();
    if (existing) {
        throw userError(
            existing.role === "student"
                ? "This email belongs to a student account. Use a different email for the lecturer."
                : "An account with this email already exists"
        );
    }
    const user = await User.create({
        name,
        email,
        passwordHash: await bcrypt.hash(password, 10),
        role: "lecturer",
        isEmailVerified: true,
    });
    res.status(201).json({ lecturer: { _id: user._id, name: user.name, email: user.email, role: user.role, status: user.status, sections: 0 } });
});

// PUT /api/admin/lecturers/:id   { status?: "active"|"suspended", password?: "new password" }
const updateLecturer = handle("updateLecturer", async (req, res) => {
    if (!isValidId(req.params.id)) throw userError("Invalid lecturer id");
    const update = {};
    if (req.body.status !== undefined) {
        if (!["active", "suspended"].includes(req.body.status)) throw userError("Status must be active or suspended");
        update.status = req.body.status;
    }
    if (req.body.password !== undefined) {
        if (String(req.body.password).length < 8) throw userError("The password needs at least 8 characters");
        update.passwordHash = await bcrypt.hash(String(req.body.password), 10);
    }
    if (!Object.keys(update).length) throw userError("Nothing to change");
    const user = await User.findOneAndUpdate({ _id: req.params.id, role: "lecturer" }, update, { returnDocument: "after" }).select("name email role status");
    if (!user) throw userError("Lecturer not found", 404);
    res.json({ lecturer: user });
});

// ---------- Live tests ----------

// GET /api/admin/live-tests/pattern?examId=...   default sections and time for the create form
const getPattern = handle("getPattern", async (req, res) => {
    if (!isValidId(req.query.examId)) throw userError("Choose an exam");
    const exam = await Exam.findById(req.query.examId).select("code name markingScheme").lean();
    if (!exam) throw userError("Exam not found", 404);
    const pattern = patternFor(exam.code);
    if (!pattern) throw userError(`Live tests are not set up for ${exam.code}`);
    res.json({
        exam,
        minutes: pattern.minutes,
        canSplitBiology: canSplitBiology(exam.code),
        sections: sectionsFor(exam.code, false),
        splitSections: canSplitBiology(exam.code) ? sectionsFor(exam.code, true) : null,
    });
});

// Builds and checks the parts of a live test from the form
const buildDetails = async (body, exam, existing) => {
    const title = String(body.title || "").trim();
    if (title.length < 3) throw userError("Give the test a name");
    if (title.length > 140) throw userError("The name is too long");

    const startsAt = toDate(body.startsAt, "Opening time");
    const endsAt = toDate(body.endsAt, "Closing time");
    if (endsAt <= startsAt) throw userError("The closing time must be after the opening time");
    if (endsAt - startsAt > 31 * 24 * 3600 * 1000) throw userError("A live test can be open for at most 31 days");
    const durationMinutes = clampInt(body.durationMinutes, 5, 360, null);
    if (!durationMinutes) throw userError("Enter the test duration in minutes (5 to 360)");

    const splitBiology = Boolean(body.splitBiology) && canSplitBiology(exam.code);
    const offered = sectionsFor(exam.code, splitBiology);
    const wanted = Array.isArray(body.sections) ? body.sections : [];
    if (!wanted.length) throw userError("Add at least one section");

    const subjects = await Subject.find({ examId: exam._id }).select("name").lean();
    const lecturerIds = [...new Set(wanted.map((s) => String(s.lecturerId || "")).filter(isValidId))];
    const lecturers = lecturerIds.length
        ? await User.find({ _id: { $in: lecturerIds }, role: { $in: ["lecturer", "admin"] }, status: "active" }).select("_id").lean()
        : [];
    const okLecturers = new Set(lecturers.map((l) => String(l._id)));
    const oldByKey = new Map((existing?.sections || []).map((s) => [s.key, s]));

    const sections = [];
    for (const w of wanted) {
        const def = offered.find((o) => o.key === w.key);
        if (!def) throw userError(`"${w.key}" is not a section of ${exam.code}${splitBiology ? " (with Biology split)" : ""}`);
        if (sections.some((s) => s.key === def.key)) throw userError(`${def.name} is listed twice`);
        const subject = subjects.find((s) => subjectKey(s.name) === def.subjectKey);
        if (!subject) throw userError(`${exam.code} has no ${def.name} subject in the syllabus yet`);
        if (!isValidId(w.lecturerId) || !okLecturers.has(String(w.lecturerId))) throw userError(`Choose an active lecturer for ${def.name}`);
        const mcqCount = clampInt(w.mcqCount, 0, 200, def.mcqCount);
        const numericalCount = clampInt(w.numericalCount, 0, 50, def.numericalCount);
        if (mcqCount + numericalCount < 1) throw userError(`${def.name} needs at least one question`);
        const old = oldByKey.get(def.key);
        // Changing the lecturer or the counts re-opens the section for picking
        const same = old && String(old.lecturerId) === String(w.lecturerId) && old.mcqCount === mcqCount && old.numericalCount === numericalCount;
        sections.push({
            key: def.key,
            name: def.name,
            subjectId: subject._id,
            lecturerId: w.lecturerId,
            mcqCount,
            numericalCount,
            dueAt: w.dueAt ? toDate(w.dueAt, `${def.name} due time`) : undefined,
            questionIds: old && String(old.subjectId) === String(subject._id) ? old.questionIds : [],
            submittedAt: same ? old.submittedAt : undefined,
        });
    }

    return {
        title,
        examId: exam._id,
        type: "live",
        instructions: String(body.instructions || "").trim().slice(0, 4000),
        durationMinutes,
        availability: { startsAt, endsAt },
        maxAttempts: 1,
        sections,
        live: {
            splitBiology,
            showResults: body.showResults === "after_submit" ? "after_submit" : "after_close",
            shuffle: body.shuffle !== false,
            publishedAt: existing?.live?.publishedAt,
        },
    };
};

// GET /api/admin/live-tests?examId=...
const listLiveTests = handle("listLiveTests", async (req, res) => {
    const filter = { type: "live", status: { $ne: "archived" } };
    if (isValidId(req.query.examId)) filter.examId = req.query.examId;
    const tests = await Test.find(filter).sort({ "availability.startsAt": -1 }).limit(200).lean();
    const [lecturers, exams, counts] = await Promise.all([
        lecturerMap(tests),
        Exam.find({ _id: { $in: tests.map((t) => t.examId) } }).select("code").lean(),
        TestAttempt.aggregate([
            { $match: { testId: { $in: tests.map((t) => t._id) } } },
            { $group: { _id: "$testId", started: { $sum: 1 }, finished: { $sum: { $cond: [{ $in: ["$status", ["submitted", "auto_submitted"]] }, 1, 0] } } } },
        ]),
    ]);
    const examCode = new Map(exams.map((e) => [String(e._id), e.code]));
    const byTest = new Map(counts.map((c) => [String(c._id), c]));
    res.json({
        tests: tests.map((t) => ({
            _id: t._id,
            title: t.title,
            exam: examCode.get(String(t.examId)) || "",
            examId: t.examId,
            status: t.status,
            phase: phase(t),
            startsAt: t.availability.startsAt,
            endsAt: t.availability.endsAt,
            durationMinutes: t.durationMinutes,
            totalQuestions: t.sections.reduce((a, s) => a + (s.mcqCount || 0) + (s.numericalCount || 0), 0),
            sections: t.sections.map((s) => sectionSummary(s, lecturers)),
            started: byTest.get(String(t._id))?.started || 0,
            finished: byTest.get(String(t._id))?.finished || 0,
        })),
    });
});

// GET /api/admin/live-tests/:id   (with every picked question, for review)
const getLiveTest = handle("getLiveTest", async (req, res) => {
    if (!isValidId(req.params.id)) throw userError("Invalid test id");
    const test = await Test.findOne({ _id: req.params.id, type: "live" }).lean();
    if (!test) throw userError("Live test not found", 404);
    const [lecturers, exam] = await Promise.all([lecturerMap([test]), Exam.findById(test.examId).select("code name markingScheme").lean()]);

    const ids = test.sections.flatMap((s) => s.questionIds);
    const questions = await Question.find({ _id: { $in: ids } })
        .select("type text difficulty chapterId topicId images options")
        .populate("chapterId", "name classLevel")
        .populate("topicId", "name")
        .lean();
    const byId = new Map(questions.map((q) => [String(q._id), q]));
    const hasDiagram = (q) => /\{\{IMG::/.test(q.text || "") || (q.images || []).length > 0 || (q.options || []).some((o) => /\{\{IMG::/.test(o.text || "") || o.image?.url);

    res.json({
        test: {
            _id: test._id,
            title: test.title,
            examId: test.examId,
            exam,
            status: test.status,
            phase: phase(test),
            instructions: test.instructions,
            durationMinutes: test.durationMinutes,
            startsAt: test.availability.startsAt,
            endsAt: test.availability.endsAt,
            live: test.live,
            sections: test.sections.map((s) => ({
                ...sectionSummary(s, lecturers),
                questions: s.questionIds
                    .map((id) => byId.get(String(id)))
                    .filter(Boolean)
                    .map((q) => ({
                        _id: q._id,
                        type: q.type,
                        text: q.text,
                        difficulty: q.difficulty,
                        chapter: q.chapterId?.name || "",
                        classLevel: q.chapterId?.classLevel || "",
                        topic: q.topicId?.name || "",
                        diagram: hasDiagram(q),
                    })),
            })),
        },
    });
});

// POST /api/admin/live-tests
const createLiveTest = handle("createLiveTest", async (req, res) => {
    if (!isValidId(req.body.examId)) throw userError("Choose an exam");
    const exam = await Exam.findById(req.body.examId).lean();
    if (!exam) throw userError("Exam not found", 404);
    const details = await buildDetails(req.body, exam, null);
    const test = await Test.create({
        ...details,
        status: "draft",
        markingScheme: {
            correct: exam.markingScheme?.correct ?? 4,
            incorrect: exam.markingScheme?.incorrect ?? -1,
            unanswered: exam.markingScheme?.unanswered ?? 0,
        },
        createdBy: req.user._id,
    });
    res.status(201).json({ testId: test._id });
});

// PUT /api/admin/live-tests/:id   (everything while a draft; only name, instructions and closing time once published)
const updateLiveTest = handle("updateLiveTest", async (req, res) => {
    if (!isValidId(req.params.id)) throw userError("Invalid test id");
    const test = await Test.findOne({ _id: req.params.id, type: "live" });
    if (!test) throw userError("Live test not found", 404);
    if (test.status === "archived") throw userError("This test was deleted");

    if (test.status === "draft") {
        const exam = await Exam.findById(test.examId).lean();
        const details = await buildDetails({ ...req.body, examId: test.examId }, exam, test.toObject());
        Object.assign(test, details);
    } else {
        // Published: students may already be writing it
        if (req.body.title !== undefined) {
            const title = String(req.body.title).trim();
            if (title.length < 3) throw userError("Give the test a name");
            test.title = title.slice(0, 140);
        }
        if (req.body.instructions !== undefined) test.instructions = String(req.body.instructions).trim().slice(0, 4000);
        if (req.body.endsAt !== undefined) {
            const endsAt = toDate(req.body.endsAt, "Closing time");
            if (endsAt < test.availability.endsAt) throw userError("Once published, the closing time can only be moved later");
            test.availability.endsAt = endsAt;
        }
    }
    await test.save();
    res.json({ message: "Saved" });
});

// POST /api/admin/live-tests/:id/publish
const publishLiveTest = handle("publishLiveTest", async (req, res) => {
    if (!isValidId(req.params.id)) throw userError("Invalid test id");
    const test = await Test.findOne({ _id: req.params.id, type: "live" });
    if (!test) throw userError("Live test not found", 404);
    if (test.status !== "draft") throw userError("Only a draft can be published");
    if (test.availability.endsAt <= new Date()) throw userError("The closing time has already passed. Change it first.");

    const problems = [];
    let totalMarks = 0;
    const allIds = test.sections.flatMap((s) => s.questionIds.map(String));
    if (new Set(allIds).size !== allIds.length) problems.push("the same question is in two sections");
    const questions = await Question.find({ _id: { $in: allIds } }).select("type status marks").lean();
    const byId = new Map(questions.map((q) => [String(q._id), q]));
    for (const s of test.sections) {
        const qs = s.questionIds.map((id) => byId.get(String(id)));
        const mcq = qs.filter((q) => q && q.type !== "numerical").length;
        const num = qs.filter((q) => q && q.type === "numerical").length;
        if (qs.some((q) => !q || q.status !== "published")) problems.push(`${s.name} has a question that was deleted or unpublished`);
        if (!s.submittedAt) problems.push(`${s.name} is not handed in yet`);
        if (mcq !== s.mcqCount || num !== s.numericalCount) problems.push(`${s.name} has ${mcq} MCQ + ${num} numerical, needs ${s.mcqCount} + ${s.numericalCount}`);
        for (const q of qs) if (q) totalMarks += q.marks?.correct ?? test.markingScheme.correct;
    }
    if (problems.length) throw userError(`Can't publish yet: ${problems.join("; ")}`);

    test.status = "published";
    test.totalQuestions = allIds.length;
    test.totalMarks = totalMarks;
    test.live.publishedAt = new Date();
    await test.save();
    res.json({ message: "Published", status: test.status });
});

// POST /api/admin/live-tests/:id/unpublish   (only before it opens)
const unpublishLiveTest = handle("unpublishLiveTest", async (req, res) => {
    if (!isValidId(req.params.id)) throw userError("Invalid test id");
    const test = await Test.findOne({ _id: req.params.id, type: "live", status: "published" });
    if (!test) throw userError("Published live test not found", 404);
    if (new Date() >= test.availability.startsAt) throw userError("The test has already opened, so it can't go back to draft");
    if (await TestAttempt.exists({ testId: test._id })) throw userError("Students have already started it");
    test.status = "draft";
    await test.save();
    res.json({ message: "Moved back to draft", status: test.status });
});

// POST /api/admin/live-tests/:id/sections/:key/reopen   (let the lecturer change a handed-in section)
const reopenSection = handle("reopenSection", async (req, res) => {
    if (!isValidId(req.params.id)) throw userError("Invalid test id");
    const r = await Test.updateOne(
        { _id: req.params.id, type: "live", status: "draft", "sections.key": req.params.key },
        { $unset: { "sections.$.submittedAt": 1 } }
    );
    if (!r.matchedCount) throw userError("Section not found, or the test is already published", 404);
    res.json({ message: "Section re-opened" });
});

// DELETE /api/admin/live-tests/:id   (a draft is removed; anything students took is archived)
const deleteLiveTest = handle("deleteLiveTest", async (req, res) => {
    if (!isValidId(req.params.id)) throw userError("Invalid test id");
    const test = await Test.findOne({ _id: req.params.id, type: "live" });
    if (!test) throw userError("Live test not found", 404);
    const taken = await TestAttempt.exists({ testId: test._id });
    if (test.status === "draft" && !taken) await test.deleteOne();
    else {
        test.status = "archived";
        await test.save();
    }
    res.json({ message: "Deleted" });
});

// GET /api/admin/live-tests/:id/results   (leaderboard)
const liveResults = handle("liveResults", async (req, res) => {
    if (!isValidId(req.params.id)) throw userError("Invalid test id");
    const test = await Test.findOne({ _id: req.params.id, type: "live" }).select("title totalMarks totalQuestions availability status").lean();
    if (!test) throw userError("Live test not found", 404);
    const attempts = await TestAttempt.find({ testId: test._id })
        .select("userId status startedAt submittedAt result.score result.maxScore result.percentage result.accuracy result.correct result.incorrect result.unanswered result.timeTakenSec")
        .populate("userId", "name email")
        .lean();
    const done = attempts.filter((a) => a.status === "submitted" || a.status === "auto_submitted").sort((a, b) => b.result.score - a.result.score || a.result.timeTakenSec - b.result.timeTakenSec);
    let rank = 0;
    let prev = null;
    const rows = done.map((a, i) => {
        if (prev === null || a.result.score !== prev) rank = i + 1;
        prev = a.result.score;
        return {
            rank,
            attemptId: a._id,
            student: a.userId ? { _id: a.userId._id, name: a.userId.name, email: a.userId.email } : null,
            score: a.result.score,
            maxScore: a.result.maxScore,
            percentage: a.result.percentage,
            accuracy: a.result.accuracy,
            correct: a.result.correct,
            incorrect: a.result.incorrect,
            unanswered: a.result.unanswered,
            timeTakenSec: a.result.timeTakenSec,
            submittedAt: a.submittedAt,
            autoSubmitted: a.status === "auto_submitted",
        };
    });
    const scores = done.map((a) => a.result.score);
    res.json({
        test: { _id: test._id, title: test.title, totalMarks: test.totalMarks, totalQuestions: test.totalQuestions, startsAt: test.availability.startsAt, endsAt: test.availability.endsAt, phase: phase(test) },
        stats: {
            finished: done.length,
            inProgress: attempts.filter((a) => a.status === "in_progress").length,
            average: scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null,
            highest: scores.length ? Math.max(...scores) : null,
        },
        rows,
    });
});

module.exports = {
    listLecturers,
    createLecturer,
    updateLecturer,
    getPattern,
    listLiveTests,
    getLiveTest,
    createLiveTest,
    updateLiveTest,
    publishLiveTest,
    unpublishLiveTest,
    reopenSection,
    deleteLiveTest,
    liveResults,
    phase,
};
