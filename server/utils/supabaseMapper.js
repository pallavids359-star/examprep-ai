// Turns a row from a Supabase "questions" table into GenPrep's Question shape,
// and builds the PostgREST query strings used by the sync.
// No database or network code here, so it is easy to test.

const { isQbpRow, convertQbpRow } = require("./qbpFormat");

const OPTION_IDS = ["A", "B", "C", "D"];
const DIFFICULTIES = ["easy", "medium", "hard"];
const STATUSES = ["draft", "published", "archived"];
const SOURCE_KINDS = ["original", "pyq", "ncert"];

// Reads the first defined value among several column names (camelCase or snake_case)
const pick = (row, ...names) => {
    for (const n of names) {
        if (row[n] !== undefined && row[n] !== null) return row[n];
    }
    return undefined;
};

// jsonb columns arrive as objects; text columns holding JSON arrive as strings
const parseJson = (value) => {
    if (typeof value !== "string") return value;
    const t = value.trim();
    if (!(t.startsWith("[") || t.startsWith("{"))) return value;
    try {
        return JSON.parse(t);
    } catch {
        return value;
    }
};

const toNumber = (v) => {
    if (v === undefined || v === null || v === "") return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
};

const toImage = (img) => {
    if (!img) return undefined;
    if (typeof img === "string") return img.trim() ? { url: img.trim() } : undefined;
    if (typeof img === "object" && img.url) {
        const out = { url: String(img.url) };
        if (img.publicId || img.public_id) out.publicId = String(img.publicId || img.public_id);
        if (img.alt) out.alt = String(img.alt);
        return out;
    }
    return undefined;
};

const toImages = (value) => {
    const v = parseJson(value);
    if (!v) return [];
    const list = Array.isArray(v) ? v : [v];
    return list.map(toImage).filter(Boolean);
};

const toTags = (value) => {
    const v = parseJson(value);
    if (Array.isArray(v)) return v.map((t) => String(t).trim()).filter(Boolean);
    if (typeof v === "string") return v.split(",").map((t) => t.trim()).filter(Boolean);
    return [];
};

const normaliseType = (value) => {
    const t = String(value || "").toLowerCase().replace(/[\s-]/g, "_");
    if (!t) return "mcq_single";
    if (["mcq_single", "single", "mcq", "scq", "single_correct"].includes(t)) return "mcq_single";
    if (["mcq_multi", "multi", "multiple", "mcq_multiple", "multi_correct", "multiple_correct"].includes(t)) return "mcq_multi";
    if (["numerical", "numeric", "integer", "nat", "number"].includes(t)) return "numerical";
    return null;
};

// Options can be stored as:
//  - [{ id: "A", text: "...", image }, ...]
//  - ["text A", "text B", "text C", "text D"]
//  - { A: "text", B: "text", ... }
//  - separate columns option_a ... option_d (or optionA ... optionD)
const toOptions = (row) => {
    let raw = parseJson(pick(row, "options"));

    if (!raw) {
        const cols = OPTION_IDS.map((id) =>
            pick(row, `option_${id.toLowerCase()}`, `option${id}`, `option_${id}`, `opt_${id.toLowerCase()}`)
        );
        if (cols.some((c) => c !== undefined)) raw = cols.map((c) => (c === undefined ? "" : c));
    }
    if (!raw) return [];

    if (!Array.isArray(raw) && typeof raw === "object") {
        raw = OPTION_IDS.map((id) => raw[id] ?? raw[id.toLowerCase()] ?? "");
    }
    if (!Array.isArray(raw)) return [];

    return raw.map((o, i) => {
        if (o && typeof o === "object") {
            const opt = {
                id: String(o.id || o.key || OPTION_IDS[i] || "").toUpperCase(),
                text: o.text === undefined || o.text === null ? "" : String(o.text),
            };
            const image = toImage(o.image);
            if (image) opt.image = image;
            return opt;
        }
        return { id: OPTION_IDS[i], text: o === undefined || o === null ? "" : String(o) };
    });
};

