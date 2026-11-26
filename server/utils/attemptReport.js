// One report shape for every kind of attempt (live, mock, practice, assignment),
// so students and admins see the same result page for all of them.
const TestAttempt = require("../models/TestAttempt");
const Question = require("../models/Question");
const Chapter = require("../models/Chapter");
const Topic = require("../models/Topic");
const Subject = require("../models/Subject");
const Exam = require("../models/Exam");
const Test = require("../models/Test");
const { computeRank } = require("./finalizeAttempt");

const FINISHED = ["submitted", "auto_submitted"];
const KIND_LABEL = {
    live: "Live test",
    mock: "Mock test",
    practice: "Practice",
    wrong_answer_practice: "Wrong-answer practice",
    bookmark_practice: "Bookmark practice",
    assignment: "Assignment",
};

const loadQuestions = async (ids) => {
    const qs = await Question.find({ _id: { $in: ids } })
        .select("type text images options explanation chapterId topicId subjectId difficulty +correctOptionIds +numericalAnswer")
        .lean();
    const [chapters, topics] = await Promise.all([
        Chapter.find({ _id: { $in: qs.map((q) => q.chapterId) } }).select("name").lean(),
        Topic.find({ _id: { $in: qs.map((q) => q.topicId) } }).select("name").lean(),
    ]);
    const cName = new Map(chapters.map((c) => [String(c._id), c.name]));
    const tName = new Map(topics.map((t) => [String(t._id), t.name]));
    return new Map(qs.map((q) => [String(q._id), { ...q, chapter: cName.get(String(q.chapterId)) || "", topic: tName.get(String(q.topicId)) || "" }]));
};

const questionBody = (q) => ({
    type: q.type,
    text: q.text,
    images: q.images || [],
    options: q.options || [],
    chapter: q.chapter,
    topic: q.topic,
    difficulty: q.difficulty || "",
    correctOptionIds: q.correctOptionIds || [],
    correctNumericalValue: q.type === "numerical" ? q.numericalAnswer?.value ?? null : null,
    explanation: q.explanation || null,
});

// How everyone did on each question of one live test
const batchStats = async (testId) => {
    const rows = await TestAttempt.aggregate([
        { $match: { testId, status: { $in: FINISHED } } },
        { $unwind: "$answers" },
        {
            $group: {
                _id: "$answers.questionId",
                takers: { $sum: 1 },
                avgTime: { $avg: "$answers.timeSpentSec" },
                answered: { $sum: { $cond: [{ $ne: ["$answers.isCorrect", null] }, 1, 0] } },
                correct: { $sum: { $cond: [{ $eq: ["$answers.isCorrect", true] }, 1, 0] } },
            },
        },
    ]);
    return new Map(rows.map((r) => [String(r._id), r]));
};

// The page header for an attempt that is not a live test
const headFor = async (attempt) => {
    const [exam, test, assignment] = await Promise.all([
        Exam.findById(attempt.examId).select("code").lean(),
        attempt.testId ? Test.findById(attempt.testId).select("title durationMinutes").lean() : null,
        attempt.assignmentId ? require("../models/Assignment").findById(attempt.assignmentId).select("title").lean() : null,
    ]);
    return {
        _id: attempt._id,
        title: test?.title || assignment?.title || null, // practice: named after its chapters below
        exam: exam?.code || "",
        startsAt: attempt.startedAt,
        endsAt: attempt.submittedAt || attempt.startedAt,
        durationMinutes: test?.durationMinutes || 0,
        totalMarks: attempt.result?.maxScore ?? 0,
        markingScheme: attempt.markingScheme,
        showResults: "after_submit",
        closed: true,
    };
};

/**
 * Full report of a finished attempt.
 *   test: the live Test (sections give the subject order and names), or null
 *   head: page header; for non-live attempts it is worked out here
 */
