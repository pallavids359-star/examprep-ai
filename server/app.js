// The Express app, without starting a server.
// - Locally, index.js imports this and calls app.listen().
// - On Vercel, api/index.js imports this and Vercel runs it as a function.
require("dotenv").config();

const express = require("express");
const connectDB = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const examRoutes = require("./routes/examRoutes");
const adminRoutes = require("./routes/adminRoutes");
const attemptRoutes = require("./routes/attemptRoutes");
const progressRoutes = require("./routes/progressRoutes");
const bookmarkRoutes = require("./routes/bookmarkRoutes");
const testRoutes = require("./routes/testRoutes");
const syncRoutes = require("./routes/syncRoutes");
const liveRoutes = require("./routes/liveRoutes");

const {
    securityHeaders,
    rateLimit,
    apiNotFound,
    errorHandler
} = require("./middleware/security");

const missingEnv = ["MONGO_URI", "JWT_SECRET"].filter((key) => !process.env[key]);
if (missingEnv.length) {
    console.error(`Missing environment variable(s): ${missingEnv.join(", ")}`);
}

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(securityHeaders);
app.use(express.json({ limit: "4mb" })); // Vercel rejects request bodies over 4.5 MB

// Health check (does not need the database)
app.get("/", (req, res) => {
    res.send("GenPrep API is running. Try /api/health");
});

app.get("/api/health", (req, res) => {
    res.json({
        status: missingEnv.length ? "misconfigured" : "ok",
        message: missingEnv.length
            ? `Missing environment variable(s): ${missingEnv.join(", ")}`
            : "GenPrep server is running"
    });
});

// Stop early with a clear message if settings are missing
app.use("/api", (req, res, next) => {
    if (missingEnv.length) {
        return res.status(500).json({ message: "Server is not configured. Check environment variables." });
    }
    next();
});

// Make sure the database is connected before any API route runs
app.use("/api", async (req, res, next) => {
    try {
        await connectDB();
        next();
    } catch (error) {
        res.status(503).json({ message: "Could not connect to the database. Please try again." });
    }
});

// Supabase webhooks and the Vercel cron. Mounted before the general rate limit:
// a bulk insert in Supabase fires one webhook per row, all from the same address.
app.use("/api/sync", syncRoutes);

// Authentication rate limits
const authLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: "Too many attempts. Please wait 15 minutes and try again."
});

app.use("/api/auth/login", authLimit);
app.use("/api/auth/register", authLimit);
app.use("/api/auth/forgot-password", authLimit);
app.use("/api/auth/reset-password", authLimit);

// General API rate limit
app.use("/api", rateLimit({
    windowMs: 60 * 1000,
    max: 300,
    message: "Too many requests. Please slow down for a minute."
}));

// API routes
app.use("/api/auth", authRoutes);
app.use("/api", examRoutes);
app.use("/api/admin", liveRoutes.adminRouter); // live tests and lecturers
app.use("/api/admin", adminRoutes);
app.use("/api/lecturer", liveRoutes.lecturerRouter);
app.use("/api/live-tests", liveRoutes.studentRouter);
app.use("/api/attempts", attemptRoutes);
app.use("/api/progress", progressRoutes);
app.use("/api/bookmarks", bookmarkRoutes);
app.use("/api/tests", testRoutes);

// Error handling
app.use("/api", apiNotFound);
app.use(errorHandler);

module.exports = app;
