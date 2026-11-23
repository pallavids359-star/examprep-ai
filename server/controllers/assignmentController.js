// Assignments: a lecturer chooses class, chapters, concepts, how many questions (in total or per
// chapter), the difficulty mix and the kinds of question. GenPrep picks the questions, the lecturer
// reviews them (swap / remove) and publishes to chosen sections of a college. Students answer at
// their own pace until the due date.
const mongoose = require("mongoose");
const Assignment = require("../models/Assignment");
const Question = require("../models/Question");
const Chapter = require("../models/Chapter");
const Topic = require("../models/Topic");
const Subject = require("../models/Subject");
const Exam = require("../models/Exam");
const User = require("../models/User");
const TestAttempt = require("../models/TestAttempt");
const { FORMATS } = require("../utils/questionFormat");
const { STUDENT_FIELDS } = require("../utils/attemptHelpers");
const { shape, namesFor, FULL_FIELDS } = require("./liveLecturerController");

const isValidId = (id) => mongoose.isValidObjectId(id);
const toId = (id) => new mongoose.Types.ObjectId(String(id));
const userError = (message, status = 400) => Object.assign(new Error(message), { status });
const handle = (where, fn) => async (req, res) => {
    try {
        await fn(req, res);
    } catch (error) {
        if (error.status) return res.status(error.status).json({ message: error.message });
        if (error.code === 11000) return res.status(409).json({ message: "You already started this assignment" });
        console.error(`${where} error:`, error);
        res.status(500).json({ message: "Something went wrong on the server" });
    }
};

const DEFAULT_COLLEGE = "MB PU";
const SECTIONS = ["A", "B", "C", "D"];
const LEVELS = ["easy", "medium", "hard"];
const FINISHED = ["submitted", "auto_submitted"];
const SUBJECT_WORDS = { physics: ["physics"], chemistry: ["chemistry"], mathematics: ["mathematics", "maths", "math"], biology: ["biology", "botany", "zoology"] };

const isAdmin = (req) => req.user.role === "admin";
const ownOrAdmin = (req, a) => isAdmin(req) || String(a.createdBy) === String(req.user._id);

const sample = async (match, size) => {
    if (size <= 0) return [];
    return Question.aggregate([{ $match: match }, { $sample: { size } }, { $project: { _id: 1 } }]);
};

// Split n into easy / medium / hard counts
// `used` counts what earlier chapters already got, so leftovers rotate and the whole paper stays balanced
const splitByLevel = (n, difficulty, used = {}) => {
    if (!difficulty || difficulty.mode === "any") return [[null, n]];
    const pct = difficulty.mode === "custom" ? LEVELS.map((l) => Number(difficulty[l]) || 0) : [1, 1, 1];
    const sum = pct.reduce((a, b) => a + b, 0) || 1;
    const raw = pct.map((p) => (n * p) / sum);
    const out = raw.map(Math.floor);
    let left = n - out.reduce((a, b) => a + b, 0);
    // give the leftovers to the biggest remainders
    raw.map((r, i) => [r - Math.floor(r), i])
        .sort((a, b) => b[0] - a[0] || (used[LEVELS[a[1]]] || 0) - (used[LEVELS[b[1]]] || 0) || a[1] - b[1])
        .forEach(([, i]) => {
            if (left > 0) {
                out[i] += 1;
                left -= 1;
            }
        });
    return LEVELS.map((l, i) => [l, out[i]]).filter(([, k]) => k > 0);
};

