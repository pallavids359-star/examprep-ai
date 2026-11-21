// Admin: every test a student took, and any attempt question by question (right, wrong, skipped).
const mongoose = require("mongoose");
const TestAttempt = require("../models/TestAttempt");
const Test = require("../models/Test");
const User = require("../models/User");
const Exam = require("../models/Exam");
const Question = require("../models/Question");
const Chapter = require("../models/Chapter");
const Topic = require("../models/Topic");
const Subject = require("../models/Subject");
const { liveResultsOf } = require("../utils/liveResults");

const isValidId = (id) => mongoose.isValidObjectId(id);
const userError = (message, status = 400) => Object.assign(new Error(message), { status });
const handle = (where, fn) => async (req, res) => {
    try {
        await fn(req, res);
    } catch (error) {
        if (error.status) return res.status(error.status).json({ message: error.message });
        console.error(`${where} error:`, error);
        res.status(500).json({ message: "Something went wrong on the server" });
    }
};

const FINISHED = ["submitted", "auto_submitted"];
const MODE_LABEL = {
    live: "Live test",
    mock: "Mock test",
    practice: "Practice",
    wrong_answer_practice: "Wrong-answer practice",
    bookmark_practice: "Bookmark practice",
};

// Rank in a live test: 1 + how many finished attempts scored more (same score = same rank)
const liveRank = async (attempt) => {
    if (attempt.mode !== "live" || !FINISHED.includes(attempt.status) || !attempt.testId) return null;
    const [higher, total] = await Promise.all([
        TestAttempt.countDocuments({ testId: attempt.testId, status: { $in: FINISHED }, "result.score": { $gt: attempt.result?.score ?? 0 } }),
        TestAttempt.countDocuments({ testId: attempt.testId, status: { $in: FINISHED } }),
    ]);
    return { rank: higher + 1, total };
};

// GET /api/admin/students/:id/attempts   (every test and practice the student took, newest first)
const listStudentAttempts = handle("listStudentAttempts", async (req, res) => {
    if (!isValidId(req.params.id)) throw userError("Invalid student id");
    const student = await User.findOne({ _id: req.params.id, role: "student" }).select("_id").lean();
    if (!student) throw userError("Student not found", 404);
    const attempts = await TestAttempt.find({ userId: student._id })
        .sort({ startedAt: -1 })
        .limit(200)
        .select("mode status testId examId startedAt submittedAt result.score result.maxScore result.percentage result.accuracy result.correct result.incorrect result.unanswered result.timeTakenSec result.rank answers.questionId answers.chapterId answers.subjectId")
        .lean();
    const [tests, exams] = await Promise.all([
        Test.find({ _id: { $in: attempts.map((a) => a.testId).filter(Boolean) } }).select("title").lean(),
        Exam.find({ _id: { $in: attempts.map((a) => a.examId) } }).select("code").lean(),
    ]);
    const title = new Map(tests.map((t) => [String(t._id), t.title]));
    // Practice has no test name: name it after its chapters ("Laws of Motion + 2 more")
    const chapterIds = [...new Set(attempts.filter((a) => !a.testId).flatMap((a) => (a.answers || []).map((x) => String(x.chapterId))).filter((x) => x && x !== "undefined"))];
    const chapterDocs = chapterIds.length ? await Chapter.find({ _id: { $in: chapterIds } }).select("name").lean() : [];
    const chapterName = new Map(chapterDocs.map((c) => [String(c._id), c.name]));
    const practiceTitle = (a) => {
        const names = [...new Set((a.answers || []).map((x) => chapterName.get(String(x.chapterId))).filter(Boolean))];
        if (!names.length) return null;
        return names.length === 1 ? names[0] : `${names[0]} + ${names.length - 1} more`;
    };
    const code = new Map(exams.map((e) => [String(e._id), e.code]));
    const rows = [];
    for (const a of attempts) {
        const r = a.result || {};
        rows.push({
            attemptId: a._id,
            mode: a.mode,
            modeLabel: MODE_LABEL[a.mode] || a.mode,
            title: title.get(String(a.testId)) || practiceTitle(a) || MODE_LABEL[a.mode] || "Test",
            exam: code.get(String(a.examId)) || "",
            status: a.status,
            startedAt: a.startedAt,
            submittedAt: a.submittedAt || null,
            questions: (a.answers || []).length,
            score: r.score ?? null,
            maxScore: r.maxScore ?? null,
            percentage: r.percentage ?? null,
            accuracy: r.accuracy ?? null,
            correct: r.correct ?? 0,
            wrong: r.incorrect ?? 0,
            unanswered: r.unanswered ?? 0,
            timeTakenSec: r.timeTakenSec ?? 0,
            rank: a.mode === "live" ? await liveRank(a) : null,
        });
    }
    res.json({ attempts: rows });
});

