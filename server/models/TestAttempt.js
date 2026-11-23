const mongoose = require("mongoose");
const { ObjectId } = mongoose.Schema.Types;

// One answer per question in the attempt
const answerSchema = new mongoose.Schema(
    {
        questionId: { type: ObjectId, ref: "Question", required: true },
        subjectId: { type: ObjectId, ref: "Subject" },
        chapterId: { type: ObjectId, ref: "Chapter" },
        topicId: { type: ObjectId, ref: "Topic" },
        selectedOptionIds: { type: [String], default: [] },
        numericalValue: { type: Number },
        markedForReview: { type: Boolean, default: false },
        visited: { type: Boolean, default: false }, // opened at least once (live test report)
        timeSpentSec: { type: Number, default: 0 },
        // Filled in when the attempt is submitted
        correctOptionIds: { type: [String], default: undefined },
        isCorrect: { type: Boolean, default: null }, // null = unanswered
        marksAwarded: { type: Number, default: 0 },
    },
    { _id: false }
);

const subjectBreakdownSchema = new mongoose.Schema(
    {
        subjectId: { type: ObjectId, ref: "Subject" },
        score: Number,
        correct: Number,
        incorrect: Number,
        unanswered: Number,
    },
    { _id: false }
);

const chapterBreakdownSchema = new mongoose.Schema(
    {
        chapterId: { type: ObjectId, ref: "Chapter" },
        correct: Number,
        attempted: Number,
    },
    { _id: false }
);

const resultSchema = new mongoose.Schema(
    {
        score: Number,
        maxScore: Number,
        percentage: Number,
        accuracy: Number, // correct ÷ attempted
        correct: Number,
        incorrect: Number,
        unanswered: Number,
        timeTakenSec: Number,
        rank: Number, // mock tests only (later)
        percentile: Number, // mock tests only (later)
        subjectBreakdown: [subjectBreakdownSchema],
        chapterBreakdown: [chapterBreakdownSchema],
    },
    { _id: false }
);

const testAttemptSchema = new mongoose.Schema(
    {
        userId: { type: ObjectId, ref: "User", required: true },
        examId: { type: ObjectId, ref: "Exam", required: true },
        mode: {
            type: String,
            enum: ["mock", "practice", "wrong_answer_practice", "bookmark_practice", "live", "assignment"],
            required: true,
        },
        testId: { type: ObjectId, ref: "Test" }, // mock tests only (later)
        assignmentId: { type: ObjectId, ref: "Assignment" }, // assignments
        filters: {
            chapterId: { type: ObjectId, ref: "Chapter" },
            topicIds: [{ type: ObjectId, ref: "Topic" }],
            difficulty: String,
            count: Number,
        },
        status: {
            type: String,
            enum: ["in_progress", "submitted", "auto_submitted", "abandoned"],
            default: "in_progress",
        },
        startedAt: { type: Date, default: Date.now },
        submittedAt: { type: Date },
        expiresAt: { type: Date }, // mock tests only (later)
        markingScheme: {
            correct: { type: Number, default: 4 },
            incorrect: { type: Number, default: -1 },
            unanswered: { type: Number, default: 0 },
        },
        answers: { type: [answerSchema], default: [] },
        result: { type: resultSchema, default: undefined },
    },
    { timestamps: true }
);

testAttemptSchema.index({ userId: 1, createdAt: -1 }); // "recent tests"
testAttemptSchema.index({ testId: 1, status: 1, "result.score": -1 }); // ranking
// One live-test attempt per student (also stops a double click making two)
testAttemptSchema.index({ testId: 1, userId: 1 }, { unique: true, partialFilterExpression: { mode: "live" } });
// One attempt per student per assignment
testAttemptSchema.index({ assignmentId: 1, userId: 1 }, { unique: true, partialFilterExpression: { mode: "assignment" } });

module.exports = mongoose.model("TestAttempt", testAttemptSchema);