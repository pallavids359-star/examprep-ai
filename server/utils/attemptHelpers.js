const Test = require("../models/Test");
const { computeRank } = require("./finalizeAttempt");

const VALID_OPTIONS = ["A", "B", "C", "D"];

// The only question fields a student may see BEFORE submitting (no answers!)
const STUDENT_FIELDS = {
    type: 1,
    text: 1,
    images: 1,
    options: 1,
    difficulty: 1,
    subjectId: 1,
    chapterId: 1,
    topicId: 1,
};

// The "review" shown after submitting: each question with answers and explanation
const buildReview = (attempt, questionsById, extra = {}) => ({
    attemptId: attempt._id,
    mode: attempt.mode,
    status: attempt.status,
    result: attempt.result,
    ...extra,
    review: attempt.answers.map((a, index) => {
        const q = questionsById.get(String(a.questionId));
        return {
            number: index + 1,
            questionId: a.questionId,
            text: q ? q.text : "(this question was removed)",
            type: q ? q.type : null,
            images: q ? q.images : [],
            options: q ? q.options : [],
            selectedOptionIds: a.selectedOptionIds,
            correctOptionIds: a.correctOptionIds,
            numericalValue: a.numericalValue,
            correctNumericalValue: q && q.type === "numerical" ? q.numericalAnswer?.value ?? null : null,
            markedForReview: a.markedForReview,
            isCorrect: a.isCorrect,
            marksAwarded: a.marksAwarded,
            timeSpentSec: a.timeSpentSec,
            explanation: q ? q.explanation : null,
        };
    }),
});

// For mock tests: the test title and the CURRENT rank (it changes as others submit)
const mockExtras = async (attempt) => {
    if (attempt.mode === "assignment" && attempt.assignmentId) {
        const a = await require("../models/Assignment").findById(attempt.assignmentId).select("title").lean();
        return { testTitle: a ? a.title : "Assignment" };
    }
    if (!attempt.testId) return {};
    const [test, rankInfo] = await Promise.all([
        Test.findById(attempt.testId).select("title").lean(),
        computeRank(attempt),
    ]);
    return { testTitle: test ? test.title : "Mock test", rank: rankInfo };
};

module.exports = { VALID_OPTIONS, STUDENT_FIELDS, buildReview, mockExtras };