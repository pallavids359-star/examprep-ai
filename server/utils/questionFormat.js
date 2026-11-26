// The kind of question, for assignments: single correct, multiple correct, assertion & reason,
// match the following, statement based, or numerical. Worked out from the question's type, the
// original Supabase q_type (kept in tags) and its text.
// The same types as the Question Bank Portal, plus multiple correct (JEE)
const FORMATS = ["single_correct", "assertion_reason", "statement_based", "match_following", "diagram_based", "true_false", "multi_correct", "numerical"];

const IMG = /\{\{IMG::|<img\b|!\[[^\]]*\]\(/i;
const isTrueFalse = (q) => {
    const opts = (q.options || []).map((o) => String(o.text || "").trim().toLowerCase()).filter(Boolean);
    return opts.length === 2 && opts.includes("true") && opts.includes("false");
};
const hasDiagram = (q) =>
    (q.images || []).length > 0 || (q.options || []).some((o) => o.image?.url || IMG.test(String(o.text || ""))) || IMG.test(String(q.text || ""));

const formatOf = (q = {}) => {
    if (q.type === "numerical") return "numerical";
    const tags = (q.tags || []).join(" ").toLowerCase();
    const text = String(q.text || "");
    if (tags.includes("true_false") || tags.includes("true/false") || isTrueFalse(q)) return "true_false";
    if (tags.includes("assert") || /assertion\s*\(?\s*a\s*\)?\s*[:\-]/i.test(text)) return "assertion_reason";
    if (tags.includes("match") || /\b(list|column)[\s-]*(i|1)\b/i.test(text)) return "match_following";
    if (tags.includes("statement") || /\bstatement[\s-]*(i|1)\b/i.test(text)) return "statement_based";
    if (q.type === "mcq_multi" || tags.includes("multi")) return "multi_correct";
    if (tags.includes("diagram") || hasDiagram(q)) return "diagram_based";
    return "single_correct";
};

/**
 * Gives a type to questions that have none yet (older questions from Supabase).
 * Runs before picking questions, only on the questions that could be picked, so tests always
 * find every question of a type. Stops after budgetMs and returns how many are still left.
 */
const labelMissing = async (match = {}, { budgetMs = 8000, batch = 2000 } = {}) => {
    const Question = require("../models/Question");
    const started = Date.now();
    const where = { ...match, $or: [{ format: { $exists: false } }, { format: null }, { format: "" }] };
    let labelled = 0;
    while (Date.now() - started < budgetMs) {
        const docs = await Question.find(where).select("type tags text options images").limit(batch).lean();
        if (!docs.length) return { labelled, left: 0 };
        await Question.bulkWrite(
            docs.map((q) => ({ updateOne: { filter: { _id: q._id }, update: { $set: { format: formatOf(q) } } } })),
            { ordered: false }
        );
        labelled += docs.length;
        if (docs.length < batch) return { labelled, left: 0 };
    }
    return { labelled, left: await Question.countDocuments(where) };
};

module.exports = { FORMATS, formatOf, labelMissing };
