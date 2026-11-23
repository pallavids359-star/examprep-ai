// The result page of any finished attempt (live, mock, practice, assignment).
// Students get their own; admins get anyone's. Same data, same page.
const mongoose = require("mongoose");
const TestAttempt = require("../models/TestAttempt");
const Test = require("../models/Test");
const Exam = require("../models/Exam");
const User = require("../models/User");
const { buildReport } = require("../utils/attemptReport");
const { finalizeAttempt, isExpired } = require("../utils/finalizeAttempt");

const FINISHED = ["submitted", "auto_submitted"];

const reportOf = async (attempt) => {
    if (attempt.status === "in_progress") {
        if (!isExpired(attempt)) return { state: "in_progress", attemptId: attempt._id, kind: attempt.mode };
        await finalizeAttempt(attempt, null, true);
    }
    if (!FINISHED.includes(attempt.status)) return { state: "in_progress", attemptId: attempt._id, kind: attempt.mode };
    if (attempt.mode === "live" && attempt.testId) {
        const test = await Test.findById(attempt.testId).lean();
        if (test) {
            const head = {
                _id: test._id,
                title: test.title,
                exam: (await Exam.findById(test.examId).select("code").lean())?.code || "",
                startsAt: test.availability?.startsAt,
                endsAt: test.availability?.endsAt,
                durationMinutes: test.durationMinutes,
                totalMarks: test.totalMarks,
                markingScheme: test.markingScheme,
                showResults: "after_submit",
                closed: new Date() > new Date(test.availability?.endsAt),
            };
            return buildReport(attempt, { test, head });
        }
    }
    return buildReport(attempt);
};

const send = (res, error, where) => {
    if (error.status) return res.status(error.status).json({ message: error.message });
    console.error(`${where} error:`, error);
    res.status(500).json({ message: "Something went wrong on the server" });
};

// GET /api/attempts/:id/report
const myReport = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid attempt id" });
        const attempt = await TestAttempt.findOne({ _id: req.params.id, userId: req.user._id });
        if (!attempt) return res.status(404).json({ message: "Result not found" });
        res.json(await reportOf(attempt));
    } catch (error) {
        send(res, error, "myReport");
    }
};

// GET /api/admin/attempts/:id/report
const adminReport = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid attempt id" });
        const attempt = await TestAttempt.findById(req.params.id);
        if (!attempt) return res.status(404).json({ message: "Result not found" });
        const report = await reportOf(attempt);
        const student = await User.findById(attempt.userId).select("name email").lean();
        res.json({ ...report, student });
    } catch (error) {
        send(res, error, "adminReport");
    }
};

module.exports = { myReport, adminReport };
