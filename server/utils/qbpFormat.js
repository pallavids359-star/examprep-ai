// Converts a row from the question website's Supabase "questions" table
// (subject / klass / chapter / topic / q_type / opt_a..opt_d / correct_option ...)
// into GenPrep question data. Same rules as client/src/utils/supabaseFormat.js,
// so synced questions look exactly like bulk-uploaded ones.

const QBP_TAG = /\s*\[QBP_[A-Z_]+:[^\]]*\]/g;
const DIFFICULTIES = ["easy", "medium", "hard"];
const SOURCE_KINDS = ["original", "pyq", "ncert"];

// Standard options used when an assertion-reason question has none of its own
const AR_OPTIONS = [
    "Both A and R are true and R is the correct explanation of A",
    "Both A and R are true but R is not the correct explanation of A",
    "A is true but R is false",
    "A is false but R is true",
];

const clean = (v) => (v === undefined || v === null ? "" : String(v).trim());

const parseJson = (v, fallback) => {
    if (v !== null && typeof v === "object") return v; // jsonb / arrays already parsed by pg
    try {
        const x = JSON.parse(clean(v));
        return x ?? fallback;
    } catch {
        return fallback;
    }
};

const asList = (v) => {
    const x = parseJson(v, []);
    if (Array.isArray(x)) return x.map((i) => (typeof i === "object" && i ? i.text || i.value || i.label || JSON.stringify(i) : String(i)));
    if (x && typeof x === "object") return Object.values(x).map(String);
    return [];
};

// Used to recognise the same question text across the two systems
const normText = (s) => String(s || "").replace(QBP_TAG, "").replace(/\s+/g, " ").trim();

// True when the row looks like the question website's table
const isQbpRow = (row) =>
    row && typeof row === "object" && ("q_type" in row || ("opt_a" in row && "correct_option" in row)) && !("topic_id" in row || "topicId" in row);

// "JEE MAIN", "JEE Advanced", "JEE Mains" are all GenPrep's JEE exam
const EXAM_ALIASES = { "JEE MAIN": "JEE", "JEE MAINS": "JEE", "JEE ADVANCED": "JEE", "JEE ADV": "JEE", "JEE-MAIN": "JEE", "JEE-ADVANCED": "JEE" };

// ["JEE"], ["NEET/JEE"], '["JEE MAIN"]', "NEET, KCET" -> ["JEE"], ["NEET","JEE"], ["JEE"], ["NEET","KCET"]
const toExams = (v) => {
    const x = parseJson(v, null);
    const list = Array.isArray(x) ? x : [clean(v)];
    const out = [];
    for (const item of list) {
        for (const part of String(item).split(/\s*(?:[\/,;|&+]|\band\b)\s*/i)) {
            const code = part.trim().replace(/\s+/g, " ").toUpperCase();
            if (code) out.push(EXAM_ALIASES[code] || code);
        }
    }
    return [...new Set(out)];
};

// pending review -> draft (like seed/draftPending.js), rejected -> archived
const toStatus = (row, { defaultStatus, pendingStatus }) => {
    const states = [row.review_status, row.acceptance_status].map((s) => clean(s).toLowerCase());
    if (row.is_deleted === true || row.deleted_at) return "archived";
    if (states.some((s) => s === "rejected" || s === "deleted")) return "archived";
    if (states.some((s) => s === "pending" || s === "in_review" || s === "needs_changes")) return pendingStatus;
    if (!("review_status" in row) && !("acceptance_status" in row)) return defaultStatus;
    return "published";
};

// "C" / "c" / "A,C" / "1" (1 = A)
const toCorrect = (v) => {
    const s = clean(v).toUpperCase();
    if (/^[1-4]$/.test(s)) return ["ABCD"[Number(s) - 1]];
    return s
        .replace(/[^A-D,]/g, "")
        .split(",")
        .filter(Boolean);
};