// "B", ["B"], "A,C", "A C", ["a","c"], or 1-based numbers like 2
const toCorrect = (value) => {
    let v = parseJson(value);
    if (v === undefined || v === null || v === "") return [];
    if (!Array.isArray(v)) v = String(v).split(/[\s,;|]+/);
    return v
        .map((x) => {
            const s = String(x).trim().toUpperCase();
            if (/^[1-4]$/.test(s)) return OPTION_IDS[Number(s) - 1];
            return s;
        })
        .filter(Boolean);
};

const toNumerical = (row) => {
    const raw = parseJson(pick(row, "numericalAnswer", "numerical_answer"));
    let value;
    let tolerance;
    if (raw && typeof raw === "object") {
        value = toNumber(raw.value);
        tolerance = toNumber(raw.tolerance);
    } else {
        value = toNumber(raw);
    }
    if (tolerance === undefined) tolerance = toNumber(pick(row, "tolerance", "numerical_tolerance"));
    if (value === undefined) return undefined;
    return { value, tolerance: tolerance || 0 };
};

const toExplanation = (row) => {
    const raw = parseJson(pick(row, "explanation"));
    const out = { text: "", images: [], videoUrl: "" };
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        out.text = raw.text ? String(raw.text) : "";
        out.images = toImages(raw.images);
        out.videoUrl = raw.videoUrl || raw.video_url ? String(raw.videoUrl || raw.video_url) : "";
    } else if (raw !== undefined) {
        out.text = String(raw);
    }
    const extraImages = toImages(pick(row, "explanation_images", "explanationImages"));
    if (extraImages.length) out.images = out.images.concat(extraImages);
    const video = pick(row, "explanation_video_url", "explanationVideoUrl", "video_url");
    if (video && !out.videoUrl) out.videoUrl = String(video);
    return out;
};

const toMarks = (row) => {
    const raw = parseJson(pick(row, "marks"));
    const correct = toNumber(raw && typeof raw === "object" ? raw.correct : pick(row, "marks_correct", "marksCorrect"));
    const incorrect = toNumber(raw && typeof raw === "object" ? raw.incorrect : pick(row, "marks_incorrect", "marksIncorrect"));
    if (correct === undefined && incorrect === undefined) return undefined;
    const out = {};
    if (correct !== undefined) out.correct = correct;
    if (incorrect !== undefined) out.incorrect = incorrect;
    return out;
};

const toSource = (row) => {
    const raw = parseJson(row.source);
    const obj = raw && typeof raw === "object" ? raw : {};
    const kind = String(obj.kind || pick(row, "source_kind", "sourceKind") || (typeof raw === "string" ? raw : "") || "original").toLowerCase();
    const out = { kind: SOURCE_KINDS.includes(kind) ? kind : "original" };
    const year = toNumber(obj.year ?? pick(row, "source_year", "sourceYear", "year"));
    const shift = obj.shift ?? pick(row, "source_shift", "sourceShift", "shift");
    const paper = obj.paper ?? pick(row, "source_paper", "sourcePaper", "paper");
    if (year !== undefined) out.year = year;
    if (shift) out.shift = String(shift);
    if (paper) out.paper = String(paper);
    return out;
};

const toStatus = (row, defaultStatus) => {
    if (row.is_deleted === true || row.isDeleted === true || row.deleted === true || row.deleted_at || row.deletedAt) {
        return "archived";
    }
    if (row.is_published === false || row.isPublished === false) return "draft";
    if (row.is_published === true || row.isPublished === true) return "published";
    const s = String(pick(row, "status") || "").toLowerCase();
    if (STATUSES.includes(s)) return s;
    if (s === "deleted") return "archived";
    if (s === "active" || s === "live") return "published";
    return defaultStatus;
};