// Picks the questions for every chapter. Returns { ids, shortages }.
const pickQuestions = async ({ examId, subjectId, perChapter, topicIds, difficulty, formats, exclude = [] }) => {
    const topics = topicIds.length ? await Topic.find({ _id: { $in: topicIds } }).select("chapterId").lean() : [];
    const chapters = await Chapter.find({ _id: { $in: perChapter.map((p) => p.chapterId) } }).select("name").lean();
    const ids = [];
    const shortages = [];
    const used = {};
    for (const { chapterId, count } of perChapter) {
        const base = { examId: toId(examId), subjectId: toId(subjectId), chapterId: toId(chapterId), status: "published" };
        const own = topics.filter((t) => String(t.chapterId) === String(chapterId)).map((t) => t._id);
        if (own.length) base.topicId = { $in: own };
        if (formats.length) base.format = { $in: formats };
        const taken = () => [...exclude, ...ids].map(toId);
        let got = 0;
        for (const [level, k] of splitByLevel(count, difficulty, used)) {
            if (level) used[level] = (used[level] || 0) + k;
            const found = await sample({ ...base, ...(level ? { difficulty: level } : {}), _id: { $nin: taken() } }, k);
            ids.push(...found.map((q) => q._id));
            got += found.length;
        }
        if (got < count) {
            // not enough at that difficulty: take any difficulty in the same chapter
            const more = await sample({ ...base, _id: { $nin: taken() } }, count - got);
            ids.push(...more.map((q) => q._id));
            got += more.length;
        }
        if (got < count) shortages.push({ chapter: chapters.find((c) => String(c._id) === String(chapterId))?.name || "Chapter", wanted: count, got });
    }
    return { ids, shortages };
};

// Read and check the lecturer's choices
const readSettings = async (req, body) => {
    if (!isValidId(body.examId)) throw userError("Choose the exam");
    if (!isValidId(body.subjectId)) throw userError("Choose the subject");
    const [exam, subject] = await Promise.all([Exam.findById(body.examId).select("code").lean(), Subject.findById(body.subjectId).select("name examId").lean()]);
    if (!exam || !subject || String(subject.examId) !== String(exam._id)) throw userError("That subject is not part of this exam");
    if (!isAdmin(req) && req.user.subject) {
        const ok = (SUBJECT_WORDS[req.user.subject] || []).some((w) => subject.name.toLowerCase().includes(w));
        if (!ok) throw userError(`You can only set ${req.user.subject} assignments`);
    }
    const classLevel = ["11", "12", "both"].includes(body.classLevel) ? body.classLevel : "both";
    const chapterIds = [...new Set((body.chapterIds || []).filter(isValidId).map(String))];
    if (!chapterIds.length) throw userError("Tick at least one chapter");
    const chapters = await Chapter.find({ _id: { $in: chapterIds }, subjectId: subject._id }).select("_id classLevel").lean();
    if (chapters.length !== chapterIds.length) throw userError("Some chapters are not part of this subject");

    // How many questions: in total (shared out between chapters) or per chapter
    let perChapter;
    if (body.countMode === "per_chapter") {
        perChapter = chapterIds.map((id) => ({ chapterId: id, count: Math.max(0, Math.min(100, parseInt(body.perChapter?.[id]) || 0)) })).filter((p) => p.count > 0);
        if (!perChapter.length) throw userError("Give at least one chapter a question count");
    } else {
        const total = Math.max(1, Math.min(200, parseInt(body.totalCount) || 0));
        if (!parseInt(body.totalCount)) throw userError("Enter how many questions");
        const base = Math.floor(total / chapterIds.length);
        let extra = total - base * chapterIds.length;
        perChapter = chapterIds.map((id) => ({ chapterId: id, count: base + (extra-- > 0 ? 1 : 0) })).filter((p) => p.count > 0);
    }
    const total = perChapter.reduce((a, p) => a + p.count, 0);
    if (total > 200) throw userError("An assignment can have at most 200 questions");

    const mode = ["any", "equal", "custom"].includes(body.difficulty?.mode) ? body.difficulty.mode : "equal";
    const difficulty = { mode };
    if (mode === "custom") {
        LEVELS.forEach((l) => (difficulty[l] = Math.max(0, Math.min(100, Number(body.difficulty?.[l]) || 0))));
        if (difficulty.easy + difficulty.medium + difficulty.hard !== 100) throw userError("Easy + medium + hard must add up to 100%");
    }
    const formats = (body.formats || []).filter((f) => FORMATS.includes(f));
    const topicIds = (body.topicIds || []).filter(isValidId).map(String);
    return { exam, subject, classLevel, chapterIds, perChapter, difficulty, formats, topicIds, total };
};

