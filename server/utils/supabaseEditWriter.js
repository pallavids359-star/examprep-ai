// Sends a question edited in GenPrep back to the main Supabase (the Question Bank Portal),
// so a fixed mistake is fixed there too.
//
// Same switch and admin as the accept write-back (utils/supabaseWriter.js):
//   SUPABASE_WRITE_BACK=true   SUPABASE_WRITE_AS=<active QBP admin email>
//
// Only what changed is written, compared with the row as it is now in Supabase:
//   question text, options A-D, correct option / numerical answer, solution, difficulty.
// The portal's hidden markers ([QBP_DIFFICULTY:..], [QBP_TYPE:..], [QBP_DATA:..]) are kept.
// Not sent: images, and the question text of match-the-following / statement-based questions
// (their lists live in the portal's own fields), which are reported back as "not sent".
const { getSources } = require("../config/supabaseSources");
const { convertQbpRow, isQbpRow } = require("./qbpFormat");
// Loaded when needed (it uses the database models; buildPatch does not)
const writer = () => require("./supabaseWriter");
const pgRun = (...a) => writer().pgRun(...a);
const rest = (...a) => writer().rest(...a);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TAG = /\s*\[QBP_[A-Z_]+:[^\]]*\]/g;
const META_LINE = /(?:^|\r?\n)\[QBP_(?:DIFFICULTY|TYPE|DATA):[^\]\r\n]*\]/gi;
const ident = (n) => `"${n}"`;
const clean = (v) => (v === undefined || v === null ? "" : String(v).trim());
const same = (a, b) => clean(a).replace(/\s+/g, " ") === clean(b).replace(/\s+/g, " ");
const tagsOf = (s) => (String(s || "").match(TAG) || []).map((t) => t.trim());
const cap = (d) => d.charAt(0).toUpperCase() + d.slice(1).toLowerCase();
const round = (n) => Math.round(n * 1e6) / 1e6;

const readRow = async (source, id) => {
    if (source.kind === "postgres") {
        const rows = await pgRun(source, `select * from ${ident(source.schema)}.${ident(source.table)} where id = $1::uuid limit 1`, [id]);
        return rows[0] || null;
    }
    const rows = await rest(source, `${source.table}?id=eq.${id}&select=*&limit=1`);
    return (rows && rows[0]) || null;
};

const writeRow = async (source, id, patch) => {
    if (source.kind === "postgres") {
        const keys = Object.keys(patch);
        const sets = keys.map((k, i) => `${ident(k)} = $${i + 2}`).join(", ");
        await pgRun(source, `update ${ident(source.schema)}.${ident(source.table)} set ${sets}, updated_at = now() where id = $1::uuid`, [id, ...keys.map((k) => patch[k])]);
    } else {
        await rest(source, `${source.table}?id=eq.${id}`, { method: "PATCH", body: patch });
    }
};

const audit = async (source, actor, id, details) => {
    const row = { user_id: actor.id, user_name: actor.name, action: "UPDATE_QUESTION", resource_type: "question", resource_id: id, details };
    try {
        if (source.kind === "postgres") {
            await pgRun(source, `insert into public.audit_log (user_id, user_name, action, resource_type, resource_id, details) values ($1, $2, $3, $4, $5, $6::jsonb)`, [row.user_id, row.user_name, row.action, row.resource_type, row.resource_id, JSON.stringify(details)]);
        } else {
            await rest(source, "audit_log", { method: "POST", body: row });
        }
    } catch {
        /* the audit log is nice to have; never fail the edit for it */
    }
};

// Difficulty goes through the portal's own workflow (history + audit like an admin change)
const setDifficulty = async (source, id, actor, difficulty, solutionText) => {
    const args = [id, "difficulty", actor.id, `${actor.name} (GenPrep)`, JSON.stringify(difficulty), solutionText];
    if (source.kind === "postgres") {
        await pgRun(source, `select (public.apply_question_workflow($1::uuid, $2, $3::uuid, $4, $5::jsonb, $6)).id`, args);
    } else {
        await rest(source, "rpc/apply_question_workflow", { method: "POST", body: { p_question_id: id, p_action: "difficulty", p_actor_id: actor.id, p_actor_name: args[3], p_value: difficulty, p_solution_text: solutionText } });
    }
};

/**
 * Works out what to write. Pure (no database), so it is easy to test.
 * row: the Supabase row now;  q: the GenPrep question (with correctOptionIds / numericalAnswer)
 * Returns { patch, difficulty, sent[], notSent[] }
 */
