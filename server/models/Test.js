const mongoose = require("mongoose");
const { ObjectId } = mongoose.Schema.Types;

// A section groups questions, usually one per subject ("Physics", "Chemistry"...)
// Live tests add: a key, the lecturer who picks the questions, how many of each
// kind they must pick, and when they handed the section in.
const sectionSchema = new mongoose.Schema(
    {
        name: { type: String, required: true },
        subjectId: { type: ObjectId, ref: "Subject" },
        questionIds: [{ type: ObjectId, ref: "Question" }],
        key: { type: String }, // live tests: "physics", "botany"...
        lecturerId: { type: ObjectId, ref: "User" },
        mcqCount: { type: Number, min: 0, max: 200 },
        numericalCount: { type: Number, min: 0, max: 50 },
        dueAt: { type: Date },
        submittedAt: { type: Date }, // lecturer handed it in
    },
    { _id: false }
);

const testSchema = new mongoose.Schema(
    {
        title: { type: String, required: true, trim: true },
        examId: { type: ObjectId, ref: "Exam", required: true },
        type: {
            type: String,
            enum: ["chapter", "subject", "full_syllabus", "pyq", "custom", "live"],
            default: "subject",
        },
        sections: { type: [sectionSchema], default: [] },
        durationMinutes: { type: Number, required: true, min: 1, max: 360 },
        markingScheme: {
            correct: { type: Number, default: 4 },
            incorrect: { type: Number, default: -1 },
            unanswered: { type: Number, default: 0 },
        },
        totalQuestions: { type: Number, default: 0 },
        totalMarks: { type: Number, default: 0 },
        instructions: { type: String, default: "" },
        maxAttempts: { type: Number, default: 0 }, // 0 = unlimited
        availability: {
            startsAt: { type: Date },
            endsAt: { type: Date },
        },
        status: {
            type: String,
            enum: ["draft", "published", "archived"],
            default: "published",
        },
        // Live tests only
        live: {
            splitBiology: { type: Boolean, default: false },
            showResults: { type: String, enum: ["after_submit", "after_close"], default: "after_close" },
            shuffle: { type: Boolean, default: true }, // question order within each section, per student
            publishedAt: { type: Date },
        },
        createdBy: { type: ObjectId, ref: "User" },
        // Set when a student made this test for themselves (not shown to other students)
        ownerId: { type: ObjectId, ref: "User" },
        stats: {
            attempts: { type: Number, default: 0 },
            topScore: { type: Number, default: null },
        },
    },
    { timestamps: true }
);

testSchema.index({ examId: 1, status: 1, createdAt: -1 });
testSchema.index({ type: 1, "sections.lecturerId": 1 }); // a lecturer's live sections

module.exports = mongoose.model("Test", testSchema);