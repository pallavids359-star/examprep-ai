const mongoose = require("mongoose");
const Subject = require("../models/Subject");
const Chapter = require("../models/Chapter");
const Topic = require("../models/Topic");
const Question = require("../models/Question");
const Test = require("../models/Test");
const User = require("../models/User");
const TestAttempt = require("../models/TestAttempt");
const Exam = require("../models/Exam");
const { getHistory } = require("./historyController");

const isValidId = (id) => mongoose.isValidObjectId(id);
const slugify = (text) => text.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

// An error whose message is safe to show to the user
const userError = (message, status = 400) => Object.assign(new Error(message), { status });

// Wraps a handler so every error becomes a clean JSON reply
const handle = (where, fn) => async (req, res) => {
    try {
        await fn(req, res);
    } catch (error) {
        if (error.status) return res.status(error.status).json({ message: error.message });
        console.error(`${where} error:`, error.message);
        res.status(500).json({ message: "Something went wrong on the server" });
    }
};

// POST /api/admin/chapters   { subjectId, name, classLevel }
const createChapter = handle("createChapter", async (req, res) => {
    const { subjectId, name, classLevel = "11" } = req.body;
    if (!isValidId(subjectId)) throw userError("Choose a subject");
    if (!name || !name.trim()) throw userError("Chapter name is required");
    if (!["11", "12"].includes(String(classLevel))) throw userError("Class must be 11 or 12");

    const subject = await Subject.findById(subjectId);
    if (!subject) throw userError("Subject not found", 404);

    const slug = slugify(name);
    const existing = await Chapter.findOne({ subjectId, slug });
    if (existing && existing.isActive) throw userError("A chapter with this name already exists", 409);
    if (existing) {
        // It was hidden before: bring it back
        Object.assign(existing, { isActive: true, name: name.trim(), classLevel: String(classLevel) });
        await existing.save();
        return res.status(201).json({ message: "Chapter restored", chapter: existing });
    }

    const order = await Chapter.countDocuments({ subjectId });
    const chapter = await Chapter.create({
        examId: subject.examId,
        subjectId,
        name: name.trim(),
        slug,
        classLevel: String(classLevel),
        order,
    });
    res.status(201).json({ message: "Chapter added", chapter });
});

// PUT /api/admin/chapters/:id   { name, classLevel }
const updateChapter = handle("updateChapter", async (req, res) => {
    if (!isValidId(req.params.id)) throw userError("Invalid chapter id");
    const chapter = await Chapter.findById(req.params.id);
    if (!chapter) throw userError("Chapter not found", 404);

    const { name, classLevel } = req.body;
    if (name && name.trim()) {
        const slug = slugify(name);
        const clash = await Chapter.findOne({ subjectId: chapter.subjectId, slug, _id: { $ne: chapter._id } });
        if (clash) throw userError("Another chapter already has this name", 409);
        chapter.name = name.trim();
        chapter.slug = slug;
    }
    if (classLevel) {
        if (!["11", "12"].includes(String(classLevel))) throw userError("Class must be 11 or 12");
        chapter.classLevel = String(classLevel);
    }
    await chapter.save();
    res.json({ message: "Chapter updated", chapter });
});

// DELETE /api/admin/chapters/:id   (hidden, so old results keep working)
const deleteChapter = handle("deleteChapter", async (req, res) => {
    if (!isValidId(req.params.id)) throw userError("Invalid chapter id");
    const chapter = await Chapter.findByIdAndUpdate(req.params.id, { isActive: false });
    if (!chapter) throw userError("Chapter not found", 404);
    res.json({ message: "Chapter removed" });
});

// POST /api/admin/topics   { chapterId, name }
const createTopic = handle("createTopic", async (req, res) => {
    const { chapterId, name } = req.body;
    if (!isValidId(chapterId)) throw userError("Choose a chapter");
    if (!name || !name.trim()) throw userError("Topic name is required");

    const chapter = await Chapter.findById(chapterId);
    if (!chapter) throw userError("Chapter not found", 404);

    const slug = slugify(name);
    const existing = await Topic.findOne({ chapterId, slug });
    if (existing && existing.isActive) throw userError("A topic with this name already exists", 409);
    if (existing) {
        Object.assign(existing, { isActive: true, name: name.trim() });
        await existing.save();
        return res.status(201).json({ message: "Topic restored", topic: existing });
    }

    const order = await Topic.countDocuments({ chapterId });
    const topic = await Topic.create({
        examId: chapter.examId,
        subjectId: chapter.subjectId,
        chapterId,
        name: name.trim(),
        slug,
        order,
    });
    res.status(201).json({ message: "Topic added", topic });
});