const buildPatch = (row, q) => {
    const now = convertQbpRow(row, { defaultStatus: "published", pendingStatus: "draft" });
    const before = now.ok ? now.data : null;
    const patch = {};
    const sent = [];
    const notSent = [];
    const type = clean(row.q_type).toLowerCase();
    const special = /\[QBP_TYPE:(statement_based|match|true_false)\]/i.test(row.solution_text || "") || type.includes("match") || type.includes("statement");

    // Question text
    if (!before || !same(before.text, q.text)) {
        const keep = tagsOf(row.question).join(" ");
        const withTags = (t) => [clean(t), keep].filter(Boolean).join(" ");
        if (type.includes("assert")) {
            const m = String(q.text).match(/^([\s\S]*?)\s*Assertion \(A\):\s*([\s\S]*?)\s*Reason \(R\):\s*([\s\S]*)$/);
            if (m) {
                patch.question = withTags(m[1]);
                patch.assertion = clean(m[2]);
                patch.reason = clean(m[3]);
                sent.push("question");
            } else notSent.push("question text (keep the “Assertion (A):” and “Reason (R):” lines)");
        } else if (special) {
            notSent.push("question text (match / statement questions: change it in the Question Bank Portal)");
        } else {
            patch.question = withTags(q.text);
            sent.push("question");
        }
    }

    if (q.type === "numerical") {
        const v = q.numericalAnswer?.value;
        const t = q.numericalAnswer?.tolerance || 0;
        const b = before?.numericalAnswer;
        if (typeof v === "number" && (!b || b.value !== v || (b.tolerance || 0) !== t)) {
            const text = t ? `${round(v - t)} to ${round(v + t)}` : String(v);
            patch.num_answer = text;
            patch.correct_option = text;
            sent.push("answer");
        }
    } else {
        const opts = ["A", "B", "C", "D"].map((id) => (q.options || []).find((o) => o.id === id)?.text ?? "");
        const old = ["A", "B", "C", "D"].map((id) => (before?.options || []).find((o) => o.id === id)?.text ?? "");
        if (opts.some((o, i) => !same(o, old[i]))) {
            ["a", "b", "c", "d"].forEach((k, i) => (patch[`opt_${k}`] = clean(opts[i])));
            sent.push("options");
        }
        const right = [...(q.correctOptionIds || [])].sort().join(",");
        if (right && right !== [...(before?.correctOptionIds || [])].sort().join(",")) {
            patch.correct_option = right;
            sent.push("correct answer");
        }
    }

    // Solution: new text + the portal's marker lines
    const markers = (String(row.solution_text || "").match(META_LINE) || []).map((x) => x.trim());
    let solution = String(row.solution_text || "");
    if (!same(before?.explanation?.text, q.explanation?.text)) {
        const body = clean(q.explanation?.text);
        solution = [body, ...markers].filter(Boolean).join("\n");
        patch.solution_text = solution;
        sent.push("solution");
    }

    // Difficulty (sent after the row update, through the workflow)
    let difficulty = null;
    if (q.difficulty && before && q.difficulty !== before.difficulty) {
        difficulty = cap(q.difficulty);
        const stripped = solution.replace(/(?:^|\r?\n)\[QBP_DIFFICULTY:(?:Easy|Medium|Hard)\]/gi, "").trimEnd();
        difficulty = { value: difficulty, solution: `${stripped}${stripped ? "\n" : ""}[QBP_DIFFICULTY:${difficulty}]` };
        delete patch.solution_text; // the workflow writes the solution with the new marker
        sent.push("difficulty");
    }

    const imgs = (x) => JSON.stringify([...(x.images || []).map((i) => i.url), ...(x.options || []).map((o) => o.image?.url || ""), ...((x.explanation || {}).images || []).map((i) => i.url)]);
    if (before && imgs(q) !== imgs(before)) notSent.push("images");

    return { patch, difficulty, sent, notSent };
};

/**
 * Push one edited GenPrep question to its Supabase row. Never throws.
 * Returns { enabled, done, sent[], notSent[], error? }
 */
const pushEditToSupabase = async (question) => {
    const out = { enabled: writer().writeBackEnabled(), done: false, sent: [], notSent: [] };
    const ext = question.external || {};
    const rowId = String(ext.rowId || ext.id || "").split("|")[0];
    if (!out.enabled || !ext.source || !UUID.test(rowId)) return { ...out, skipped: true };
    const source = getSources().sources.find((s) => s.name === ext.source);
    if (!source) return { ...out, skipped: true };

    try {
        const row = await readRow(source, rowId);
        if (!row) throw new Error("The question was not found in Supabase (deleted there?)");
        if (!isQbpRow(row)) return { ...out, skipped: true };
        const { patch, difficulty, sent, notSent } = buildPatch(row, question);
        out.sent = sent;
        out.notSent = notSent;
        if (!sent.length) return { ...out, done: true };

        const actor = await writer().actorFor(source);
        if (Object.keys(patch).length) {
            await writeRow(source, rowId, { ...patch, updated_by: actor.id, updated_by_name: `${actor.name} (GenPrep)` });
            await audit(source, actor, rowId, { subject: row.subject, qType: row.q_type, via: "GenPrep", fields: sent.filter((s) => s !== "difficulty") });
        }
        if (difficulty) await setDifficulty(source, rowId, actor, difficulty.value, difficulty.solution);
        out.done = true;
        if (question._id) await require("../models/Question").updateOne({ _id: question._id }, { $set: { "external.pushedAt": new Date() } });
    } catch (err) {
        out.error = String(err.message || err).replace(/postgres(ql)?:\/\/\S+/gi, "[connection]");
        console.error("Supabase edit write-back:", out.error);
    }
    return out;
};

module.exports = { pushEditToSupabase, buildPatch };
