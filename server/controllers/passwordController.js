const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Otp = require("../models/Otp");
const sendEmail = require("../utils/sendEmail");

const CODE_MINUTES = 10;
const RESEND_SECONDS = 60;
const MAX_TRIES = 5;
const PURPOSE = "reset_password";
const GENERIC = "If an account exists for this email, a 6-digit code has been sent.";

// POST /api/auth/forgot-password   { email }
const forgotPassword = async (req, res) => {
    try {
        const email = String(req.body.email || "").toLowerCase().trim();
        if (!email) return res.status(400).json({ message: "Email is required" });

        const user = await User.findOne({ email });
        // Same reply whether or not the email exists, so nobody can test which emails are registered
        if (!user || user.status !== "active") return res.json({ message: GENERIC });

        // Allow a new code only once a minute
        const recent = await Otp.findOne({ email, purpose: PURPOSE }).sort({ createdAt: -1 });
        if (recent) {
            const waited = (Date.now() - recent.createdAt.getTime()) / 1000;
            if (waited < RESEND_SECONDS) {
                const wait = Math.ceil(RESEND_SECONDS - waited);
                return res.status(429).json({ message: `Please wait ${wait} seconds before asking for a new code` });
            }
        }

        const code = String(crypto.randomInt(100000, 1000000)); // a random 6-digit number
        await Otp.deleteMany({ email, purpose: PURPOSE }); // only the newest code works
        await Otp.create({
            email,
            purpose: PURPOSE,
            codeHash: await bcrypt.hash(code, 10),
            expiresAt: new Date(Date.now() + CODE_MINUTES * 60 * 1000),
        });

        await sendEmail({
            to: email,
            subject: "Your GenPrep password reset code",
            text: `Hi ${user.name},\n\nYour code is ${code}. It expires in ${CODE_MINUTES} minutes.\n\nIf you did not ask for this, you can ignore this email.`,
        });

        res.json({ message: GENERIC });
    } catch (error) {
        console.error("forgotPassword error:", error.message);
        res.status(500).json({ message: "Could not send the code. Please try again." });
    }
};

// POST /api/auth/reset-password   { email, otp, password }
const resetPassword = async (req, res) => {
    try {
        const email = String(req.body.email || "").toLowerCase().trim();
        const otp = String(req.body.otp || "").trim();
        const { password } = req.body;

        if (!email || !otp || !password) {
            return res.status(400).json({ message: "Email, code and new password are required" });
        }
        if (password.length < 6) {
            return res.status(400).json({ message: "Password must be at least 6 characters" });
        }

        const record = await Otp.findOne({ email, purpose: PURPOSE }).sort({ createdAt: -1 });
        if (!record || record.expiresAt < new Date()) {
            return res.status(400).json({ message: "This code has expired. Ask for a new one." });
        }
        if (record.attempts >= MAX_TRIES) {
            await Otp.deleteMany({ email, purpose: PURPOSE });
            return res.status(429).json({ message: "Too many wrong tries. Ask for a new code." });
        }

        const matches = await bcrypt.compare(otp, record.codeHash);
        if (!matches) {
            record.attempts += 1;
            await record.save();
            const left = MAX_TRIES - record.attempts;
            return res.status(400).json({
                message: left > 0 ? `Incorrect code. ${left} tries left.` : "Too many wrong tries. Ask for a new code.",
            });
        }

        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: "This code has expired. Ask for a new one." });

        user.passwordHash = await bcrypt.hash(password, 10);
        user.passwordChangedAt = new Date(); // old logins stop working
        await user.save();
        await Otp.deleteMany({ email, purpose: PURPOSE }); // a code works only once

        res.json({ message: "Password changed. You can now log in with your new password." });
    } catch (error) {
        console.error("resetPassword error:", error.message);
        res.status(500).json({ message: "Something went wrong on the server" });
    }
};

module.exports = { forgotPassword, resetPassword };