// DELETE /api/admin/topics/:id
const deleteTopic = handle("deleteTopic", async (req, res) => {
    if (!isValidId(req.params.id)) throw userError("Invalid topic id");
    const topic = await Topic.findByIdAndUpdate(req.params.id, { isActive: false });
    if (!topic) throw userError("Topic not found", 404);
    res.json({ message: "Topic removed" });
});

// GET /api/admin/students?search=ravi
const listStudents = handle("listStudents", async (req, res) => {
    const filter = { role: "student" };
    const search = (req.query.search || "").trim();
    if (search) {
        const safe = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // treat the search as plain text
        filter.$or = [{ name: { $regex: safe, $options: "i" } }, { email: { $regex: safe, $options: "i" } }];
    }
    const students = await User.find(filter)
        .sort({ createdAt: -1 })
        .limit(100)
        .select("name email status createdAt lastLoginAt")
        .lean();

    const counts = await TestAttempt.aggregate([
        { $match: { userId: { $in: students.map((s) => s._id) }, status: { $in: ["submitted", "auto_submitted"] } } },
        { $group: { _id: "$userId", tests: { $sum: 1 } } },
    ]);
    const testsById = new Map(counts.map((c) => [String(c._id), c.tests]));
    res.json({ students: students.map((s) => ({ ...s, testsTaken: testsById.get(String(s._id)) || 0 })) });
});

// GET /api/admin/students/:id
// One student, plus how many finished tests they have in each exam (for the exam switcher)
const getStudent = handle("getStudent", async (req, res) => {
    if (!isValidId(req.params.id)) throw userError("Invalid student id");
    const student = await User.findOne({ _id: req.params.id, role: "student" })
        .select("name email status createdAt lastLoginAt")
        .lean();
    if (!student) throw userError("Student not found", 404);

    const [exams, counts] = await Promise.all([
        Exam.find().sort({ order: 1, code: 1 }).select("code name").lean(),
        TestAttempt.aggregate([
            { $match: { userId: student._id, status: { $in: ["submitted", "auto_submitted"] } } },
            { $group: { _id: "$examId", tests: { $sum: 1 }, last: { $max: "$submittedAt" } } },
        ]),
    ]);
    const byExam = new Map(counts.map((c) => [String(c._id), c]));
    res.json({
        student,
        exams: exams.map((e) => ({ ...e, tests: byExam.get(String(e._id))?.tests || 0, lastTestAt: byExam.get(String(e._id))?.last || null })),
    });
});

// GET /api/admin/students/:id/history?examId=...&mode=practice|mock
// The same data the student's own Analytics page shows, for this student
const getStudentHistory = async (req, res) => {
    if (!isValidId(req.params.id)) return res.status(400).json({ message: "Invalid student id" });
    const student = await User.findOne({ _id: req.params.id, role: "student" }).select("_id").lean();
    if (!student) return res.status(404).json({ message: "Student not found" });
    return getHistory({ ...req, query: req.query, user: { _id: student._id } }, res);
};

// PUT /api/admin/students/:id/status   { status: "active" | "suspended" }
const setStudentStatus = handle("setStudentStatus", async (req, res) => {
    const { status } = req.body;
    if (!isValidId(req.params.id)) throw userError("Invalid student id");
    if (!["active", "suspended"].includes(status)) throw userError("Status must be active or suspended");
    const student = await User.findOneAndUpdate(
        { _id: req.params.id, role: "student" },
        { status },
        { returnDocument: "after" }
    ).select("name email status");
    if (!student) throw userError("Student not found", 404);
    res.json({ message: `Student ${status === "active" ? "activated" : "suspended"}`, student });
});

// GET /api/admin/overview   (numbers for the admin home page)
const getOverview = handle("getOverview", async (req, res) => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const [students, questions, drafts, tests, attemptsToday] = await Promise.all([
        User.countDocuments({ role: "student" }),
        Question.countDocuments({ status: "published" }),
        Question.countDocuments({ status: "draft" }),
        Test.countDocuments({ status: "published" }),
        TestAttempt.countDocuments({ submittedAt: { $gte: startOfToday } }),
    ]);
    res.json({ students, questions, drafts, tests, attemptsToday });
});

module.exports = {
    createChapter,
    updateChapter,
    deleteChapter,
    createTopic,
    deleteTopic,
    listStudents,
    getStudent,
    getStudentHistory,
    setStudentStatus,
    getOverview,
};