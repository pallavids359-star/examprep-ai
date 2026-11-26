// A student says a question in their test has a mistake.
// The head lecturer (admin) checks it: accept = full marks to everyone who got the question.
const mongoose = require("mongoose");
const { ObjectId } = mongoose.Schema.Types;

const REASONS = ["wrong_answer", "no_correct_option", "question_error", "image_missing", "other"];

const questionReportSchema = new mongoose.Schema(
    {
        questionId: { type: ObjectId, ref: "Question", required: true },
        attemptId: { type: ObjectId, ref: "TestAttempt", required: true },
        userId: { type: ObjectId, ref: "User", required: true },
        mode: String,
        testId: { type: ObjectId, ref: "Test" },
        assignmentId: { type: ObjectId, ref: "Assignment" },
        reason: { type: String, enum: REASONS, required: true },
        note: { type: String, trim: true, maxlength: 500, default: "" },
        status: { type: String, enum: ["open", "accepted", "rejected"], default: "open" },
        reviewedBy: { type: ObjectId, ref: "User" },
        reviewedAt: Date,
    },
    { timestamps: true }
);

// One report per question per attempt
questionReportSchema.index({ attemptId: 1, questionId: 1 }, { unique: true });
questionReportSchema.index({ status: 1, questionId: 1 });

questionReportSchema.statics.REASONS = REASONS;

module.exports = mongoose.model("QuestionReport", questionReportSchema);
