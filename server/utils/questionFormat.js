// The kind of question, for assignments: single correct, multiple correct, assertion & reason,
// match the following, statement based, or numerical. Worked out from the question's type, the
// original Supabase q_type (kept in tags) and its text.
const FORMATS = ["single_correct", "multi_correct", "assertion_reason", "match_following", "statement_based", "numerical"];

const formatOf = (q = {}) => {
    if (q.type === "numerical") return "numerical";
    const tags = (q.tags || []).join(" ").toLowerCase();
    const text = String(q.text || "");
    if (tags.includes("assert") || /assertion\s*\(?\s*a\s*\)?\s*[:\-]/i.test(text)) return "assertion_reason";
    if (tags.includes("match") || /\b(list|column)[\s-]*(i|1)\b/i.test(text)) return "match_following";
    if (tags.includes("statement") || /\bstatement[\s-]*(i|1)\b/i.test(text)) return "statement_based";
    if (q.type === "mcq_multi" || tags.includes("multi")) return "multi_correct";
    return "single_correct";
};

module.exports = { FORMATS, formatOf };
