const mongoose = require("mongoose");

// Reusable shape for a Cloudinary image
const imageSchema = new mongoose.Schema(
    {
        url: { type: String, required: true },
        publicId: { type: String },
        alt: { type: String, default: "" },
    },
    { _id: false }
);

// One answer choice: A, B, C or D
const optionSchema = new mongoose.Schema(
    {
        id: { type: String, enum: ["A", "B", "C", "D"], required: true },
        text: { type: String, default: "" },
        image: { type: imageSchema, default: undefined },
    },
    { _id: false }
);

const questionSchema = new mongoose.Schema(
    {
        // Full syllabus path, filled in automatically from the topic
        examId: { type: mongoose.Schema.Types.ObjectId, ref: "Exam", required: true },
        subjectId: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true },
        chapterId: { type: mongoose.Schema.Types.ObjectId, ref: "Chapter", required: true },
        topicId: { type: mongoose.Schema.Types.ObjectId, ref: "Topic", required: true },

        type: {
            type: String,
            enum: ["mcq_single", "mcq_multi", "numerical"],
            default: "mcq_single",
        },
        text: { type: String, required: [true, "Question text is required"], trim: true },
        images: { type: [imageSchema], default: [] },
        options: { type: [optionSchema], default: [] },

        // Answers are hidden by default so they never leak to students by accident
        correctOptionIds: { type: [String], select: false },
        numericalAnswer: {
            type: {
                value: { type: Number },
                tolerance: { type: Number, default: 0 },
            },
            select: false,
        },

        explanation: {
            text: { type: String, default: "" },
            images: { type: [imageSchema], default: [] },
            videoUrl: { type: String, default: "" },
        },

        difficulty: { type: String, enum: ["easy", "medium", "hard"], default: "medium" },
        // single_correct / multi_correct / assertion_reason / match_following / statement_based / numerical
        format: { type: String, index: true },

        // Optional: overrides the exam's marking scheme for this question
        marks: {
            correct: { type: Number },
            incorrect: { type: Number },
        },

        source: {
            kind: { type: String, enum: ["original", "pyq", "ncert"], default: "original" },
            year: { type: Number },
            shift: { type: String },
            paper: { type: String },
        },

        tags: { type: [String], default: [] },

        // Updated when students submit answers (we'll use this later)
        stats: {
            attempts: { type: Number, default: 0 },
            correct: { type: Number, default: 0 },
            avgTimeSec: { type: Number, default: 0 },
        },

        status: {
            type: String,
            enum: ["draft", "published", "archived"],
            default: "draft",
        },

        // Set only for questions copied from a Supabase database (see utils/supabaseSync.js).
        // source = the database's name, id = the row's id in that database.
        external: {
            source: { type: String },
            id: { type: String },
            rowId: { type: String }, // the Supabase row id (one row can make one question per exam)
            syncedAt: { type: Date },
            editedAt: { type: Date }, // changed in GenPrep: the sync no longer overwrites it
            acceptedInSourceAt: { type: Date }, // published in GenPrep and accepted in the Question Bank Portal
            pushedAt: { type: Date }, // last GenPrep edit sent to the Question Bank Portal
        },

        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        version: { type: Number, default: 1 },
        contentEditedAt: { type: Date }, // last time someone saved it in the question editor
    },
    { timestamps: true }
);

// Makes practice question lookups fast
questionSchema.index({ examId: 1, chapterId: 1, topicId: 1, difficulty: 1, status: 1 });
// Previous-year paper lookups
questionSchema.index({ "source.kind": 1, "source.year": 1, examId: 1 });
// One GenPrep question per Supabase row
questionSchema.index(
    { "external.source": 1, "external.id": 1 },
    { unique: true, partialFilterExpression: { "external.id": { $exists: true } } }
);
questionSchema.index({ "external.source": 1, "external.rowId": 1 }, { partialFilterExpression: { "external.rowId": { $exists: true } } });
// Admin search box
questionSchema.index({ text: "text", tags: "text" });

// Keep the question type (single correct, assertion & reason, ...) up to date on every save
questionSchema.pre("save", function () {
    if (this.isNew || this.isModified("type") || this.isModified("text") || this.isModified("tags") || !this.format) {
        this.format = require("../utils/questionFormat").formatOf(this);
    }
});
module.exports = mongoose.model("Question", questionSchema);