// Students report a mistake in a question during a test; the head lecturer reviews.
const mongoose = require("mongoose");
const QuestionReport = require("../models/QuestionReport");
const TestAttempt = require("../models/TestAttempt");
const Question = require("../models/Question");
const { giveFullMarks, countAffected } = require("../utils/questionBonus");

const isValidId = (id) => mongoose.isValidObjectId(id);
const fail = (res, error, where) => {
    console.error(`${where} error:`, error.message);
    res.status(500).json({ message: "Something went wrong on the server" });
};

// ---------- Student ----------

const myAttempt = async (req, res) => {
    if (!isValidId(req.params.id)) {
        res.status(400).json({ message: "Invalid attempt id" });
        return null;
    }
    const attempt = await TestAttempt.findOne({ _id: req.params.id, userId: req.user._id }).select("userId mode testId assignmentId status answers.questionId").lean();
    if (!attempt) res.status(404).json({ message: "Attempt not found" });
    return attempt;
};

// GET /api/attempts/:id/flags  -> the questions this student reported in this attempt
const myFlags = async (req, res) => {
    try {
        const attempt = await myAttempt(req, res);
        if (!attempt) return;
        const flags = await QuestionReport.find({ attemptId: attempt._id }).select("questionId reason note status").lean();
        res.json({ flags });
    } catch (error) {
        fail(res, error, "myFlags");
    }
};

// POST /api/attempts/:id/flags  { questionId, reason, note }
const flagQuestion = async (req, res) => {
    try {
        const attempt = await myAttempt(req, res);
        if (!attempt) return;
        const { questionId, reason, note = "" } = req.body || {};
        if (!isValidId(questionId) || !attempt.answers.some((a) => String(a.questionId) === String(questionId))) {
            return res.status(400).json({ message: "This question is not in your test" });
        }
        if (!QuestionReport.REASONS.includes(reason)) return res.status(400).json({ message: "Choose what is wrong with the question" });
        const existing = await QuestionReport.findOne({ attemptId: attempt._id, questionId });
        if (existing && existing.status !== "open") return res.status(400).json({ message: "This report has already been checked" });
        let flag = existing;
        if (flag) {
            flag.reason = reason;
            flag.note = String(note).slice(0, 500);
            await flag.save();
        } else {
            flag = await QuestionReport.create({ attemptId: attempt._id, questionId, userId: req.user._id, mode: attempt.mode, testId: attempt.testId, assignmentId: attempt.assignmentId, reason, note: String(note).slice(0, 500) });
        }
        res.status(existing ? 200 : 201).json({ flag: { questionId: flag.questionId, reason: flag.reason, note: flag.note, status: flag.status } });
    } catch (error) {
        fail(res, error, "flagQuestion");
    }
};

// DELETE /api/attempts/:id/flags/:questionId  -> take the report back (only while not checked)
const unflagQuestion = async (req, res) => {
    try {
        const attempt = await myAttempt(req, res);
        if (!attempt) return;
        if (!isValidId(req.params.questionId)) return res.status(400).json({ message: "Invalid question id" });
        await QuestionReport.deleteMany({ attemptId: attempt._id, questionId: req.params.questionId, status: "open" });
        res.json({ message: "Report removed" });
    } catch (error) {
        fail(res, error, "unflagQuestion");
    }
};

// ---------- Head lecturer (admin) ----------

// GET /api/admin/question-reports/count  -> open questions (for the menu badge)
const openCount = async (req, res) => {
    try {
        const ids = await QuestionReport.distinct("questionId", { status: "open" });
        res.json({ count: ids.length });
    } catch (error) {
        fail(res, error, "openCount");
    }
};