const readAudience = (body) => {
    const college = String(body.college || DEFAULT_COLLEGE).trim().slice(0, 120);
    if (!college) throw userError("Choose the college");
    const sections = [...new Set((body.sections || []).map((s) => String(s).toUpperCase()))].filter((s) => SECTIONS.includes(s));
    const dueAt = new Date(body.dueAt);
    if (Number.isNaN(dueAt.getTime())) throw userError("Choose the due date");
    if (dueAt <= new Date()) throw userError("The due date must be in the future");
    return { college, sections, dueAt };
};

const summary = async (list) => {
    const [subjects, exams, people, counts] = await Promise.all([
        Subject.find({ _id: { $in: list.map((a) => a.subjectId) } }).select("name").lean(),
        Exam.find({ _id: { $in: list.map((a) => a.examId) } }).select("code").lean(),
        User.find({ _id: { $in: list.map((a) => a.createdBy) } }).select("name").lean(),
        TestAttempt.aggregate([{ $match: { mode: "assignment", assignmentId: { $in: list.map((a) => a._id) }, status: { $in: FINISHED } } }, { $group: { _id: "$assignmentId", n: { $sum: 1 } } }]),
    ]);
    const nameOf = (arr, id, k = "name") => arr.find((x) => String(x._id) === String(id))?.[k] || "";
    return list.map((a) => ({
        _id: a._id,
        title: a.title,
        exam: nameOf(exams, a.examId, "code"),
        subject: nameOf(subjects, a.subjectId),
        createdBy: nameOf(people, a.createdBy),
        college: a.college,
        sections: a.sections,
        dueAt: a.dueAt,
        status: a.status,
        questions: a.questionIds.length,
        submitted: counts.find((c) => String(c._id) === String(a._id))?.n || 0,
        createdAt: a.createdAt,
    }));
};

const loadOwn = async (req) => {
    if (!isValidId(req.params.id)) throw userError("Invalid assignment id");
    const a = await Assignment.findById(req.params.id);
    if (!a) throw userError("Assignment not found", 404);
    if (!ownOrAdmin(req, a)) throw userError("This is another lecturer's assignment", 403);
    return a;
};
const started = (a) => TestAttempt.exists({ mode: "assignment", assignmentId: a._id });

// ---------- Lecturer ----------

// GET /api/lecturer/assignments/options?examId=   subjects I can set, and the colleges
const options = handle("assignmentOptions", async (req, res) => {
    const exams = await Exam.find().select("code name").sort({ code: 1 }).lean();
    const examId = isValidId(req.query.examId) ? req.query.examId : exams.find((e) => e.code === "NEET")?._id || exams[0]?._id;
    let subjects = await Subject.find({ examId }).select("name").sort({ name: 1 }).lean();
    if (!isAdmin(req) && req.user.subject) {
        const words = SUBJECT_WORDS[req.user.subject] || [];
        const mine = subjects.filter((s) => words.some((w) => s.name.toLowerCase().includes(w)));
        if (mine.length) subjects = mine;
    }
    const colleges = [...new Set([DEFAULT_COLLEGE, ...(await User.distinct("college", { role: "student", college: { $nin: [null, ""] } }))])];
    res.json({ exams, examId, subjects, colleges, sections: SECTIONS, formats: FORMATS });
});

// GET /api/lecturer/assignments/chapters?subjectId=
const chapters = handle("assignmentChapters", async (req, res) => {
    if (!isValidId(req.query.subjectId)) throw userError("Choose the subject");
    const list = await Chapter.find({ subjectId: req.query.subjectId }).select("name classLevel order").sort({ classLevel: 1, order: 1, name: 1 }).lean();
    const topics = await Topic.find({ chapterId: { $in: list.map((c) => c._id) } }).select("name chapterId order").sort({ order: 1, name: 1 }).lean();
    res.json({ chapters: list.map((c) => ({ ...c, topics: topics.filter((t) => String(t.chapterId) === String(c._id)).map((t) => ({ _id: t._id, name: t.name })) })) });
});

