// Head lecturer (admin) side of live tests, and lecturer accounts.
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Test = require("../models/Test");
const Exam = require("../models/Exam");
const Subject = require("../models/Subject");
const User = require("../models/User");
const Question = require("../models/Question");
const Chapter = require("../models/Chapter");
const TestAttempt = require("../models/TestAttempt");
const { sectionsFor, patternFor, canSplitBiology, subjectKey } = require("../utils/livePattern");
const { syncLiveStatus, canEditQuestions, autoPick, sectionState } = require("../utils/liveSchedule");
const { normalizeCollege, collegeList } = require("../utils/college");

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
        picker: s.picker || "lecturer",
        mcqCount: s.mcqCount || 0,
        numericalCount: s.numericalCount || 0,
        picked: (s.questionIds || []).length,
        dueAt: s.dueAt || null,
        submittedAt: s.submittedAt || null,
        returnedAt: s.returnedAt || null,
        returnNote: s.returnNote || "",
    };
};

// full = has every question; sent = the lecturer sent it in (or nobody needs to); ready = both
const readiness = (t, st) =>
    t.status !== "draft" ? { full: true, sent: true, ready: true } : { full: Boolean(st?.full), sent: st ? st.sent : true, ready: Boolean(st?.ready) };

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
        .select("name email role status subject lastLoginAt createdAt")
        .lean();
    const counts = await Test.aggregate([
        { $match: { type: "live", status: { $ne: "archived" } } },
        { $unwind: "$sections" },
        { $group: { _id: "$sections.lecturerId", sections: { $sum: 1 } } },
    ]);
    const byId = new Map(counts.map((c) => [String(c._id), c.sections]));
    res.json({ lecturers: users.map((u) => ({ ...u, sections: byId.get(String(u._id)) || 0 })) });
});

const SUBJECTS = ["physics", "chemistry", "mathematics", "biology"];
const readSubject = (v) => {
    const k = String(v || "").toLowerCase();
    if (!SUBJECTS.includes(k)) throw userError("Choose the lecturer's subject: Physics, Chemistry, Maths or Biology");
    return k;
};

// POST /api/admin/lecturers   { name, email, password, subject }
const createLecturer = handle("createLecturer", async (req, res) => {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    if (name.length < 2) throw userError("Enter the lecturer's name");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw userError("Enter a valid email address");
    if (password.length < 8) throw userError("The password needs at least 8 characters");
    const subject = readSubject(req.body.subject);

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
        subject,
        isEmailVerified: true,
    });
    res.status(201).json({ lecturer: { _id: user._id, name: user.name, email: user.email, role: user.role, subject: user.subject, status: user.status, sections: 0 } });
});

// PUT /api/admin/lecturers/:id   { name?, email?, status?: "active"|"suspended", password?: "new password" }
const updateLecturer = handle("updateLecturer", async (req, res) => {
    if (!isValidId(req.params.id)) throw userError("Invalid lecturer id");
    const update = {};
    if (req.body.name !== undefined) {
        const name = String(req.body.name).trim();
        if (name.length < 2) throw userError("Enter the lecturer's name");
        if (name.length > 80) throw userError("The name is too long");
        update.name = name;
    }
    if (req.body.subject !== undefined) update.subject = readSubject(req.body.subject);
    if (req.body.email !== undefined) {
        const email = String(req.body.email).trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw userError("Enter a valid email address");
        const taken = await User.findOne({ email, _id: { $ne: req.params.id } }).select("_id").lean();
        if (taken) throw userError("Another account already uses this email");
        update.email = email;
    }
    if (req.body.status !== undefined) {
        if (!["active", "suspended"].includes(req.body.status)) throw userError("Status must be active or suspended");
        update.status = req.body.status;
    }
    if (req.body.password !== undefined) {
        if (String(req.body.password).length < 8) throw userError("The password needs at least 8 characters");
        update.passwordHash = await bcrypt.hash(String(req.body.password), 10);
        update.passwordChangedAt = new Date();
    }
    if (!Object.keys(update).length) throw userError("Nothing to change");
    const user = await User.findOneAndUpdate({ _id: req.params.id, role: "lecturer" }, update, { returnDocument: "after" }).select("name email role status subject");
    if (!user) throw userError("Lecturer not found", 404);
    res.json({ lecturer: user });
});

