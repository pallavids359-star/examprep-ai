// Writes GenPrep decisions back to the main Supabase (the Question Bank Portal).
//
// Only one thing is written: when a question is PUBLISHED in GenPrep, it is ACCEPTED in Supabase.
// It uses the portal's own function public.apply_question_workflow(..., 'accept', ...), so the
// portal records it exactly like an admin accepting it there (history, audit log, notification).
//
// Off unless these are set (server/.env and Render → Environment):
//   SUPABASE_WRITE_BACK=true
//   SUPABASE_WRITE_AS=admin@example.com   an ACTIVE admin user of the Question Bank Portal;
//                                         its name is shown as the one who accepted
// The connection is the same as the sync: SUPABASE_N_DB_URL (database owner) or
// SUPABASE_N_URL + SUPABASE_N_KEY (must be the service_role key; the anon key is refused).
const { getSources } = require("../config/supabaseSources");
const Question = require("../models/Question");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const env = (k) => (process.env[k] || "").trim();

const writeBackEnabled = () => env("SUPABASE_WRITE_BACK").toLowerCase() === "true" && Boolean(env("SUPABASE_WRITE_AS"));

// ---------- talking to one Supabase project ----------

const pgRun = async (source, sql, params) => {
    const { getPool } = require("./pgReader");
    const res = await getPool(source).query(sql, params);
    return res.rows;
};

const rest = async (source, path, { method = "GET", body } = {}) => {
    const res = await fetch(`${source.url}/rest/v1/${path}`, {
        method,
        headers: { apikey: source.key, Authorization: `Bearer ${source.key}`, "Content-Type": "application/json", Accept: "application/json" },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(20000),
    });
    const text = await res.text();
    let json = null;
    try {
        json = text ? JSON.parse(text) : null;
    } catch {
        /* not JSON */
    }
    if (!res.ok) throw new Error((json && (json.message || json.hint)) || text.slice(0, 200) || res.statusText);
    return json;
};

// The portal admin who "accepts" (looked up once per source)
const actors = new Map();
const actorFor = async (source) => {
    const email = env("SUPABASE_WRITE_AS").toLowerCase();
    const key = `${source.name}:${email}`;
    if (actors.has(key)) return actors.get(key);
    let rows;
    if (source.kind === "postgres") {
        rows = await pgRun(source, `select id, name, role, status, is_active from public.users where lower(email) = $1 limit 1`, [email]);
    } else {
        rows = await rest(source, `users?select=id,name,role,status,is_active&email=ilike.${encodeURIComponent(email)}&limit=1`);
    }
    const u = rows && rows[0];
    if (!u) throw new Error(`No Question Bank Portal user with the email in SUPABASE_WRITE_AS`);
    if (String(u.role).toLowerCase() !== "admin" || u.status !== "active" || u.is_active === false) {
        throw new Error(`The SUPABASE_WRITE_AS user must be an active admin in the Question Bank Portal`);
    }
    const actor = { id: u.id, name: u.name || "GenPrep" };
    actors.set(key, actor);
    return actor;
};

const acceptOne = async (source, rowId, actor) => {
    if (source.kind === "postgres") {
        await pgRun(source, `select (public.apply_question_workflow($1::uuid, 'accept', $2::uuid, $3, 'true'::jsonb, null)).id`, [rowId, actor.id, `${actor.name} (GenPrep)`]);
    } else {
        await rest(source, "rpc/apply_question_workflow", {
            method: "POST",
            body: { p_question_id: rowId, p_action: "accept", p_actor_id: actor.id, p_actor_name: `${actor.name} (GenPrep)`, p_value: true, p_solution_text: null },
        });
    }
};

// ---------- the one thing GenPrep calls ----------

/**
 * Accept these GenPrep questions in Supabase. Never throws: returns what happened.
 * { enabled, accepted, skipped, failed, errors[] }
 */
const acceptInSupabase = async (questionIds) => {
    const out = { enabled: writeBackEnabled(), accepted: 0, skipped: 0, failed: 0, errors: [] };
    if (!out.enabled || !questionIds.length) return out;

    const { sources } = getSources();
    const byName = new Map(sources.map((s) => [s.name, s]));
    const qs = await Question.find({ _id: { $in: questionIds }, status: "published" }).select("external").lean();

    for (const q of qs) {
        const ext = q.external || {};
        const rowId = String(ext.rowId || ext.id || "");
        const source = byName.get(ext.source);
        if (!source || !UUID.test(rowId)) {
            out.skipped += 1; // made in GenPrep, or not from the Question Bank Portal
            continue;
        }
        try {
            const actor = await actorFor(source);
            await acceptOne(source, rowId, actor);
            await Question.updateOne({ _id: q._id }, { $set: { "external.acceptedInSourceAt": new Date() } });
            out.accepted += 1;
        } catch (err) {
            out.failed += 1;
            const msg = String(err.message || err).replace(/postgres(ql)?:\/\/\S+/gi, "[connection]");
            if (out.errors.length < 3 && !out.errors.includes(msg)) out.errors.push(msg);
        }
    }
    if (out.failed) console.error("Supabase write-back:", out.errors.join(" | "));
    return out;
};

module.exports = { acceptInSupabase, writeBackEnabled, actorFor, pgRun, rest };
