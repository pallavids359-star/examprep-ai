// When a reported question is accepted as wrong: full marks for that question
// to every student who got it in any test, and their results are worked out again.
const TestAttempt = require("../models/TestAttempt");
const scoreAttempt = require("./scoreAttempt");
const { loadQuestionsWithAnswers, computeRank } = require("./finalizeAttempt");

const FINISHED = ["submitted", "auto_submitted"];

// The answers as they were saved, in the shape scoreAttempt expects
const storedAnswers = (attempt) =>
    attempt.answers.map((a) => ({
        questionId: a.questionId,
        selectedOptionIds: [...(a.selectedOptionIds || [])],
        numericalValue: a.numericalValue,
        timeSpentSec: a.timeSpentSec,
        markedForReview: a.markedForReview,
        visited: a.visited,
    }));

// Re-marks one finished attempt; keeps time taken, rank and percentile fields
const rescore = async (attempt) => {
    const questionsById = await loadQuestionsWithAnswers(attempt);
    const old = attempt.result || {};
    const next = scoreAttempt(attempt, storedAnswers(attempt), questionsById);
    next.timeTakenSec = old.timeTakenSec ?? next.timeTakenSec;
    if (old.rank !== undefined) next.rank = old.rank;
    if (old.percentile !== undefined) next.percentile = old.percentile;
    attempt.result = next;
};

/**
 * Gives full marks for questionId to every attempt that has it.
 * Returns { students, finished, inProgress } counts.
 */
const giveFullMarks = async (questionId) => {
    const attempts = await TestAttempt.find({
        "answers.questionId": questionId,
        status: { $in: [...FINISHED, "in_progress"] },
    });

    let finished = 0;
    let inProgress = 0;
    const users = new Set();
    const mockTests = new Set();

    for (const attempt of attempts) {
        const answer = attempt.answers.find((a) => String(a.questionId) === String(questionId));
        if (!answer || answer.bonus) continue;
        answer.bonus = true;
        users.add(String(attempt.userId));
        if (FINISHED.includes(attempt.status)) {
            await rescore(attempt);
            finished++;
            if (attempt.testId && attempt.mode === "mock") mockTests.add(String(attempt.testId));
        } else {
            inProgress++; // marked when they submit
        }
        attempt.markModified("answers");
        await attempt.save();
    }

    // Mock tests keep a saved rank: work it out again for everyone in that test
    for (const testId of mockTests) {
        const all = await TestAttempt.find({ testId, mode: "mock", status: { $in: FINISHED } });
        for (const a of all) {
            const r = await computeRank(a);
            if (!r) continue;
            a.result.rank = r.rank;
            a.result.percentile = r.percentile;
            a.markModified("result");
            await a.save();
        }
    }

    return { students: users.size, finished, inProgress };
};

// How many attempts would get full marks (shown before the head lecturer accepts)
const countAffected = async (questionId) => {
    const ids = await TestAttempt.distinct("userId", {
        "answers.questionId": questionId,
        status: { $in: [...FINISHED, "in_progress"] },
    });
    return ids.length;
};

module.exports = { giveFullMarks, countAffected, rescore };