// GET /api/lecturer/assignments
const listMine = handle("listAssignments", async (req, res) => {
    const filter = isAdmin(req) ? {} : { createdBy: req.user._id };
    const list = await Assignment.find(filter).sort({ createdAt: -1 }).limit(200).lean();
    res.json({ assignments: await summary(list) });
});

// POST /api/lecturer/assignments   create a draft with picked questions
const create = handle("createAssignment", async (req, res) => {
    const s = await readSettings(req, req.body);
    const who = readAudience(req.body);
    const { ids, shortages } = await pickQuestions({ examId: s.exam._id, subjectId: s.subject._id, perChapter: s.perChapter, topicIds: s.topicIds, difficulty: s.difficulty, formats: s.formats });
    if (!ids.length) throw userError("No questions match these choices. Try more chapters, any difficulty or more question types.");
    const title =
        String(req.body.title || "").trim().slice(0, 140) ||
        `${s.subject.name} assignment – ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`;
    const a = await Assignment.create({
        title,
        instructions: String(req.body.instructions || "").slice(0, 2000),
        examId: s.exam._id,
        subjectId: s.subject._id,
        createdBy: req.user._id,
        ...who,
        settings: { classLevel: s.classLevel, chapterIds: s.chapterIds, topicIds: s.topicIds, perChapter: s.perChapter, difficulty: s.difficulty, formats: s.formats },
        questionIds: ids,
    });
    res.status(201).json({ assignment: (await summary([a.toObject()]))[0], wanted: s.total, got: ids.length, shortages });
});

// GET /api/lecturer/assignments/:id   with every question (answers and solutions)
const getOne = handle("getAssignment", async (req, res) => {
    const a = await loadOwn(req);
    const qs = await Question.find({ _id: { $in: a.questionIds } }).select(`${FULL_FIELDS} format`).lean();
    const [chaptersById, topicsById] = await namesFor(qs);
    const byId = new Map(qs.map((q) => [String(q._id), q]));
    const questions = a.questionIds.map((id) => byId.get(String(id))).filter(Boolean).map((q) => ({ ...shape(q, chaptersById, topicsById), format: q.format || "" }));
    const [info] = await summary([a.toObject()]);
    res.json({ assignment: { ...info, instructions: a.instructions, settings: a.settings, editable: !(await started(a)) }, questions });
});

// PUT /api/lecturer/assignments/:id   { title?, instructions?, dueAt?, college?, sections?, questionIds? }
const update = handle("updateAssignment", async (req, res) => {
    const a = await loadOwn(req);
    if (req.body.title !== undefined) a.title = String(req.body.title).trim().slice(0, 140) || a.title;
    if (req.body.instructions !== undefined) a.instructions = String(req.body.instructions).slice(0, 2000);
    if (req.body.dueAt !== undefined || req.body.college !== undefined || req.body.sections !== undefined) {
        const who = readAudience({ college: req.body.college ?? a.college, sections: req.body.sections ?? a.sections, dueAt: req.body.dueAt ?? a.dueAt });
        Object.assign(a, who);
    }
    if (req.body.questionIds !== undefined) {
        if (await started(a)) throw userError("Students have started this assignment, so its questions can't change");
        const ids = [...new Set((req.body.questionIds || []).filter(isValidId).map(String))];
        const ok = await Question.countDocuments({ _id: { $in: ids }, subjectId: a.subjectId });
        if (ok !== ids.length) throw userError("Some questions are not from this subject");
        if (!ids.length && a.status === "published") throw userError("A published assignment needs at least one question");
        a.questionIds = ids.map(toId);
    }
    await a.save();
    res.json({ message: "Saved" });
});