// GET /api/admin/attempts/:id   (one attempt, every question with the student's answer and the right one)
const getAttemptDetail = handle("getAttemptDetail", async (req, res) => {
    if (!isValidId(req.params.id)) throw userError("Invalid attempt id");
    const attempt = await TestAttempt.findById(req.params.id).lean();
    if (!attempt) throw userError("Attempt not found", 404);
    const [student, test, exam] = await Promise.all([
        User.findById(attempt.userId).select("name email").lean(),
        attempt.testId ? Test.findById(attempt.testId).select("title type sections.name sections.questionIds").lean() : null,
        Exam.findById(attempt.examId).select("code").lean(),
    ]);

    const ids = attempt.answers.map((a) => a.questionId);
    const qs = await Question.find({ _id: { $in: ids } })
        .select("type text images options explanation difficulty chapterId topicId subjectId +correctOptionIds +numericalAnswer")
        .lean();
    const [chapters, topics, subjects] = await Promise.all([
        Chapter.find({ _id: { $in: qs.map((q) => q.chapterId) } }).select("name").lean(),
        Topic.find({ _id: { $in: qs.map((q) => q.topicId) } }).select("name").lean(),
        Subject.find({ _id: { $in: qs.map((q) => q.subjectId) } }).select("name").lean(),
    ]);
    const nameOf = (list) => new Map(list.map((x) => [String(x._id), x.name]));
    const cName = nameOf(chapters);
    const tName = nameOf(topics);
    const sName = nameOf(subjects);
    const byId = new Map(qs.map((q) => [String(q._id), q]));
    const sectionOf = new Map();
    (test?.sections || []).forEach((s) => (s.questionIds || []).forEach((id) => sectionOf.set(String(id), s.name)));

    const finished = FINISHED.includes(attempt.status);
    const questions = attempt.answers.map((a, i) => {
        const q = byId.get(String(a.questionId));
        const answered = (a.selectedOptionIds || []).length > 0 || (a.numericalValue !== undefined && a.numericalValue !== null);
        const status = a.isCorrect === true ? "correct" : a.isCorrect === false ? "wrong" : answered && !finished ? "answered" : a.visited || a.timeSpentSec > 0 ? "skipped" : "not_visited";
        return {
            number: i + 1,
            questionId: a.questionId,
            section: sectionOf.get(String(a.questionId)) || sName.get(String(q?.subjectId)) || "",
            chapter: cName.get(String(q?.chapterId)) || "",
            topic: tName.get(String(q?.topicId)) || "",
            difficulty: q?.difficulty || "",
            status,
            markedForReview: Boolean(a.markedForReview),
            selectedOptionIds: a.selectedOptionIds || [],
            numericalValue: a.numericalValue ?? null,
            marksAwarded: a.marksAwarded || 0,
            timeSpentSec: a.timeSpentSec || 0,
            type: q?.type || "mcq_single",
            text: q?.text || "(this question was removed from the bank)",
            images: q?.images || [],
            options: q?.options || [],
            correctOptionIds: q?.correctOptionIds || [],
            numericalAnswer: q?.type === "numerical" ? q.numericalAnswer || null : null,
            explanation: q?.explanation || null,
        };
    });

    const r = attempt.result || {};
    const count = (st) => questions.filter((q) => q.status === st).length;
    res.json({
        attemptId: attempt._id,
        student: student ? { _id: student._id, name: student.name, email: student.email } : null,
        title:
            test?.title ||
            (() => {
                const names = [...new Set(questions.map((q) => q.chapter).filter(Boolean))];
                return names.length ? `${MODE_LABEL[attempt.mode] || "Practice"}: ${names.length === 1 ? names[0] : `${names[0]} + ${names.length - 1} more`}` : MODE_LABEL[attempt.mode] || "Test";
            })(),
        mode: attempt.mode,
        modeLabel: MODE_LABEL[attempt.mode] || attempt.mode,
        exam: exam?.code || "",
        testId: attempt.testId || null,
        status: attempt.status,
        startedAt: attempt.startedAt,
        submittedAt: attempt.submittedAt || null,
        summary: {
            score: r.score ?? null,
            maxScore: r.maxScore ?? null,
            percentage: r.percentage ?? null,
            accuracy: r.accuracy ?? null,
            timeTakenSec: r.timeTakenSec ?? 0,
            correct: count("correct"),
            wrong: count("wrong"),
            skipped: count("skipped"),
            notVisited: count("not_visited"),
            marked: questions.filter((q) => q.markedForReview).length,
        },
        rank: await liveRank(attempt),
        questions,
    });
});

// GET /api/admin/students/:id/live-results   (the student's live tests, by exam)
const studentLiveResults = handle("studentLiveResults", async (req, res) => {
    if (!isValidId(req.params.id)) throw userError("Invalid student id");
    res.json(await liveResultsOf(req.params.id));
});

module.exports = { listStudentAttempts, getAttemptDetail, studentLiveResults };