// PUT /api/admin/live-tests/:id/sections/:key/lecturer   { lecturerId, keepQuestions = true }
// Gives a subject to a different lecturer (before the test opens). The new lecturer has to send it again.
const changeSectionLecturer = handle("changeSectionLecturer", async (req, res) => {
    if (!isValidId(req.params.id)) throw userError("Invalid test id");
    if (!isValidId(req.body.lecturerId)) throw userError("Choose a lecturer");
    const test = await Test.findOne({ _id: req.params.id, type: "live", status: { $in: ["draft", "published"] } });
    if (!test) throw userError("Live test not found", 404);
    const section = test.sections.find((s) => s.key === req.params.key);
    if (!section) throw userError("Section not found", 404);
    if (!(await canEditQuestions(test))) throw userError("Students have already started this test, so the lecturer can't change now");
    const lecturer = await User.findOne({ _id: req.body.lecturerId, role: "lecturer", status: "active" }).select("name").lean();
    if (!lecturer) throw userError("That lecturer doesn't exist or is suspended");
    const same = String(section.lecturerId) === String(lecturer._id) && section.picker === "lecturer";
    section.picker = "lecturer";
    section.lecturerId = lecturer._id;
    if (!same) {
        section.submittedAt = undefined;
        section.returnedAt = undefined;
        section.returnNote = undefined;
    }
    if (req.body.keepQuestions === false) section.questionIds = [];
    await test.save();
    const { status } = await syncLiveStatus(test, { pullBack: true });
    res.json({ message: `${section.name} is now with ${lecturer.name}`, testStatus: status });
});

// ---------- Live tests ----------

// GET /api/admin/live-tests/pattern?examId=...   default sections and time for the create form
const getPattern = handle("getPattern", async (req, res) => {
    if (!isValidId(req.query.examId)) throw userError("Choose an exam");
    const exam = await Exam.findById(req.query.examId).select("code name markingScheme").lean();
    if (!exam) throw userError("Exam not found", 404);
    const pattern = patternFor(exam.code);
    if (!pattern) throw userError(`Live tests are not set up for ${exam.code}`);
    const colleges = collegeList(await User.distinct("college", { role: "student", college: { $nin: [null, ""] } }));
    const subjects = await Subject.find({ examId: exam._id }).select("name").lean();
    const chapterDocs = await Chapter.find({ examId: exam._id }).select("name classLevel order subjectId").sort({ classLevel: 1, order: 1, name: 1 }).lean();
    const chapters = {};
    for (const sub of subjects) chapters[subjectKey(sub.name)] = chapterDocs.filter((c) => String(c.subjectId) === String(sub._id)).map((c) => ({ _id: c._id, name: c.name, classLevel: c.classLevel }));
    const formats = ["single_correct", "assertion_reason", "statement_based", "match_following", ...(exam.code === "JEE" ? ["multi_correct", "numerical"] : [])];
    res.json({
        exam,
        colleges,
        chapters,
        formats,
        minutes: pattern.minutes,
        canSplitBiology: canSplitBiology(exam.code),
        sections: sectionsFor(exam.code, false),
        splitSections: canSplitBiology(exam.code) ? sectionsFor(exam.code, true) : null,
    });
});

