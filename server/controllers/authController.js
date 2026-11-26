const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { normalizeCollege } = require("../utils/college");

// Creates a login token that expires in 7 days
const createToken = (userId, role) => {
    return jwt.sign({ id: userId, role }, process.env.JWT_SECRET, {
        expiresIn: "7d",
    });
};

// Shapes the user data we send back (never the password)
const publicUser = (user) => ({
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    college: user.college || "",
    section: user.section || "",
});

const DEFAULT_COLLEGE = "MBPU";

// POST /api/auth/register
const register = async (req, res) => {
    try {
        const { name, email, password, phone } = req.body;
        const college = normalizeCollege(req.body.college || DEFAULT_COLLEGE);
        const section = String(req.body.section || "").trim().toUpperCase();
        if (!college) return res.status(400).json({ message: "Please choose your college" });
        if (college === DEFAULT_COLLEGE && !["A", "B", "C", "D"].includes(section)) {
            return res.status(400).json({ message: "Please choose your section (A, B, C or D)" });
        }

        if (!name || !email || !password) {
            return res
                .status(400)
                .json({ message: "Name, email and password are required" });
        }

        if (password.length < 6) {
            return res
                .status(400)
                .json({ message: "Password must be at least 6 characters" });
        }

        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(409).json({ message: "Email is already registered" });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const user = await User.create({ name, email, phone, passwordHash, college, ...(college === DEFAULT_COLLEGE ? { section } : {}) });

        res.status(201).json({
            message: "Registration successful",
            token: createToken(user._id, user.role),
            user: publicUser(user),
        });
    } catch (error) {
        console.error("Register error:", error.message);
        res.status(500).json({ message: "Something went wrong on the server" });
    }
};

// Wrong passwords per email: 10 tries per 15 minutes, whatever network they come from
const FAIL_WINDOW = 15 * 60 * 1000;
const MAX_FAILS = 10;
const fails = new Map(); // email -> { count, resetAt }
const tooManyFails = (email) => {
    const f = fails.get(email);
    return Boolean(f && f.resetAt > Date.now() && f.count >= MAX_FAILS);
};
const noteFail = (email) => {
    const now = Date.now();
    const f = fails.get(email);
    if (!f || f.resetAt <= now) fails.set(email, { count: 1, resetAt: now + FAIL_WINDOW });
    else f.count += 1;
    if (fails.size > 50000) fails.clear(); // never grow without limit
};

// POST /api/auth/login
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // 1. Check both fields are filled
        if (!email || !password) {
            return res
                .status(400)
                .json({ message: "Email and password are required" });
        }

        if (typeof email !== "string" || typeof password !== "string") {
            return res.status(400).json({ message: "Email and password are required" });
        }
        const key = email.trim().toLowerCase();
        if (tooManyFails(key)) {
            return res.status(429).json({ message: "Too many wrong passwords for this email. Wait 15 minutes, or use Forgot password." });
        }

        // 2. Find the user. "+passwordHash" asks for the hidden password field.
        const user = await User.findOne({ email: key }).select(
            "+passwordHash"
        );

        // 3. Compare the typed password with the scrambled one
        const passwordMatches =
            user && typeof user.passwordHash === "string" && (await bcrypt.compare(String(password), user.passwordHash));

        // Same message for both cases, so attackers can't tell which emails exist
        if (!passwordMatches) {
            noteFail(key);
            return res.status(401).json({ message: "Invalid email or password" });
        }
        fails.delete(key);

        // 4. Block suspended accounts
        if (user.status !== "active") {
            return res
                .status(403)
                .json({ message: "Your account is suspended. Contact support." });
        }

        // 5. Remember when they last logged in
        user.lastLoginAt = new Date();
        await user.save();

        res.json({
            message: "Login successful",
            token: createToken(user._id, user.role),
            user: publicUser(user),
        });
    } catch (error) {
        console.error("Login error:", error.message);
        res.status(500).json({ message: "Something went wrong on the server" });
    }
};

// GET /api/auth/me (only for logged-in users)
const getMe = async (req, res) => {
    // req.user was filled in by the auth middleware
    res.json({ user: publicUser(req.user) });
};

// DELETE /api/auth/account   body: { password }
// A student deletes their own account and everything saved for it (Google Play rule).
const deleteAccount = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select("+passwordHash");
        if (!user) return res.status(404).json({ message: "Account not found" });
        if (user.role !== "student") {
            return res.status(403).json({ message: "Lecturer and admin accounts are removed by the head lecturer." });
        }
        const { password } = req.body || {};
        if (typeof password !== "string" || !(await bcrypt.compare(password, user.passwordHash))) {
            return res.status(400).json({ message: "Your password is not correct" });
        }

        const TestAttempt = require("../models/TestAttempt");
        const Progress = require("../models/Progress");
        const Bookmark = require("../models/Bookmark");
        const QuestionReport = require("../models/QuestionReport");
        const Otp = require("../models/Otp");
        await Promise.all([
            TestAttempt.deleteMany({ userId: user._id }),
            Progress.deleteMany({ userId: user._id }),
            Bookmark.deleteMany({ userId: user._id }),
            QuestionReport.deleteMany({ userId: user._id }),
            Otp.deleteMany({ email: user.email }),
        ]);
        await User.deleteOne({ _id: user._id });
        console.log(`Account deleted by the student: ${user._id}`);
        res.json({ message: "Your account and all your data have been deleted." });
    } catch (error) {
        console.error("deleteAccount error:", error.message);
        res.status(500).json({ message: "Something went wrong on the server" });
    }
};

module.exports = { register, login, getMe, deleteAccount, createToken };