// POST /api/lecturer/assignments/:id/swap   { questionId }  a similar question takes its place
const swap = handle("swapAssignmentQuestion", async (req, res) => {
    const a = await loadOwn(req);
    if (await started(a)) throw userError("Students have started this assignment, so its questions can't change");
    const pos = a.questionIds.map(String).indexOf(String(req.body.questionId));
    if (pos === -1) throw userError("That question is not in this assignment");
    const old = await Question.findById(req.body.questionId).select("chapterId topicId difficulty format type").lean();
    const base = { subjectId: a.subjectId, status: "published", _id: { $nin: a.questionIds } };
    const tries = [
        { chapterId: old?.chapterId, topicId: old?.topicId, difficulty: old?.difficulty, format: old?.format },
        { chapterId: old?.chapterId, difficulty: old?.difficulty, format: old?.format },
        { chapterId: old?.chapterId, format: old?.format },
        { chapterId: old?.chapterId, type: old?.type },
    ];
    let next = null;
    for (const t of tries) {
        const clean = Object.fromEntries(Object.entries(t).filter(([, v]) => v !== undefined && v !== null));
        [next] = await sample({ ...base, ...clean, _id: { $nin: a.questionIds.map(toId) } }, 1);
        if (next) break;
    }
    if (!next) throw userError("No other similar question is left in this chapter");
    a.questionIds.splice(pos, 1, next._id);
    await a.save();
    const q = await Question.findById(next._id).select(`${FULL_FIELDS} format`).lean();
    const [chaptersById, topicsById] = await namesFor([q]);
    res.json({ position: pos, question: { ...shape(q, chaptersById, topicsById), format: q.format || "" } });
});

// POST /api/lecturer/assignments/:id/publish  and  /unpublish
const publish = handle("publishAssignment", async (req, res) => {
    const a = await loadOwn(req);
    if (!a.questionIds.length) throw userError("Add at least one question first");
    if (a.dueAt <= new Date()) throw userError("The due date has passed. Choose a new due date first.");
    a.status = "published";
    a.publishedAt = new Date();
    await a.save();
    res.json({ message: "Published" });
});
const unpublish = handle("unpublishAssignment", async (req, res) => {
    const a = await loadOwn(req);
    if (await started(a)) throw userError("Students have started this assignment, so it can't be taken back");
    a.status = "draft";
    await a.save();
    res.json({ message: "Back to draft" });
});

// DELETE /api/lecturer/assignments/:id
const remove = handle("deleteAssignment", async (req, res) => {
    const a = await loadOwn(req);
    await TestAttempt.deleteMany({ mode: "assignment", assignmentId: a._id });
    await a.deleteOne();
    res.json({ message: "Deleted" });
});

// GET /api/lecturer/assignments/:id/submissions   every student it was sent to, and how they did
const submissions = handle("assignmentSubmissions", async (req, res) => {
    const a = await loadOwn(req);
    const studentFilter = { role: "student", college: a.college, ...(a.sections.length ? { section: { $in: a.sections } } : {}) };
    const [students, attempts] = await Promise.all([
        User.find(studentFilter).select("name email section").sort({ section: 1, name: 1 }).lean(),
        TestAttempt.find({ mode: "assignment", assignmentId: a._id }).select("userId status startedAt submittedAt result").lean(),
    ]);
    const byUser = new Map(attempts.map((t) => [String(t.userId), t]));
    const rows = students.map((s) => {
        const t = byUser.get(String(s._id));
        const r = t?.result || {};
        return {
            student: s,
            status: !t ? "not_started" : FINISHED.includes(t.status) ? "submitted" : "in_progress",
            submittedAt: t?.submittedAt || null,
            score: t && FINISHED.includes(t.status) ? r.score ?? 0 : null,
            maxScore: r.maxScore ?? null,
            correct: r.correct ?? null,
            wrong: r.incorrect ?? null,
            skipped: r.unanswered ?? null,
            timeTakenSec: r.timeTakenSec ?? null,
        };
    });
    res.json({
        stats: {
            total: rows.length,
            submitted: rows.filter((r) => r.status === "submitted").length,
            inProgress: rows.filter((r) => r.status === "in_progress").length,
            notStarted: rows.filter((r) => r.status === "not_started").length,
        },
        rows,
    });
});

