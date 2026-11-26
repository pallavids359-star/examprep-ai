const mongoose = require("mongoose");
const Question = require("../models/Question");
const Topic = require("../models/Topic");
const Chapter = require("../models/Chapter");
const { acceptInSupabase } = require("../utils/supabaseWriter");

const isValidId = (id) => mongoose.isValidObjectId(id);

// Only these fields can be set by the admin. Everything else is ignored,
// so nobody can sneak in fields like "stats" or "createdBy".
const ALLOWED_FIELDS = [
    "type",
    "text",
    "images",
    "options",
    "correctOptionIds",
    "numericalAnswer",
    "explanation",
    "difficulty",
    "marks",
    "source",
    "tags",
    "status",
];

const pickAllowed = (body) => {
    const result = {};
    for (const field of ALLOWED_FIELDS) {
        if (body[field] !== undefined) result[field] = body[field];
    }
    // Accept "C" as well as ["C"]
    if (typeof result.correctOptionIds === "string") {
        result.correctOptionIds = [result.correctOptionIds];
    }
    return result;
};

// Checks the question makes sense. Returns an error message, or null if OK.
const validateQuestion = (q) => {
    const type = q.type || "mcq_single";

    if (!q.text || !q.text.trim()) return "Question text is required";

    if (type === "numerical") {
        if (!q.numericalAnswer || typeof q.numericalAnswer.value !== "number") {
            return "Numerical questions need numericalAnswer.value";
        }
        return null;
    }

    // MCQ checks
    if (!Array.isArray(q.options) || q.options.length !== 4) {
        return "MCQ questions need exactly 4 options";
    }

    const ids = q.options.map((o) => o.id).join("");
    if (ids !== "ABCD") return "Option ids must be A, B, C, D in that order";

    const emptyOption = q.options.find((o) => !(o.text && o.text.trim()) && !o.image);
    if (emptyOption) return `Option ${emptyOption.id} needs text or an image`;

    const correct = q.correctOptionIds || [];
    if (correct.length === 0) return "Choose at least one correct option";

    const badId = correct.find((id) => !["A", "B", "C", "D"].includes(id));
    if (badId) return `Correct option "${badId}" must be A, B, C or D`;

    if (type === "mcq_single" && correct.length !== 1) {
        return "A single-correct question must have exactly one correct option";
    }

    return null;
};

// POST /api/admin/questions
const createQuestion = async (req, res) => {
    try {
        const { topicId } = req.body;

        if (!isValidId(topicId)) {
            return res.status(400).json({ message: "A valid topicId is required" });
        }

        // Find the topic so we can fill in exam, subject and chapter automatically
        const topic = await Topic.findById(topicId);
        if (!topic) {
            return res.status(404).json({ message: "Topic not found" });
        }

        const data = {
            ...pickAllowed(req.body),
            topicId: topic._id,
            chapterId: topic.chapterId,
            subjectId: topic.subjectId,
            examId: topic.examId,
            createdBy: req.user._id,
            updatedBy: req.user._id,
        };

        const error = validateQuestion(data);
        if (error) return res.status(400).json({ message: error });

        const question = await Question.create(data);

        res.status(201).json({ message: "Question created", question });
    } catch (error) {
        console.error("createQuestion error:", error.message);
        res.status(500).json({ message: "Something went wrong on the server" });
    }
};