// GET /api/admin/question-reports?status=open|accepted|rejected
// One card per question, with every student's report on it
const listReports = async (req, res) => {
    try {
        const status = ["open", "accepted", "rejected"].includes(req.query.status) ? req.query.status : "open";
        const reports = await QuestionReport.find({ status })
            .sort({ createdAt: -1 })
            .limit(2000)
            .populate("userId", "name email college section")
            .populate("testId", "title")
            .populate("assignmentId", "title")
            .populate("reviewedBy", "name")
            .lean();

        const qIds = [...new Set(reports.map((r) => String(r.questionId)))];
        const questions = await Question.find({ _id: { $in: qIds } })
            .select("+correctOptionIds +numericalAnswer text type images options explanation difficulty chapterId subjectId contentEditedAt updatedBy version external.pushedAt")
            .populate("updatedBy", "name")
            .populate("chapterId", "name")
            .populate("subjectId", "name")
            .lean();
        const byId = new Map(questions.map((q) => [String(q._id), q]));

        const groups = new Map();
        for (const r of reports) {
            const key = String(r.questionId);
            const g = groups.get(key) || { questionId: key, question: byId.get(key) || null, reports: [], reasons: {}, latest: r.createdAt, first: r.createdAt, reviewedAt: r.reviewedAt || null, reviewedBy: r.reviewedBy?.name || "" };
            g.reasons[r.reason] = (g.reasons[r.reason] || 0) + 1;
            if (new Date(r.createdAt) < new Date(g.first)) g.first = r.createdAt;
            g.reports.push({
                _id: r._id,
                student: r.userId ? { name: r.userId.name, college: r.userId.college || "", section: r.userId.section || "" } : { name: "(removed student)" },
                reason: r.reason,
                note: r.note,
                mode: r.mode,
                where: r.testId?.title || r.assignmentId?.title || (r.mode === "practice" ? "Practice" : r.mode === "mock" ? "Mock test" : r.mode || ""),
                at: r.createdAt,
            });
            groups.set(key, g);
        }
        // Fixed = someone saved the question in the editor after the first report
        for (const g of groups.values()) {
            const q = g.question;
            const at = q?.contentEditedAt;
            g.fixed = at && new Date(at) > new Date(g.first) ? { at, by: q.updatedBy?.name || "", supabase: Boolean(q.external?.pushedAt && new Date(q.external.pushedAt) >= new Date(g.first)) } : null;
        }
        const list = [...groups.values()].sort((a, b) => (status === "accepted" ? Boolean(a.fixed) - Boolean(b.fixed) : 0) || b.reports.length - a.reports.length || new Date(b.latest) - new Date(a.latest));
        if (status === "open") {
            await Promise.all(list.map(async (g) => (g.affectedStudents = await countAffected(g.questionId))));
        }
        res.json({ status, questions: list });
    } catch (error) {
        fail(res, error, "listReports");
    }
};

// POST /api/admin/question-reports/:questionId/accept  -> full marks for everyone who got it
const acceptReport = async (req, res) => {
    try {
        const { questionId } = req.params;
        if (!isValidId(questionId)) return res.status(400).json({ message: "Invalid question id" });
        const open = await QuestionReport.countDocuments({ questionId, status: "open" });
        if (!open) return res.status(400).json({ message: "No open reports for this question" });

        const result = await giveFullMarks(questionId);
        await QuestionReport.updateMany({ questionId, status: "open" }, { $set: { status: "accepted", reviewedBy: req.user._id, reviewedAt: new Date() } });
        res.json({ message: `Full marks given to ${result.students} student${result.students === 1 ? "" : "s"}`, ...result });
    } catch (error) {
        fail(res, error, "acceptReport");
    }
};

// POST /api/admin/question-reports/:questionId/reject  -> the question is fine, marks stay
const rejectReport = async (req, res) => {
    try {
        const { questionId } = req.params;
        if (!isValidId(questionId)) return res.status(400).json({ message: "Invalid question id" });
        const r = await QuestionReport.updateMany({ questionId, status: "open" }, { $set: { status: "rejected", reviewedBy: req.user._id, reviewedAt: new Date() } });
        res.json({ message: "Marked as no mistake", updated: r.modifiedCount ?? r.nModified ?? 0 });
    } catch (error) {
        fail(res, error, "rejectReport");
    }
};

module.exports = { myFlags, flagQuestion, unflagQuestion, openCount, listReports, acceptReport, rejectReport };