// Returns { ok: true, id, topicId, data }            (row has a GenPrep topic_id)
//      or { ok: true, id, exams, names, data }       (question website rows: subject/chapter/topic names)
//      or { ok: false, id, reason }
const mapRow = (row, { defaultStatus = "published", pendingStatus = "draft" } = {}) => {
    if (!row || typeof row !== "object") return { ok: false, id: null, reason: "Empty row" };
    if (isQbpRow(row)) return convertQbpRow(row, { defaultStatus, pendingStatus });

    const id = row.id;
    if (id === undefined || id === null || id === "") return { ok: false, id: null, reason: "Row has no id column" };

    const topicId = pick(row, "topicId", "topic_id");
    if (!topicId || !/^[a-f0-9]{24}$/i.test(String(topicId))) {
        return { ok: false, id: String(id), reason: "topic_id is missing or is not a GenPrep topic id" };
    }

    const text = pick(row, "text", "question", "question_text", "questionText");
    if (!text || !String(text).trim()) return { ok: false, id: String(id), reason: "Question text is empty" };

    const type = normaliseType(pick(row, "type", "question_type", "questionType"));
    if (!type) return { ok: false, id: String(id), reason: `Unknown question type "${pick(row, "type", "question_type")}"` };

    const difficulty = String(pick(row, "difficulty") || "medium").toLowerCase();

    const data = {
        type,
        text: String(text).trim(),
        images: toImages(pick(row, "images", "image", "question_images", "image_url")),
        options: type === "numerical" ? [] : toOptions(row),
        explanation: toExplanation(row),
        difficulty: DIFFICULTIES.includes(difficulty) ? difficulty : "medium",
        source: toSource(row),
        tags: toTags(pick(row, "tags")),
        status: toStatus(row, defaultStatus),
    };

    if (type === "numerical") {
        const num = toNumerical(row);
        if (num) data.numericalAnswer = num;
        data.correctOptionIds = [];
    } else {
        data.correctOptionIds = toCorrect(
            pick(row, "correctOptionIds", "correct_option_ids", "correct_options", "correct_option", "correct_answer", "answer")
        );
    }

    const marks = toMarks(row);
    if (marks) data.marks = marks;

    return { ok: true, id: String(id), topicId: String(topicId), data };
};

// ---------- PostgREST query building ----------

// Values inside or=(...) must be double-quoted when they contain reserved characters
const quote = (v) => `"${String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

// One page of rows, in a stable order, after the saved cursor.
// mode "updated": ordered by (updatedColumn, id) — picks up new AND edited rows
// mode "id":      ordered by id only — for tables without an updated_at column
const buildPageQuery = ({ mode, updatedColumn, cursor, limit }) => {
    const params = new URLSearchParams();
    params.set("select", "*");
    params.set("limit", String(limit));

    if (mode === "updated") {
        // Rows with an empty updated_at can't be paged by it; supabase/setup.sql prevents them
        params.append(updatedColumn, "not.is.null");
        params.set("order", `${updatedColumn}.asc,id.asc`);
        if (cursor && cursor.updatedAt) {
            const t = quote(cursor.updatedAt);
            if (cursor.id !== undefined && cursor.id !== null && cursor.id !== "") {
                params.set("or", `(${updatedColumn}.gt.${t},and(${updatedColumn}.eq.${t},id.gt.${quote(cursor.id)}))`);
            } else {
                params.append(updatedColumn, `gte.${cursor.updatedAt}`);
            }
        }
    } else {
        params.set("order", "id.asc");
        if (cursor && cursor.id !== undefined && cursor.id !== null && cursor.id !== "") {
            params.set("id", `gt.${cursor.id}`);
        }
    }
    return params.toString();
};

// Only the ids, used to find rows that were deleted in Supabase
const buildIdQuery = ({ afterId, limit }) => {
    const params = new URLSearchParams();
    params.set("select", "id");
    params.set("order", "id.asc");
    params.set("limit", String(limit));
    if (afterId !== undefined && afterId !== null && afterId !== "") params.set("id", `gt.${afterId}`);
    return params.toString();
};

module.exports = { mapRow, buildPageQuery, buildIdQuery, toCorrect, toOptions, normaliseType };
