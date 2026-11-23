const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Name is required"],
            trim: true,
            minlength: 2,
            maxlength: 60,
        },
        email: {
            type: String,
            required: [true, "Email is required"],
            unique: true,
            lowercase: true,
            trim: true,
        },
        // Students: their college, and section (A-D) for MB PU
        college: { type: String, trim: true, maxlength: 120 },
        section: { type: String, enum: ["A", "B", "C", "D"] },
        phone: {
            type: String,
            trim: true,
        },
        passwordHash: {
            type: String,
            required: true,
            select: false, // never send the password back in API responses
        },
        role: {
            type: String,
            enum: ["student", "lecturer", "admin"],
            default: "student",
        },
        // Lecturers only: the subject they teach (Botany and Zoology count as Biology)
        subject: {
            type: String,
            enum: ["physics", "chemistry", "mathematics", "biology"],
        },
        isEmailVerified: {
            type: Boolean,
            default: false,
        },
        status: {
            type: String,
            enum: ["active", "suspended"],
            default: "active",
        },
        streak: {
            current: { type: Number, default: 0 },
            longest: { type: Number, default: 0 },
            lastActiveDate: { type: Date },
        },
        classLevel: { type: String, enum: ["11", "12", "dropper"] },
        targetYear: { type: Number },
        lastLoginAt: { type: Date },
    },
    { timestamps: true } // adds createdAt and updatedAt automatically
);

module.exports = mongoose.model("User", userSchema);