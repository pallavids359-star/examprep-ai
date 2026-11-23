// Assignment set by a lecturer for chosen sections of a college. Untimed, open until a due date.
const mongoose = require("mongoose");
const { ObjectId } = mongoose.Schema.Types;

const assignmentSchema = new mongoose.Schema(
    {
        title: { type: String, required: true, trim: true, maxlength: 140 },
        instructions: { type: String, trim: true, maxlength: 2000, default: "" },
        examId: { type: ObjectId, ref: "Exam", required: true },
        subjectId: { type: ObjectId, ref: "Subject", required: true },
        createdBy: { type: ObjectId, ref: "User", required: true },
        // Who gets it
        college: { type: String, required: true, trim: true },
        sections: [{ type: String, enum: ["A", "B", "C", "D"] }], // empty = everyone of the college
        dueAt: { type: Date, required: true },
        // How the questions were chosen (kept so the lecturer can see it later)
        settings: {
            classLevel: { type: String, enum: ["11", "12", "both"], default: "both" },
            chapterIds: [{ type: ObjectId, ref: "Chapter" }],
            topicIds: [{ type: ObjectId, ref: "Topic" }],
            perChapter: [{ chapterId: { type: ObjectId, ref: "Chapter" }, count: Number }],
            difficulty: {
                mode: { type: String, enum: ["any", "equal", "custom"], default: "equal" },
                easy: Number,
                medium: Number,
                hard: Number,
            },
            formats: [String],
        },
        questionIds: [{ type: ObjectId, ref: "Question" }],
        status: { type: String, enum: ["draft", "published"], default: "draft" },
        publishedAt: { type: Date },
    },
    { timestamps: true }
);

assignmentSchema.index({ college: 1, status: 1, dueAt: -1 });
assignmentSchema.index({ createdBy: 1, createdAt: -1 });

module.exports = mongoose.model("Assignment", assignmentSchema);
