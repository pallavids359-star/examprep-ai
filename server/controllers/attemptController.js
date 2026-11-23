const mongoose = require("mongoose");
const TestAttempt = require("../models/TestAttempt");
const Question = require("../models/Question");
const Chapter = require("../models/Chapter");
const Topic = require("../models/Topic");
const Exam = require("../models/Exam");
const { finalizeAttempt, isExpired } = require("../utils/finalizeAttempt");
const { STUDENT_FIELDS, buildReview, mockExtras } = require("../utils/attemptHelpers");
const { saveAnswers, getAttempt } = require("./attemptSessionController");
const { readMix, sampleMixed } = require("../utils/difficultyMix");

const isValidId = (id) => mongoose.isValidObjectId(id);
const toObjectId = (id) => new mongoose.Types.ObjectId(id);

// POST /api/attempts/practice
// Body: { chapterIds: [...], topicIds: [...], difficulty, count }   (chapterId alone also works)
// A chapter with ticked concepts gives only those concepts; a chapter with none gives all of it.
const startPractice = async (req, res) => {
    try {
        const { chapterId, chapterIds, topicIds = [], difficulty = "any", count = 10 } = req.body;
        const asList = (v) => (Array.isArray(v) ? v : v ? [v] : []);
        const wanted = [...new Set([...asList(chapterIds), ...asList(chapterId)].map(String))].filter(isValidId).slice(0, 60);
        if (wanted.length === 0) return res.status(400).json({ message: "Choose at least one chapter" });

        const chapters = await Chapter.find({ _id: { $in: wanted.map(toObjectId) } });
        if (chapters.length === 0) return res.status(404).json({ message: "Chapter not found" });
        // All chapters must belong to the same exam
        const examIdOfFirst = String(chapters[0].examId);
        if (chapters.some((c) => String(c.examId) !== examIdOfFirst)) {
            return res.status(400).json({ message: "Pick chapters from one exam only" });
        }
        const exam = await Exam.findById(chapters[0].examId);

        const size = Math.min(Math.max(parseInt(count) || 10, 1), 60);

        // Ticked concepts, grouped by their chapter
        const chapterIdSet = new Set(chapters.map((c) => String(c._id)));
        const validTopicIds = asList(topicIds).filter(isValidId);
        const topics = validTopicIds.length
            ? await Topic.find({ _id: { $in: validTopicIds.map(toObjectId) } }).select("chapterId").lean()
            : [];
        const topicsByChapter = new Map();
        for (const t of topics) {
            const key = String(t.chapterId);
            if (!chapterIdSet.has(key)) continue;
            if (!topicsByChapter.has(key)) topicsByChapter.set(key, []);
            topicsByChapter.get(key).push(t._id);
        }
        const parts = chapters.map((c) =>
            topicsByChapter.has(String(c._id))
                ? { chapterId: c._id, topicId: { $in: topicsByChapter.get(String(c._id)) } }
                : { chapterId: c._id }
        );

        const match = { status: "published", $or: parts };
        let mix;
        try {
            mix = readMix(difficulty, req.body.mix);
        } catch (e) {
            return res.status(400).json({ message: e.message });
        }
        if (["easy", "medium", "hard"].includes(difficulty)) match.difficulty = difficulty;

        const sampleQs = (m, n) => (n > 0 ? Question.aggregate([{ $match: m }, { $sample: { size: n } }, { $project: STUDENT_FIELDS }]) : Promise.resolve([]));
        let questions = mix ? await sampleMixed(match, size, mix, sampleQs) : await sampleQs(match, size);
        if (mix) questions = questions.sort(() => Math.random() - 0.5);
        if (questions.length === 0) {
            return res.status(404).json({ message: "No questions found for these choices" });
        }
        const usedTopicIds = [...topicsByChapter.values()].flat();

        const markingScheme = {
            correct: exam.markingScheme.correct,
            incorrect: exam.markingScheme.incorrect,
            unanswered: exam.markingScheme.unanswered,
        };

        const attempt = await TestAttempt.create({
            userId: req.user._id,
            examId: exam._id,
            mode: "practice",
            filters: { chapterId: chapters[0]._id, topicIds: usedTopicIds, difficulty: mix ? "mixed" : difficulty, count: size },
            markingScheme,
            answers: questions.map((q) => ({
                questionId: q._id,
                subjectId: q.subjectId,
                chapterId: q.chapterId,
                topicId: q.topicId,
            })),
        });

        res.status(201).json({ attemptId: attempt._id, totalQuestions: questions.length, markingScheme, questions });
    } catch (error) {
        console.error("startPractice error:", error.message);
        res.status(500).json({ message: "Something went wrong on the server" });
    }
};

// POST /api/attempts/:id/submit
const submitAttempt = async (req, res) => {
    try {
        if (!isValidId(req.params.id)) return res.status(400).json({ message: "Invalid attempt id" });
        const attempt = await TestAttempt.findOne({ _id: req.params.id, userId: req.user._id });
        if (!attempt) return res.status(404).json({ message: "Attempt not found" });
        if (attempt.status !== "in_progress") {
            return res.status(400).json({ message: "This attempt is already submitted" });
        }

        // After the deadline, the browser's answers are ignored and the last autosave is used
        const timeUp = isExpired(attempt);
        const questionsById = await finalizeAttempt(attempt, req.body.answers, timeUp);

        // Live tests: no answers here; the report page shows them when the head allows
        if (attempt.mode === "live") {
            return res.json({ message: timeUp ? "Time was up, so your last saved answers were submitted" : "Submitted", attemptId: attempt._id, mode: "live", status: attempt.status, testId: attempt.testId });
        }

        res.json({
            message: timeUp ? "Time was up, so your last saved answers were submitted" : "Submitted",
            ...buildReview(attempt, questionsById, await mockExtras(attempt)),
        });
    } catch (error) {
        console.error("submitAttempt error:", error.message);
        res.status(500).json({ message: "Something went wrong on the server" });
    }
};

module.exports = { startPractice, saveAnswers, submitAttempt, getAttempt };