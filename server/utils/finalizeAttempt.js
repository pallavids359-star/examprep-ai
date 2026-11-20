const Question = require("../models/Question");
const TestAttempt = require("../models/TestAttempt");
const Test = require("../models/Test");
const scoreAttempt = require("./scoreAttempt");
const { updateProgress } = require("./updateProgress");

// Extra time allowed after the deadline, for slow internet when submitting
const GRACE_MS = 60 * 1000;

const round2 = (n) => Math.round(n * 100) / 100;

// True if a timed attempt is past its deadline (plus the grace period)
const isExpired = (attempt) =>
    Boolean(attempt.expiresAt) && Date.now() > new Date(attempt.expiresAt).getTime() + GRACE_MS;

// Loads the attempt's questions WITH their correct answers, as a Map by id
const loadQuestionsWithAnswers = async (attempt) => {
    const ids = attempt.answers.map((a) => a.questionId);
    const questions = await Question.find({ _id: { $in: ids } }).select(
        "+correctOptionIds +numericalAnswer"
    );
    return new Map(questions.map((q) => [String(q._id), q]));
};

// Rank and percentile among everyone who submitted the same mock test
const computeRank = async (attempt) => {
    if (!attempt.testId || !attempt.result) return null;

    const base = {
        testId: attempt.testId,
        status: { $in: ["submitted", "auto_submitted"] },
    };
    const [total, higher] = await Promise.all([
        TestAttempt.countDocuments(base),
        TestAttempt.countDocuments({ ...base, "result.score": { $gt: attempt.result.score } }),
    ]);

    // Percentile = share of OTHER candidates you scored at least as high as
    const percentile = total > 1 ? round2(((total - higher - 1) / (total - 1)) * 100) : 100;
    return { rank: higher + 1, totalCandidates: total, percentile };
};

/**
 * Scores and closes an attempt.
 * submittedAnswers: what the browser sent on submit
 * auto: true when time ran out; then the answers autosaved on the server are used,
 *       so nothing can be changed after the deadline.
 */
const finalizeAttempt = async (attempt, submittedAnswers, auto = false) => {
    const questionsById = await loadQuestionsWithAnswers(attempt);

    const answers =
        auto || !Array.isArray(submittedAnswers)
            ? attempt.answers.map((a) => ({
                questionId: a.questionId,
                selectedOptionIds: [...(a.selectedOptionIds || [])],
                numericalValue: a.numericalValue,
                timeSpentSec: a.timeSpentSec,
                markedForReview: a.markedForReview,
                visited: a.visited,
            }))
            : submittedAnswers;

    attempt.result = scoreAttempt(attempt, answers, questionsById);
    attempt.status = auto ? "auto_submitted" : "submitted";
    attempt.submittedAt = new Date();
    await attempt.save();

    // Progress (dashboard numbers). A failure here must not lose the result.
    try {
        await updateProgress(attempt);
    } catch (error) {
        console.error("updateProgress error:", error.message);
    }

    // Each question's "% got it right" stats
    const statUpdates = attempt.answers
        .filter((a) => a.isCorrect !== null)
        .map((a) => ({
            updateOne: {
                filter: { _id: a.questionId },
                update: { $inc: { "stats.attempts": 1, "stats.correct": a.isCorrect ? 1 : 0 } },
            },
        }));
    if (statUpdates.length > 0) await Question.bulkWrite(statUpdates);

    // Mock tests: save rank at submit time and update the test's stats
    if (attempt.testId) {
        const rankInfo = await computeRank(attempt);
        attempt.result.rank = rankInfo.rank;
        attempt.result.percentile = rankInfo.percentile;
        await attempt.save();
        await Test.updateOne(
            { _id: attempt.testId },
            { $inc: { "stats.attempts": 1 }, $max: { "stats.topScore": attempt.result.score } }
        );
    }

    return questionsById;
};

module.exports = { finalizeAttempt, computeRank, isExpired, loadQuestionsWithAnswers };