// Errors from the website / app and the server, so the head lecturer can see what broke.
// The same error is kept once with a count. Each is removed 30 days after it last happened.
const mongoose = require("mongoose");

const appErrorSchema = new mongoose.Schema(
    {
        key: { type: String, required: true, unique: true }, // where + message (to group repeats)
        where: { type: String, enum: ["app", "server"], required: true },
        message: { type: String, maxlength: 500 },
        stack: { type: String, maxlength: 3000 },
        page: { type: String, maxlength: 300 },
        device: { type: String, maxlength: 300 },
        role: String,
        count: { type: Number, default: 1 },
        firstAt: { type: Date, default: Date.now },
        lastAt: { type: Date, default: Date.now },
    },
    { versionKey: false }
);
appErrorSchema.index({ lastAt: 1 }, { expireAfterSeconds: 30 * 24 * 3600 });

module.exports = mongoose.model("AppError", appErrorSchema);