// ---------- Students ----------

const forStudent = (user) => ({
    status: "published",
    college: user.college || "__none__",
    $or: [{ sections: { $size: 0 } }, { sections: user.section || "__none__" }],
});

// GET /api/assignments   (mine, newest due first)
const myAssignments = handle("myAssignments", async (req, res) => {
    const me = await User.findById(req.user._id).select("college section").lean();
    const filter = forStudent(me || {});
    if (isValidId(req.query.examId)) filter.examId = req.query.examId;
    const list = await Assignment.find(filter).sort({ dueAt: 1 }).limit(200).lean();
    const attempts = await TestAttempt.find({ mode: "assignment", userId: req.user._id, assignmentId: { $in: list.map((a) => a._id) } })
        .select("assignmentId status submittedAt result")
        .lean();
    const info = await summary(list);
    const now = new Date();
    res.json({
        assignments: info.map((x) => {
            const t = attempts.find((at) => String(at.assignmentId) === String(x._id));
            const done = t && FINISHED.includes(t.status);
            return {
                ...x,
                submitted: undefined,
                state: done ? "submitted" : t ? (x.dueAt < now ? "late" : "in_progress") : x.dueAt < now ? "missed" : "open",
                attemptId: t?._id || null,
                result: done ? { score: t.result?.score ?? 0, maxScore: t.result?.maxScore ?? 0, correct: t.result?.correct ?? 0, wrong: t.result?.incorrect ?? 0, skipped: t.result?.unanswered ?? 0 } : null,
            };
        }),
    });
});

// POST /api/assignments/:id/start   (or continue)
const startAssignment = handle("startAssignment", async (req, res) => {
    if (!isValidId(req.params.id)) throw userError("Invalid assignment id");
    const me = await User.findById(req.user._id).select("college section").lean();
    const a = await Assignment.findOne({ _id: req.params.id, ...forStudent(me || {}) }).lean();
    if (!a) throw userError("Assignment not found", 404);
    const existing = await TestAttempt.findOne({ mode: "assignment", assignmentId: a._id, userId: req.user._id }).select("_id status").lean();
    if (existing) return res.json({ attemptId: existing._id, status: existing.status });
    if (new Date(a.dueAt) <= new Date()) throw userError("The due date has passed");
    const exam = await Exam.findById(a.examId).select("markingScheme").lean();
    const qs = await Question.find({ _id: { $in: a.questionIds }, status: "published" }).select(Object.keys(STUDENT_FIELDS).join(" ")).lean();
    const byId = new Map(qs.map((q) => [String(q._id), q]));
    const ordered = a.questionIds.map((id) => byId.get(String(id))).filter(Boolean);
    if (!ordered.length) throw userError("This assignment has no questions right now");
    const attempt = await TestAttempt.create({
        userId: req.user._id,
        examId: a.examId,
        mode: "assignment",
        assignmentId: a._id,
        expiresAt: a.dueAt, // answers saved by the due date count
        markingScheme: { correct: exam?.markingScheme?.correct ?? 4, incorrect: exam?.markingScheme?.incorrect ?? -1, unanswered: exam?.markingScheme?.unanswered ?? 0 },
        answers: ordered.map((q) => ({ questionId: q._id, subjectId: q.subjectId, chapterId: q.chapterId, topicId: q.topicId })),
    });
    res.status(201).json({ attemptId: attempt._id, status: attempt.status });
});

module.exports = { options, chapters, listMine, create, getOne, update, swap, publish, unpublish, remove, submissions, myAssignments, startAssignment, pickQuestions, splitByLevel };