// Returns { ok: true, id, exams, names, data } or { ok: false, id, reason }
const convertQbpRow = (r, { defaultStatus = "published", pendingStatus = "draft" } = {}) => {
    const id = clean(r.id);
    if (!id) return { ok: false, id: null, reason: "Row has no id" };
    const fail = (reason) => ({ ok: false, id, reason });

    const exams = toExams(r.exams);
    if (!exams.length) return fail("The exams column is empty");
    const names = { subject: clean(r.subject), klass: clean(r.klass), chapter: clean(r.chapter), topic: clean(r.topic) };
    if (!names.subject || !names.chapter) return fail("Subject or chapter is empty");
    if (!names.topic) return fail("Topic is empty");

    const type = clean(r.q_type).toLowerCase();
    const solution = clean(r.solution_text);
    const diff = ((solution.match(/\[QBP_DIFFICULTY:\s*([A-Za-z]+)/) || [])[1] || "").toLowerCase();
    const sourceKind = clean(r.source).toLowerCase();

    const data = {
        explanation: { text: solution.replace(QBP_TAG, "").trim(), images: [], videoUrl: "" },
        difficulty: DIFFICULTIES.includes(diff) ? diff : "medium",
        tags: type ? [type] : [],
        images: [],
        source: { kind: SOURCE_KINDS.includes(sourceKind) ? sourceKind : "original" },
        status: toStatus(r, { defaultStatus, pendingStatus }),
    };
    const year = Number(clean(r.year));
    if (clean(r.year) && Number.isFinite(year)) data.source.year = year;

    let question = clean(r.question).replace(QBP_TAG, "").trim();

    if (type === "numerical" || type === "integer") {
        const answer = (clean(r.num_answer) || clean(r.correct_option)).replace(/[$\s]/g, "");
        if (!question) return fail("Question text is empty");
        if (!answer || Number.isNaN(Number(answer))) return fail("Numerical answer is not a number, so it can't be marked automatically");
        return {
            ok: true, id, exams, names,
            data: { ...data, type: "numerical", text: question, options: [], correctOptionIds: [], numericalAnswer: { value: Number(answer), tolerance: 0 } },
        };
    }

    let options = [r.opt_a, r.opt_b, r.opt_c, r.opt_d].map(clean);

    if (type.includes("assert")) {
        const parts = [question, clean(r.assertion) && `**Assertion (A):** ${clean(r.assertion)}`, clean(r.reason) && `**Reason (R):** ${clean(r.reason)}`].filter(Boolean);
        question = parts.join("\n\n").replace(/\*\*/g, "");
        if (!options.some(Boolean)) {
            const predef = asList(r.predef_options);
            options = predef.length >= 4 ? predef.slice(0, 4) : AR_OPTIONS;
        }
    } else if (type.includes("match")) {
        const listA = asList(r.column_a);
        const listB = asList(r.column_b);
        const lines = [];
        if (listA.length) lines.push("List I:", ...listA.map((x, i) => `(${"PQRSTU"[i] || i + 1}) ${x}`));
        if (listB.length) lines.push("", "List II:", ...listB.map((x, i) => `(${i + 1}) ${x}`));
        if (lines.length) question = [question, lines.join("\n")].filter(Boolean).join("\n\n");
        if (!options.some(Boolean)) {
            const mo = parseJson(r.match_options, {});
            const vals = Array.isArray(mo) ? mo.map(String) : ["A", "B", "C", "D"].map((k) => clean(mo[k] ?? mo[k.toLowerCase()]));
            options = vals.slice(0, 4);
        }
    }

    if (!question) return fail("Question text is empty");
    if (options.filter(Boolean).length < 4) return fail(`Needs 4 options for a ${type || "MCQ"} question`);
    const correct = toCorrect(r.correct_option);
    if (!correct.length) return fail("Correct option is missing");

    return {
        ok: true, id, exams, names,
        data: {
            ...data,
            type: correct.length > 1 || type.includes("multi") ? "mcq_multi" : "mcq_single",
            text: question,
            options: ["A", "B", "C", "D"].map((oid, i) => ({ id: oid, text: options[i] })),
            correctOptionIds: correct,
        },
    };
};

module.exports = { isQbpRow, convertQbpRow, normText, toExams, toCorrect };