// Builds and checks the parts of a live test from the form
const buildDetails = async (body, exam, existing, me) => {
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

    // Auto-pick choices
    const a = body.auto || {};
    const mixIn = ["easy", "medium", "hard"].map((l) => Math.max(0, Math.min(100, Math.round(Number(a.mix?.[l]) || 0))));
    const mixSum = mixIn.reduce((x, y) => x + y, 0);
    if (mixSum && mixSum !== 100) throw userError("Easy + medium + hard must add up to 100%");
    const auto = {
        classLevel: ["11", "12"].includes(String(a.classLevel)) ? String(a.classLevel) : "both",
        mix: mixSum ? { easy: mixIn[0], medium: mixIn[1], hard: mixIn[2] } : undefined,
        formats: (a.formats || []).filter((f) => ["single_correct", "assertion_reason", "statement_based", "match_following", "multi_correct", "numerical"].includes(f)),
        formatCounts: Object.fromEntries(
            Object.entries(a.formatCounts || {})
                .filter(([f, n]) => (a.formats || []).includes(f) && f !== "numerical" && Number(n) > 0)
                .map(([f, n]) => [f, Math.min(200, Math.round(Number(n)))])
        ),
        perChapter: (a.perChapter || [])
            .filter((p) => isValidId(p.chapterId) && Number(p.count) > 0)
            .map((p) => ({ sectionKey: String(p.sectionKey), chapterId: p.chapterId, count: Math.min(200, Math.round(Number(p.count))) })),
    };
    const sameAuto = (x) => JSON.stringify({ c: x?.classLevel || "both", m: x?.mix?.easy ? [x.mix.easy, x.mix.medium, x.mix.hard] : null, f: x?.formats || [], fc: Object.entries(x?.formatCounts instanceof Map ? Object.fromEntries(x.formatCounts) : x?.formatCounts || {}).sort(), p: (x?.perChapter || []).map((p) => [p.sectionKey, String(p.chapterId), p.count]) });
    const autoChanged = existing && sameAuto(existing.live?.auto) !== sameAuto(auto);
    const wanted = Array.isArray(body.sections) ? body.sections : [];
    if (!wanted.length) throw userError("Add at least one section");

    const typedTotal = Object.values(auto.formatCounts).reduce((x, n) => x + n, 0);
    for (const w of wanted) {
        if (w.picker === "auto" && typedTotal > (Number(w.mcqCount) || 0)) {
            throw userError(`The question types add up to ${typedTotal}, more than the ${Number(w.mcqCount) || 0} questions in ${offered.find((o) => o.key === w.key)?.name || "a subject"}`);
        }
    }
    const subjects = await Subject.find({ examId: exam._id }).select("name").lean();
    const lecturerIds = [...new Set(wanted.filter((s) => s.picker === "lecturer" || !s.picker).map((s) => String(s.lecturerId || "")).filter(isValidId))];
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
        // Who picks: "auto" (the system), "me" (the head lecturer) or "lecturer" (someone else)
        const picker = ["auto", "me", "lecturer"].includes(w.picker) ? w.picker : w.lecturerId ? "lecturer" : "auto";
        let lecturerId = me;
        if (picker === "lecturer") {
            if (!isValidId(w.lecturerId) || !okLecturers.has(String(w.lecturerId))) throw userError(`Choose an active lecturer for ${def.name}`);
            lecturerId = w.lecturerId;
        }
        const mcqCount = clampInt(w.mcqCount, 0, 200, def.mcqCount);
        const numericalCount = clampInt(w.numericalCount, 0, 50, def.numericalCount);
        if (mcqCount + numericalCount < 1) throw userError(`${def.name} needs at least one question`);
        const old = oldByKey.get(def.key);
        // Changing the lecturer or the counts re-opens the section for picking
        const same = old && String(old.lecturerId) === String(lecturerId) && old.mcqCount === mcqCount && old.numericalCount === numericalCount;
        sections.push({
            key: def.key,
            name: def.name,
            subjectId: subject._id,
            lecturerId,
            picker,
            mcqCount,
            numericalCount,
            dueAt: w.dueAt ? toDate(w.dueAt, `${def.name} due time`) : undefined,
            // Auto sections are picked again when the auto choices change
            questionIds: old && String(old.subjectId) === String(subject._id) && !(picker === "auto" && autoChanged) ? old.questionIds : [],
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
            auto,
            showResults: "after_submit",
            shuffle: body.shuffle !== false,
            college: normalizeCollege(body.college),
            sections: String(body.college || "").trim() ? [...new Set((body.audienceSections || []).map((x) => String(x).toUpperCase()))].filter((x) => ["A", "B", "C", "D"].includes(x)) : [],
            publishedAt: existing?.live?.publishedAt,
        },
    };
};

