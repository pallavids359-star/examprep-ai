const mongoose = require("mongoose");
const TestAttempt = require("../models/TestAttempt");
const Question = require("../models/Question");
const Test = require("../models/Test");
const { finalizeAttempt, isExpired, loadQuestionsWithAnswers } = require("../utils/finalizeAttempt");
const { VALID_OPTIONS, STUDENT_FIELDS, buildReview, mockExtras } = require("../utils/attemptHelpers");

const isValidId = (id) => mongoose.isValidObjectId(id);

// PUT /api/attempts/:id/answers   (autosave while the student works)
const saveAnswers = async (req, res) => {
    try {
        if (!isValidId(req.params.id)) return res.status(400).json({ message: "Invalid attempt id" });
        const attempt = await TestAttempt.findOne({ _id: req.params.id, userId: req.user._id });
        if (!attempt) return res.status(404).json({ message: "Attempt not found" });
        if (attempt.status !== "in_progress") {
            return res.status(400).json({ message: "This attempt is already submitted" });
        }

        // Too late: submit what was saved before the deadline
        if (isExpired(attempt)) {
            await finalizeAttempt(attempt, null, true);
            return res.status(409).json({ message: "Time is up. Your test was submitted automatically." });
        }

        const given = new Map((req.body.answers || []).map((a) => [String(a.questionId), a]));
        for (const answer of attempt.answers) {
            const g = given.get(String(answer.questionId));
            if (!g) continue;
            answer.selectedOptionIds = [...new Set((g.selectedOptionIds || []).filter((x) => VALID_OPTIONS.includes(x)))];
            if (typeof g.numericalValue === "number") answer.numericalValue = g.numericalValue;
            answer.markedForReview = Boolean(g.markedForReview);
            answer.timeSpentSec = Math.max(0, Number(g.timeSpentSec) || 0);
            answer.visited = Boolean(answer.visited || g.visited);
        }
        await attempt.save();
        res.json({ message: "Saved", savedAt: new Date() });
    } catch (error) {
        console.error("saveAnswers error:", error.message);
        res.status(500).json({ message: "Something went wrong on the server" });
    }
};

// GET /api/attempts/:id
const getAttempt = async (req, res) => {
    try {
        if (!isValidId(req.params.id)) return res.status(400).json({ message: "Invalid attempt id" });
        const attempt = await TestAttempt.findOne({ _id: req.params.id, userId: req.user._id });
        if (!attempt) return res.status(404).json({ message: "Attempt not found" });

        // A timed test left open past its deadline is submitted automatically
        if (attempt.status === "in_progress" && isExpired(attempt)) {
            await finalizeAttempt(attempt, null, true);
        }

        // Live tests: the result lives on the live report page (it may still be hidden)
        if (attempt.mode === "live" && attempt.status !== "in_progress") {
            return res.json({ attemptId: attempt._id, mode: "live", status: attempt.status, testId: attempt.testId });
        }

        if (attempt.status === "in_progress") {
            const ids = attempt.answers.map((a) => a.questionId);
            const questions = await Question.find({ _id: { $in: ids } })
                .select(Object.keys(STUDENT_FIELDS).join(" "))
                .lean();
            const byId = new Map(questions.map((q) => [String(q._id), q]));
            const test = attempt.testId ? await Test.findById(attempt.testId).select("title instructions").lean() : null;

            return res.json({
                attemptId: attempt._id,
                mode: attempt.mode,
                status: attempt.status,
                markingScheme: attempt.markingScheme,
                testTitle: test ? test.title : null,
                instructions: test ? test.instructions : "",
                startedAt: attempt.startedAt,
                expiresAt: attempt.expiresAt || null,
                serverNow: new Date(),
                questions: ids.map((id) => byId.get(String(id))).filter(Boolean),
                savedAnswers: attempt.answers.map((a) => ({
                    questionId: a.questionId,
                    selectedOptionIds: a.selectedOptionIds,
                    numericalValue: a.numericalValue,
                    markedForReview: a.markedForReview,
                    timeSpentSec: a.timeSpentSec,
                })),
            });
        }

        const questionsById = await loadQuestionsWithAnswers(attempt);
        res.json(buildReview(attempt, questionsById, await mockExtras(attempt)));
    } catch (error) {
        console.error("getAttempt error:", error.message);
        res.status(500).json({ message: "Something went wrong on the server" });
    }
};

module.exports = { saveAnswers, getAttempt };