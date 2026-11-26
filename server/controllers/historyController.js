const mongoose = require("mongoose");
const TestAttempt = require("../models/TestAttempt");
const Subject = require("../models/Subject");
const Chapter = require("../models/Chapter");
const Test = require("../models/Test");

const PRACTICE_MODES = ["practice", "wrong_answer_practice", "bookmark_practice"];
const MODE_LABELS = { practice: "Practice", wrong_answer_practice: "Wrong answers", bookmark_practice: "Bookmarks", mock: "Mock test", assignment: "Assignment" };
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);

// GET /api/progress/history?examId=...&mode=practice|mock|assignment
// Every finished test of one kind, with marks per subject and per chapter
const getHistory = async (req, res) => {
    try {
        const { examId, mode } = req.query;
        const filter = { userId: req.user._id, status: { $in: ["submitted", "auto_submitted"] } };
        if (mongoose.isValidObjectId(examId)) filter.examId = examId;
        filter.mode = mode === "mock" ? "mock" : mode === "assignment" ? "assignment" : { $in: PRACTICE_MODES };

        const attempts = await TestAttempt.find(filter)
            .sort({ submittedAt: -1 })
            .limit(60)
            .select("mode testId assignmentId result submittedAt startedAt")
            .lean();

        // Names for every subject, chapter and test used
        const subjectIds = new Set();
        const chapterIds = new Set();
        for (const a of attempts) {
            (a.result?.subjectBreakdown || []).forEach((s) => s.subjectId && subjectIds.add(String(s.subjectId)));
            (a.result?.chapterBreakdown || []).forEach((c) => c.chapterId && chapterIds.add(String(c.chapterId)));
        }
        const [subjects, chapters, tests, assignments] = await Promise.all([
            Subject.find({ _id: { $in: [...subjectIds] } }).select("name").lean(),
            Chapter.find({ _id: { $in: [...chapterIds] } }).select("name subjectId classLevel").lean(),
            Test.find({ _id: { $in: attempts.map((a) => a.testId).filter(Boolean) } }).select("title").lean(),
            require("../models/Assignment").find({ _id: { $in: attempts.map((a) => a.assignmentId).filter(Boolean) } }).select("title").lean(),
        ]);
        const subjectName = new Map(subjects.map((s) => [String(s._id), s.name]));
        const chapterById = new Map(chapters.map((c) => [String(c._id), c]));
        const testTitle = new Map(tests.map((t) => [String(t._id), t.title]));
        const assignmentTitle = new Map(assignments.map((x) => [String(x._id), x.title]));

        const list = attempts
            .filter((a) => a.result)
            .map((a) => {
                const r = a.result;
                const chapterRows = (r.chapterBreakdown || [])
                    .map((c) => {
                        const ch = chapterById.get(String(c.chapterId));
                        return {
                            name: ch ? ch.name : "Removed chapter",
                            subject: ch ? subjectName.get(String(ch.subjectId)) || "" : "",
                            classLevel: ch ? ch.classLevel : "",
                            correct: c.correct || 0,
                            attempted: c.attempted || 0,
                            accuracy: pct(c.correct || 0, c.attempted || 0),
                        };
                    })
                    .sort((x, y) => x.subject.localeCompare(y.subject) || x.name.localeCompare(y.name));
                const subjectRows = (r.subjectBreakdown || []).map((s) => {
                    const total = (s.correct || 0) + (s.incorrect || 0) + (s.unanswered || 0);
                    return {
                        name: subjectName.get(String(s.subjectId)) || "Subject",
                        score: s.score || 0,
                        correct: s.correct || 0,
                        incorrect: s.incorrect || 0,
                        unanswered: s.unanswered || 0,
                        total,
                        accuracy: pct(s.correct || 0, (s.correct || 0) + (s.incorrect || 0)),
                    };
                });
                const names = [...new Set(chapterRows.map((c) => c.name))];
                const title =
                    a.mode === "mock"
                        ? testTitle.get(String(a.testId)) || "Mock test"
                        : a.mode === "assignment" && assignmentTitle.get(String(a.assignmentId))
                          ? assignmentTitle.get(String(a.assignmentId))
                          : a.mode === "practice" || a.mode === "assignment"
                            ? names.slice(0, 2).join(", ") + (names.length > 2 ? ` +${names.length - 2} more` : "") || "Practice"
                            : MODE_LABELS[a.mode];
                return {
                    attemptId: a._id,
                    mode: a.mode,
                    kind: MODE_LABELS[a.mode] || a.mode,
                    title,
                    date: a.submittedAt || a.startedAt,
                    score: r.score,
                    maxScore: r.maxScore,
                    percentage: r.percentage,
                    accuracy: r.accuracy,
                    correct: r.correct,
                    incorrect: r.incorrect,
                    unanswered: r.unanswered,
                    timeTakenSec: r.timeTakenSec,
                    subjects: subjectRows,
                    chapters: chapterRows,
                };
            });

        res.json({ tests: list });
    } catch (error) {
        console.error("getHistory error:", error.message);
        res.status(500).json({ message: "Something went wrong on the server" });
    }
};

module.exports = { getHistory };