// Auto sections with missing questions get them picked now. Returns notes about shortages.
const fillAutoSections = async (test) => {
    const notes = [];
    for (const s of test.sections) {
        if (s.picker !== "auto") continue;
        const r = await autoPick(test, s, { useSettings: true });
        if (r.shortMcq || r.shortNumerical) notes.push(`${s.name}: the bank is ${r.shortMcq} MCQ and ${r.shortNumerical} numerical short`);
    }
    await test.save();
    return notes;
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
    const states = new Map();
    for (const t of tests) if (t.status === "draft" || new Date() < new Date(t.availability.startsAt)) states.set(String(t._id), await sectionState(t));
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
            college: t.live?.college || "",
            audienceSections: t.live?.sections || [],
            totalQuestions: t.sections.reduce((a, s) => a + (s.mcqCount || 0) + (s.numericalCount || 0), 0),
            sections: t.sections.map((s) => ({ ...sectionSummary(s, lecturers), ...readiness(t, states.get(String(t._id))?.sections.find((x) => x.key === s.key)) })),
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
    const state = await sectionState(test);
    const editable = await canEditQuestions(test);
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
            editable,
            sections: test.sections.map((s) => ({
                ...sectionSummary(s, lecturers),
                ...readiness(test, state.sections.find((x) => x.key === s.key)),
                missing: state.sections.find((x) => x.key === s.key)?.missing || 0,
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
    const details = await buildDetails(req.body, exam, null, req.user._id);
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
    const notes = await fillAutoSections(test);
    const { status } = await syncLiveStatus(test);
    res.status(201).json({ testId: test._id, status, notes });
});

// PUT /api/admin/live-tests/:id   (everything while a draft; only name, instructions and closing time once published)
const updateLiveTest = handle("updateLiveTest", async (req, res) => {
    if (!isValidId(req.params.id)) throw userError("Invalid test id");
    const test = await Test.findOne({ _id: req.params.id, type: "live" });
    if (!test) throw userError("Live test not found", 404);
    if (test.status === "archived") throw userError("This test was deleted");

    // The whole form (with its subjects) can be changed until the test opens
    if (Array.isArray(req.body.sections) && (await canEditQuestions(test))) {
        const exam = await Exam.findById(test.examId).lean();
        const details = await buildDetails({ ...req.body, examId: test.examId }, exam, test.toObject(), req.user._id);
        Object.assign(test, details);
        await test.save();
        const notes = await fillAutoSections(test);
        const { status } = await syncLiveStatus(test);
        return res.json({ message: "Saved", status, notes });
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
            if (endsAt <= test.availability.startsAt) throw userError("The test must close after it opens");
            if (endsAt <= new Date() && endsAt.getTime() !== new Date(test.availability.endsAt).getTime()) throw userError("Choose a closing time in the future");
            test.availability.endsAt = endsAt;
        }
    }
    await test.save();
    res.json({ message: "Saved" });
});

// POST /api/admin/live-tests/:id/publish   (normally not needed: full tests publish themselves)
const publishLiveTest = handle("publishLiveTest", async (req, res) => {
    if (!isValidId(req.params.id)) throw userError("Invalid test id");
    const test = await Test.findOne({ _id: req.params.id, type: "live" });
    if (!test) throw userError("Live test not found", 404);
    if (test.status !== "draft") throw userError("This test is already published");
    if (test.availability.endsAt <= new Date()) throw userError("The closing time has already passed. Change it first.");
    const allIds = test.sections.flatMap((s) => s.questionIds.map(String));
    if (new Set(allIds).size !== allIds.length) throw userError("The same question is in two sections");
    const { status, state } = await syncLiveStatus(test, { publish: true });
    if (status !== "published") {
        const missing = state.sections
            .filter((x) => !x.ready)
            .map((x) => {
                const sec = test.sections.find((y) => y.key === x.key);
                return x.full ? `${sec.name} is not sent by its lecturer yet` : `${sec.name} has ${x.mcq} + ${x.numerical}, needs ${sec.mcqCount} + ${sec.numericalCount}`;
            });
        throw userError(`Can't publish yet: ${missing.join("; ")}`);
    }
    res.json({ message: "Published", status });
});

// POST /api/admin/live-tests/:id/unpublish   (only before it opens)
const unpublishLiveTest = handle("unpublishLiveTest", async (req, res) => {
    if (!isValidId(req.params.id)) throw userError("Invalid test id");
    const test = await Test.findOne({ _id: req.params.id, type: "live", status: "published" });
    if (!test) throw userError("Published live test not found", 404);
    if (await TestAttempt.exists({ testId: test._id })) throw userError("Students have already started it");
    test.status = "draft";
    await test.save();
    res.json({ message: "Moved back to draft", status: test.status });
});

// POST /api/admin/live-tests/:id/sections/:key/reopen   { note? }
// "Send back to lecturer": they can change the questions again (only before the test opens)
const reopenSection = handle("reopenSection", async (req, res) => {
    if (!isValidId(req.params.id)) throw userError("Invalid test id");
    const test = await Test.findOne({ _id: req.params.id, type: "live", status: { $in: ["draft", "published"] } });
    if (!test) throw userError("Live test not found", 404);
    const section = test.sections.find((s) => s.key === req.params.key);
    if (!section) throw userError("Section not found", 404);
    if (!(await canEditQuestions(test))) throw userError("Students have already started this test, so it can't change now");
    section.submittedAt = undefined;
    section.returnedAt = new Date();
    section.returnNote = String(req.body?.note || "").trim().slice(0, 500) || undefined;
    await test.save();
    const { status } = await syncLiveStatus(test, { pullBack: true });
    res.json({ message: "Sent back to the lecturer", testStatus: status });
});

// POST /api/admin/live-tests/:id/sections/:key/accept   (head lecturer marks a lecturer's full section ready)
const acceptSection = handle("acceptSection", async (req, res) => {
    if (!isValidId(req.params.id)) throw userError("Invalid test id");
    const test = await Test.findOne({ _id: req.params.id, type: "live", status: "draft" });
    if (!test) throw userError("Live test not found, or already live", 404);
    const section = test.sections.find((s) => s.key === req.params.key);
    if (!section) throw userError("Section not found", 404);
    const st = (await sectionState(test)).sections.find((x) => x.key === section.key);
    if (!st.full) throw userError(`${section.name} is not full yet`);
    section.submittedAt = new Date();
    section.returnedAt = undefined;
    section.returnNote = undefined;
    await test.save();
    const { status } = await syncLiveStatus(test);
    res.json({ message: "Accepted", testStatus: status });
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
    const test = await Test.findOne({ _id: req.params.id, type: "live" }).select("title examId totalMarks totalQuestions availability status sections.name sections.questionIds").lean();
    if (!test) throw userError("Live test not found", 404);
    const attempts = await TestAttempt.find({ testId: test._id })
        .select("userId status startedAt submittedAt expiresAt result.score result.maxScore result.percentage result.accuracy result.correct result.incorrect result.unanswered result.timeTakenSec answers.questionId answers.isCorrect answers.marksAwarded answers.timeSpentSec answers.selectedOptionIds answers.numericalValue")
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
            startedAt: a.startedAt,
            autoSubmitted: a.status === "auto_submitted",
            subjects: (test.sections || []).map((sec) => {
                const ids = new Set((sec.questionIds || []).map(String));
                const list = (a.answers || []).filter((x) => ids.has(String(x.questionId)));
                const correct = list.filter((x) => x.isCorrect === true).length;
                const wrong = list.filter((x) => x.isCorrect === false).length;
                return { name: sec.name, total: list.length, correct, wrong, skipped: list.length - correct - wrong, marks: list.reduce((n, x) => n + (x.marksAwarded || 0), 0), timeSec: list.reduce((n, x) => n + (x.timeSpentSec || 0), 0) };
            }),
        };
    });
    const scores = done.map((a) => a.result.score);
    const now = new Date();
    const open = attempts.filter((a) => a.status === "in_progress");
    const stuck = open.filter((a) => (a.expiresAt && new Date(a.expiresAt) < now) || now > new Date(test.availability.endsAt));
    const writing = open.filter((a) => !stuck.includes(a));
    const who = (a) => ({ _id: a.userId?._id, name: a.userId?.name || "Deleted account", email: a.userId?.email || "", startedAt: a.startedAt });
    res.json({
        test: { _id: test._id, title: test.title, exam: (await Exam.findById(test.examId).select("code").lean())?.code || "", totalMarks: test.totalMarks, totalQuestions: test.totalQuestions, startsAt: test.availability.startsAt, endsAt: test.availability.endsAt, phase: phase(test) },
        stats: {
            finished: done.length,
            started: attempts.length,
            submitted: done.filter((a) => a.status === "submitted").length,
            autoSubmitted: done.filter((a) => a.status === "auto_submitted").length,
            inProgress: writing.length,
            notCompleted: stuck.length,
            average: scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null,
            highest: scores.length ? Math.max(...scores) : null,
            lowest: scores.length ? Math.min(...scores) : null,
            avgTimeSec: done.length ? Math.round(done.reduce((n, a) => n + (a.result.timeTakenSec || 0), 0) / done.length) : 0,
        },
        writingNow: writing.map(who),
        notCompleted: stuck.map(who),
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
    acceptSection,
    changeSectionLecturer,
    deleteLiveTest,
    liveResults,
    phase,
};