const buildReport = async (attempt, { test = null, head = null } = {}) => {
    const kind = attempt.mode;
    const isLive = kind === "live" && test;
    if (!head) head = await headFor(attempt);

    const sectionOf = new Map();
    (test?.sections || []).forEach((s) => (s.questionIds || []).forEach((id) => sectionOf.set(String(id), s.name)));

    const [qs, stats, rank] = await Promise.all([
        loadQuestions(attempt.answers.map((a) => a.questionId)),
        isLive ? batchStats(test._id) : new Map(),
        isLive ? computeRank(attempt) : null,
    ]);
    const subjectIds = [...new Set(attempt.answers.map((a) => String(a.subjectId)).filter((x) => x && x !== "undefined"))];
    const subjects = await Subject.find({ _id: { $in: [...subjectIds, ...(test?.sections || []).map((s) => s.subjectId)] } }).select("name").lean();
    const subjectName = new Map(subjects.map((s) => [String(s._id), s.name]));

    const questions = attempt.answers.map((a, i) => {
        const q = qs.get(String(a.questionId));
        const st = stats.get(String(a.questionId));
        const answered = a.isCorrect !== null && a.isCorrect !== undefined;
        const visited = a.visited || a.timeSpentSec > 0 || answered;
        const status = a.isCorrect === true ? "correct" : a.isCorrect === false ? "wrong" : visited ? "skipped" : "not_visited";
        return {
            number: i + 1,
            questionId: a.questionId,
            section: sectionOf.get(String(a.questionId)) || subjectName.get(String(a.subjectId)) || subjectName.get(String(q?.subjectId)) || "",
            status,
            markedForReview: a.markedForReview,
            bonus: Boolean(a.bonus),
            selectedOptionIds: a.selectedOptionIds,
            numericalValue: a.numericalValue ?? null,
            marksAwarded: a.marksAwarded,
            timeSpentSec: a.timeSpentSec || 0,
            batch: st ? { avgTimeSec: Math.round(st.avgTime || 0), correctPct: st.takers ? Math.round((st.correct / st.takers) * 1000) / 10 : null, takers: st.takers } : null,
            ...(q ? questionBody(q) : { text: "(this question was removed)", options: [], images: [] }),
        };
    });

    // Practice has no test name: name it after its chapters
    if (!head.title) {
        const names = [...new Set(questions.map((q) => q.chapter).filter(Boolean))];
        head.title = names.length ? `${KIND_LABEL[kind] || "Practice"}: ${names.length === 1 ? names[0] : `${names[0]} + ${names.length - 1} more`}` : KIND_LABEL[kind] || "Practice";
    }

    // Subjects in the test's order, else in the order they first appear
    const sectionNames = test?.sections?.length ? test.sections.map((s) => s.name) : [...new Set(questions.map((q) => q.section).filter(Boolean))];
    const perCorrect = attempt.markingScheme?.correct ?? test?.markingScheme?.correct ?? 4;
    const sections = sectionNames.map((name) => {
        const list = questions.filter((q) => q.section === name);
        const byChapter = new Map();
        list.forEach((q) => {
            if (!q.chapter) return;
            const c = byChapter.get(q.chapter) || { name: q.chapter, correct: 0, total: 0 };
            c.total += 1;
            if (q.status === "correct") c.correct += 1;
            byChapter.set(q.chapter, c);
        });
        const weakest = [...byChapter.values()].filter((c) => c.total >= 2).sort((a, b) => a.correct / a.total - b.correct / b.total)[0] || null;
        return {
            name,
            questions: list.length,
            score: list.reduce((a, q) => a + (q.marksAwarded || 0), 0),
            maxScore: list.length * perCorrect,
            correct: list.filter((q) => q.status === "correct").length,
            wrong: list.filter((q) => q.status === "wrong").length,
            skipped: list.filter((q) => q.status === "skipped").length,
            notVisited: list.filter((q) => q.status === "not_visited").length,
            timeSec: list.reduce((a, q) => a + q.timeSpentSec, 0),
            weakestChapter: weakest,
        };
    });

    const r = attempt.result || {};
    return {
        test: head,
        kind,
        kindLabel: KIND_LABEL[kind] || "Test",
        state: "ready",
        attemptId: attempt._id,
        startedAt: attempt.startedAt,
        submittedAt: attempt.submittedAt,
        autoSubmitted: attempt.status === "auto_submitted",
        summary: {
            score: r.score,
            maxScore: r.maxScore,
            percentage: r.percentage,
            accuracy: r.accuracy,
            correct: questions.filter((q) => q.status === "correct").length,
            wrong: questions.filter((q) => q.status === "wrong").length,
            skipped: questions.filter((q) => q.status === "skipped").length,
            notVisited: questions.filter((q) => q.status === "not_visited").length,
            marked: questions.filter((q) => q.markedForReview).length,
            markedAnswered: questions.filter((q) => q.markedForReview && (q.status === "correct" || q.status === "wrong")).length,
            timeTakenSec: r.timeTakenSec || 0,
            negativeMarks: questions.filter((q) => q.status === "wrong").reduce((a, q) => a + (q.marksAwarded || 0), 0),
        },
        rank,
        sections,
        questions,
    };
};

module.exports = { buildReport, loadQuestions, questionBody, batchStats, KIND_LABEL };