// GET /api/admin/questions?examId=&subjectId=&classLevel=&chapterId=&topicId=&qtype=&difficulty=&status=&q=&page=1&limit=20
const QTYPE_RULES = {
    assertion: { $or: [{ tags: /assert/i }, { text: /Assertion\s*(\(A\))?\s*:/i }] },
    match: { $or: [{ tags: /match/i }, { text: /(column|list)[\s\-–]*(I|1)\b/i }] },
    statement: { text: /Statement[\s\-–]*(I|1)\b/i },
};
const listQuestions = async (req, res) => {
    try {
        const { examId, subjectId, chapterId, topicId, difficulty, status, classLevel, qtype } = req.query;

        const filter = {};
        const and = [];
        if (isValidId(examId)) filter.examId = examId;
        if (isValidId(subjectId)) filter.subjectId = subjectId;
        if (isValidId(chapterId)) filter.chapterId = chapterId;
        else if (classLevel === "11" || classLevel === "12") {
            // Only chapters of that class
            const chapterFilter = { classLevel };
            if (filter.examId) chapterFilter.examId = filter.examId;
            if (filter.subjectId) chapterFilter.subjectId = filter.subjectId;
            const ids = await Chapter.find(chapterFilter).distinct("_id");
            filter.chapterId = { $in: ids };
        }
        if (isValidId(topicId)) filter.topicId = topicId;
        if (difficulty) filter.difficulty = difficulty;

        // Question type
        if (qtype === "numerical") filter.type = "numerical";
        else if (qtype === "multi") filter.type = "mcq_multi";
        else if (QTYPE_RULES[qtype]) and.push(QTYPE_RULES[qtype]);
        else if (qtype === "mcq") {
            filter.type = "mcq_single";
            and.push({ $nor: Object.values(QTYPE_RULES).flatMap((r) => r.$or || [r]) });
        }

        const search = String(req.query.q || "").trim().slice(0, 100);
        if (search) {
            const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
            and.push({ $or: [{ text: rx }, { tags: rx }] });
        }
        if (and.length) filter.$and = and;
        // Hide deleted (archived) questions unless asked for
        filter.status = status || { $ne: "archived" };

        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const limit = Math.min(parseInt(req.query.limit) || 20, 50);

        const [questions, total] = await Promise.all([
            Question.find(filter)
                .select("+correctOptionIds +numericalAnswer") // admins can see answers
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit),
            Question.countDocuments(filter),
        ]);

        res.json({ questions, total, page, pages: Math.ceil(total / limit) });
    } catch (error) {
        console.error("listQuestions error:", error.message);
        res.status(500).json({ message: "Something went wrong on the server" });
    }
};
// POST /api/admin/questions/status   { ids: [...], status: "published" | "archived" }
// Publish (or delete) many questions at once — used on the Draft questions page.
// Marked as edited, so the next Supabase sync keeps the admin's choice.
const setQuestionsStatus = async (req, res) => {
    try {
        const status = req.body.status;
        if (!["published", "archived", "draft"].includes(status)) return res.status(400).json({ message: "Status must be published, draft or archived" });
        const ids = (Array.isArray(req.body.ids) ? req.body.ids : []).filter(isValidId).slice(0, 500);
        if (!ids.length) return res.status(400).json({ message: "Choose at least one question" });
        const now = new Date();
        const [plain, synced] = await Promise.all([
            Question.updateMany({ _id: { $in: ids }, "external.id": { $exists: false } }, { $set: { status } }),
            Question.updateMany({ _id: { $in: ids }, "external.id": { $exists: true } }, { $set: { status, "external.editedAt": now } }),
        ]);
        // Published in GenPrep → accepted in the main Supabase (only if write-back is switched on)
        const supabase = status === "published" ? await acceptInSupabase(ids) : { enabled: false };
        res.json({ updated: plain.modifiedCount + synced.modifiedCount, supabase });
    } catch (error) {
        console.error("setQuestionsStatus error:", error.message);
        res.status(500).json({ message: "Something went wrong on the server" });
    }
};

// GET /api/admin/questions/:id
const getQuestion = async (req, res) => {
    try {
        const { id } = req.params;
        if (!isValidId(id)) return res.status(400).json({ message: "Invalid question id" });

        const question = await Question.findById(id).select("+correctOptionIds +numericalAnswer");
        if (!question) return res.status(404).json({ message: "Question not found" });

        res.json({ question });
    } catch (error) {
        console.error("getQuestion error:", error.message);
        res.status(500).json({ message: "Something went wrong on the server" });
    }
};

// PUT /api/admin/questions/:id
const updateQuestion = async (req, res) => {
    try {
        const { id } = req.params;
        if (!isValidId(id)) return res.status(400).json({ message: "Invalid question id" });

        const question = await Question.findById(id).select("+correctOptionIds +numericalAnswer");
        if (!question) return res.status(404).json({ message: "Question not found" });

        const wasPublished = question.status === "published";
        // Apply only the allowed changes
        Object.assign(question, pickAllowed(req.body));

        // If the topic changed, update the whole syllabus path
        const { topicId } = req.body;
        if (topicId && String(topicId) !== String(question.topicId)) {
            if (!isValidId(topicId)) return res.status(400).json({ message: "Invalid topicId" });
            const topic = await Topic.findById(topicId);
            if (!topic) return res.status(404).json({ message: "Topic not found" });
            question.topicId = topic._id;
            question.chapterId = topic.chapterId;
            question.subjectId = topic.subjectId;
            question.examId = topic.examId;
        }

        const error = validateQuestion(question.toObject());
        if (error) return res.status(400).json({ message: error });

        question.version += 1;
        question.updatedBy = req.user._id;
        if (question.external?.id) question.set("external.editedAt", new Date()); // keep this edit when Supabase syncs again
        await question.save();

        // Just published (e.g. a draft saved as Published) → accepted in the main Supabase too
        const supabase = !wasPublished && question.status === "published" ? await acceptInSupabase([question._id]) : { enabled: false };
        res.json({ message: "Question updated", question, supabase });
    } catch (error) {
        console.error("updateQuestion error:", error.message);
        res.status(500).json({ message: "Something went wrong on the server" });
    }
};

// DELETE /api/admin/questions/:id
// "Soft delete": we mark it archived instead of removing it,
// because old test attempts still point to this question.
const deleteQuestion = async (req, res) => {
    try {
        const { id } = req.params;
        if (!isValidId(id)) return res.status(400).json({ message: "Invalid question id" });

        const question = await Question.findByIdAndUpdate(
            id,
            { status: "archived", updatedBy: req.user._id },
            { returnDocument: "after" }
        );
        if (!question) return res.status(404).json({ message: "Question not found" });

        res.json({ message: "Question deleted (archived)" });
    } catch (error) {
        console.error("deleteQuestion error:", error.message);
        res.status(500).json({ message: "Something went wrong on the server" });
    }
};

module.exports = {
    setQuestionsStatus,
    createQuestion,
    listQuestions,
    getQuestion,
    updateQuestion,
    deleteQuestion,
};
module.exports.validateQuestion = validateQuestion;
