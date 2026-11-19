// Copies questions from the Supabase databases into GenPrep's MongoDB.
//
// Two ways rows arrive:
//  1. Webhook (instant): Supabase calls /api/sync/supabase/webhook on every insert,
//     update and delete. See SUPABASE_SYNC.md.
//  2. Pull (catch-up): reads every row changed since the last run. Runs from the
//     daily Vercel cron and from the "Sync now" button in the admin dashboard.
//     Supabase never retries a failed webhook, so this fills any gaps.
//
// Both paths are idempotent: a row is keyed by (database name, row id).

const Question = require("../models/Question");
const Topic = require("../models/Topic");
const SyncState = require("../models/SyncState");
const { validateQuestion } = require("../controllers/questionController");
const { getSources } = require("../config/supabaseSources");
const { mapRow, buildPageQuery, buildIdQuery } = require("./supabaseMapper");
const { normText } = require("./qbpFormat");
const { makeResolver } = require("./syllabusResolver");
const { makePgReader } = require("./pgReader");

const PAGE_SIZE = 500;
const ID_PAGE_SIZE = 1000;
const MAX_RECENT_SKIPPED = 20;

// ---------- Supabase REST ----------

class SupabaseError extends Error {
    constructor(message, { status, code } = {}) {
        super(message);
        this.status = status;
        this.code = code;
    }
}

const pgGet = async (source, query) => {
    const url = `${source.url}/rest/v1/${encodeURIComponent(source.table)}?${query}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    let res;
    try {
        res = await fetch(url, {
            headers: {
                apikey: source.key,
                Authorization: `Bearer ${source.key}`,
                Accept: "application/json",
            },
            signal: controller.signal,
        });
    } catch (err) {
        throw new SupabaseError(
            err.name === "AbortError" ? "Supabase did not answer within 20 seconds" : `Could not reach Supabase: ${err.message}`
        );
    } finally {
        clearTimeout(timer);
    }

    const body = await res.text();
    let json;
    try {
        json = body ? JSON.parse(body) : null;
    } catch {
        json = null;
    }
    if (!res.ok) {
        const msg = (json && (json.message || json.error || json.hint)) || body.slice(0, 200) || res.statusText;
        throw new SupabaseError(`Supabase ${res.status}: ${msg}`, { status: res.status, code: json && json.code });
    }
    if (!Array.isArray(json)) throw new SupabaseError("Supabase returned something that is not a list of rows");
    return json;
};

// Same three reads over the REST API (SUPABASE_N_URL + SUPABASE_N_KEY)
const makeRestReader = (source) => ({
    page: ({ mode, cursor, limit }) =>
        pgGet(source, buildPageQuery({ mode, updatedColumn: source.updatedColumn, cursor, limit })),
    ids: ({ afterId, limit }) => pgGet(source, buildIdQuery({ afterId, limit })),
    hasBlankUpdated: async () =>
        (await pgGet(source, `select=id&${encodeURIComponent(source.updatedColumn)}=is.null&limit=1`)).length > 0,
});

// Connection string → direct Postgres; otherwise the REST API
const readerFor = (source) => (source.kind === "postgres" ? makePgReader(source) : makeRestReader(source));

// Postgres "column does not exist" — the table has no updated_at column
const isMissingColumn = (err) => err.code === "42703" || /column .* does not exist/i.test(err.message);

// ---------- Writing to MongoDB ----------
//
// Each Supabase row becomes one GenPrep question per exam it lists (exams = ["JEE","NEET"]
// gives two questions). The copy's key is external.id = "<row id>|<exam code>" and
// external.rowId = "<row id>", so deleting the row archives every copy.
//
// A question that was already bulk-uploaded into GenPrep (same exam, same text, not yet
// linked) is linked to its row instead of being added again, so bookmarks and past
// attempts on it keep working.

// single = true for one webhook row: look up the exact text instead of loading every unlinked question
const makeContext = async ({ defaultStatus, pendingStatus, single = false }) => {
    const resolver = await makeResolver();

    const topicCache = new Map();
    const findTopic = (topicId) => {
        if (!topicCache.has(topicId)) topicCache.set(topicId, Topic.findById(topicId).select("examId subjectId chapterId").lean());
        return topicCache.get(topicId);
    };

    // examId -> Map(normalised text -> [{ id, topicId }]) of questions not linked to any row yet
    const unlinked = new Map();
    const claimed = new Set();
    const getUnlinked = (examId) => {
        const k = String(examId);
        if (!unlinked.has(k)) {
            unlinked.set(
                k,
                Question.find({ examId, "external.id": { $exists: false } })
                    .select("text topicId")
                    .lean()
                    .then((docs) => {
                        const map = new Map();
                        for (const d of docs) {
                            const t = normText(d.text);
                            if (!map.has(t)) map.set(t, []);
                            map.get(t).push({ id: String(d._id), topicId: String(d.topicId) });
                        }
                        return map;
                    })
            );
        }
        return unlinked.get(k);
    };
    const adopt = async (data) => {
        if (single) {
            const doc = await Question.findOne({ examId: data.examId, text: data.text, "external.id": { $exists: false } }).select("_id").lean();
            return doc ? String(doc._id) : null;
        }
        const list = (await getUnlinked(data.examId)).get(normText(data.text));
        if (!list) return null;
        const free = list.filter((c) => !claimed.has(c.id));
        const pick = free.find((c) => c.topicId === String(data.topicId)) || free[0];
        if (!pick) return null;
        claimed.add(pick.id);
        return pick.id;
    };

    return { defaultStatus, pendingStatus, resolver, findTopic, adopt };
};

const archiveRowIds = async (source, rowIds) => {
    if (!rowIds.length) return 0;
    const ids = rowIds.map(String);
    const r = await Question.updateMany(
        { "external.source": source.name, $or: [{ "external.rowId": { $in: ids } }, { "external.id": { $in: ids } }], status: { $ne: "archived" } },
        { $set: { status: "archived", "external.syncedAt": new Date() } }
    );
    return r.modifiedCount;
};

// Saves a list of rows. Returns one outcome per row: { result, id, reason? }
const applyBatch = async (source, rows, ctx) => {
    const outcomes = new Map(); // row id -> { saved, reasons }
    const order = [];
    const note = (id, reason) => {
        if (!outcomes.has(id)) {
            outcomes.set(id, { saved: 0, reasons: [], archived: false });
            order.push(id);
        }
        if (reason) outcomes.get(id).reasons.push(reason);
        return outcomes.get(id);
    };

    const targets = [];
    const toArchive = [];
    const multiExamRows = new Set();

    for (const row of rows) {
        const m = mapRow(row, { defaultStatus: ctx.defaultStatus, pendingStatus: ctx.pendingStatus });
        if (!m.ok) {
            note(m.id || "?", m.reason);
            continue;
        }
        note(m.id);

        if (m.data.status === "archived") {
            toArchive.push(m.id);
            outcomes.get(m.id).archived = true;
            continue;
        }

        const found = [];
        if (m.exams) {
            multiExamRows.add(m.id);
            for (const code of m.exams) {
                const r = await ctx.resolver.resolve(code, m.names);
                if (r.error) note(m.id, r.error);
                else found.push({ key: `${m.id}|${code}`, topic: r.topic });
            }
        } else {
            const topic = await ctx.findTopic(m.topicId);
            if (!topic) note(m.id, `topic_id ${m.topicId} does not exist in GenPrep`);
            else found.push({ key: m.id, topic });
        }

        for (const f of found) {
            const data = { ...m.data, topicId: f.topic._id, chapterId: f.topic.chapterId, subjectId: f.topic.subjectId, examId: f.topic.examId };
            const error = validateQuestion(data);
            if (error) note(m.id, error);
            else targets.push({ rowId: m.id, key: f.key, data });
        }
    }

    // Write everything in one go
    if (targets.length) {
        const keys = targets.map((t) => t.key);
        const existing = await Question.find({ "external.source": source.name, "external.id": { $in: keys } })
            .select("external.id")
            .lean();
        const have = new Set(existing.map((d) => d.external.id));
        const now = new Date();

        const ops = [];
        for (const t of targets) {
            const update = {
                $set: { ...t.data, "external.source": source.name, "external.id": t.key, "external.rowId": t.rowId, "external.syncedAt": now },
                $inc: { version: 1 },
            };
            if (have.has(t.key)) {
                ops.push({ updateOne: { filter: { "external.source": source.name, "external.id": t.key }, update } });
                continue;
            }
            const adoptedId = await ctx.adopt(t.data);
            if (adoptedId) ops.push({ updateOne: { filter: { _id: adoptedId }, update } });
            else ops.push({ updateOne: { filter: { "external.source": source.name, "external.id": t.key }, update, upsert: true } });
        }

        const failed = new Set();
        try {
            await Question.bulkWrite(ops, { ordered: false });
        } catch (err) {
            if (!err.writeErrors) throw err;
            for (const we of err.writeErrors) {
                const t = targets[we.index];
                failed.add(we.index);
                note(t.rowId, we.code === 11000 ? "Saved at the same time by another sync; will retry next sync" : `Save failed: ${we.errmsg || we.message}`);
            }
        }
        targets.forEach((t, i) => {
            if (!failed.has(i)) outcomes.get(t.rowId).saved += 1;
        });

        // A row that no longer lists an exam: hide the copy for that exam
        if (multiExamRows.size) {
            await Question.updateMany(
                {
                    "external.source": source.name,
                    "external.rowId": { $in: [...multiExamRows] },
                    "external.id": { $nin: keys },
                    status: { $ne: "archived" },
                },
                { $set: { status: "archived", "external.syncedAt": now } }
            );
        }
    }

    const archivedCount = await archiveRowIds(source, toArchive);

    return order.map((id) => {
        const o = outcomes.get(id);
        if (o.archived) return { result: archivedCount ? "archived" : "skipped", id, reason: archivedCount ? undefined : "Rejected/deleted row that was never imported" };
        if (o.saved > 0) return { result: "upserted", id, reason: o.reasons.length ? o.reasons.join("; ") : undefined };
        return { result: "skipped", id, reason: o.reasons.join("; ") || "Not imported" };
    });
};

const tally = () => ({ upserted: 0, skipped: 0, archived: 0, skippedRows: [], reasons: new Map() });

const record = (counts, outcome) => {
    counts[outcome.result] += 1;
    if (outcome.reason && (outcome.result === "skipped" || outcome.result === "upserted")) {
        counts.skippedRows.push({ id: outcome.id || "?", reason: outcome.reason });
        for (const r of outcome.reason.split("; ")) counts.reasons.set(r, (counts.reasons.get(r) || 0) + 1);
    }
};

const PAGE_CHUNK = 250; // rows per bulk write

const applyRows = async (source, rows, ctx, counts) => {
    for (let i = 0; i < rows.length; i += PAGE_CHUNK) {
        const outcomes = await applyBatch(source, rows.slice(i, i + PAGE_CHUNK), ctx);
        outcomes.forEach((o) => record(counts, o));
    }
};

// ---------- Finding rows deleted in Supabase ----------

const reconcileDeletes = async (source, reader, deadline) => {
    const ids = [];
    let afterId = null;
    for (;;) {
        if (Date.now() > deadline) return { done: false };
        const page = await reader.ids({ afterId, limit: ID_PAGE_SIZE });
        page.forEach((r) => ids.push(String(r.id)));
        if (page.length < ID_PAGE_SIZE) break;
        afterId = page[page.length - 1].id;
    }

    const filter = { "external.source": source.name, status: { $ne: "archived" } };
    if (ids.length === 0) {
        // An empty table usually means a wrong key (row level security hides rows from
        // the anon key) rather than every question being deleted. Don't archive anything.
        const existing = await Question.countDocuments(filter);
        if (existing > 0) {
            return {
                done: true,
                archived: 0,
                warning: "Supabase returned no rows, so nothing was archived. Check the table name, and for the REST API that the key is the service_role key.",
            };
        }
        return { done: true, archived: 0 };
    }

    const r = await Question.updateMany(
        { ...filter, "external.rowId": { $nin: ids } },
        { $set: { status: "archived", "external.syncedAt": new Date() } }
    );
    return { done: true, archived: r.modifiedCount };
};

// ---------- One database ----------

const syncSource = async (source, { full = false, deadline, defaultStatus, pendingStatus }) => {
    let state = await SyncState.findOne({ source: source.name });
    if (!state) state = new SyncState({ source: source.name });

    if (full || state.fullRequested) {
        state.cursor = { updatedAt: null, id: null };
        state.pendingReconcile = true;
        state.fullRequested = false;
    }
    // Table changed from/to having an updated_at column
    const wantedMode = source.updatedColumn ? "updated" : "id";
    if (state.mode !== wantedMode) {
        state.mode = wantedMode;
        state.cursor = { updatedAt: null, id: null };
    }

    state.lastRunAt = new Date();
    state.warning = "";
    const counts = tally();
    const ctx = await makeContext({ defaultStatus, pendingStatus });
    const reader = readerFor(source);
    let reachedEnd = false;

    try {
        while (Date.now() < deadline) {
            let rows;
            try {
                rows = await reader.page({ mode: state.mode, cursor: state.cursor, limit: PAGE_SIZE });
            } catch (err) {
                if (state.mode === "updated" && isMissingColumn(err)) {
                    // No updated_at column: fall back to walking the table by id
                    state.mode = "id";
                    state.cursor = { updatedAt: null, id: null };
                    state.warning = `Column "${source.updatedColumn}" not found, so edits are picked up only by webhooks or a full resync. Run supabase/setup.sql to add it.`;
                    continue;
                }
                throw err;
            }

            await applyRows(source, rows, ctx, counts);

            if (rows.length) {
                const last = rows[rows.length - 1];
                // Postgres rows carry the exact timestamp text in __genprep_ts; REST rows already have text
                const ts = last.__genprep_ts ?? last[source.updatedColumn];
                state.cursor = {
                    updatedAt: state.mode === "updated" && ts != null ? String(ts) : null,
                    id: String(last.id),
                };
            }
            await state.save(); // keep progress even if the function is stopped

            if (rows.length < PAGE_SIZE) {
                reachedEnd = true;
                break;
            }
        }

        if (reachedEnd && state.mode === "updated") {
            if (await reader.hasBlankUpdated()) {
                state.warning = `Some rows have an empty "${source.updatedColumn}" and are only picked up by webhooks. Run supabase/setup.sql to fill it in.`;
            }
        }

        if (reachedEnd && state.mode === "id") {
            // Without updated_at we can't tell what changed, so start over next time
            state.cursor = { updatedAt: null, id: null };
        }

        if (reachedEnd && state.pendingReconcile) {
            const rec = await reconcileDeletes(source, reader, deadline);
            if (rec.done) {
                counts.archived += rec.archived || 0;
                state.pendingReconcile = false;
                if (rec.warning) state.warning = rec.warning;
            }
        }

        state.caughtUp = reachedEnd;
        state.lastSuccessAt = new Date();
        state.lastError = "";
    } catch (err) {
        state.lastError = err.message;
        state.caughtUp = false;
    }

    state.lastRun = { upserted: counts.upserted, skipped: counts.skipped, archived: counts.archived };
    state.totals = {
        upserted: (state.totals?.upserted || 0) + counts.upserted,
        skipped: (state.totals?.skipped || 0) + counts.skipped,
        archived: (state.totals?.archived || 0) + counts.archived,
    };
    if (counts.skippedRows.length) {
        state.recentSkipped = counts.skippedRows.concat(state.recentSkipped || []).slice(0, MAX_RECENT_SKIPPED);
    }
    await state.save();

    return {
        source: source.name,
        caughtUp: state.caughtUp,
        upserted: counts.upserted,
        skipped: counts.skipped,
        archived: counts.archived,
        error: state.lastError || undefined,
        warning: state.warning || undefined,
        topReasons: [...counts.reasons.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([reason, count]) => ({ reason, count })),
    };
};

// ---------- All databases ----------

// budgetMs keeps us inside Vercel's 60 second function limit.
// Anything unfinished continues on the next run from the saved cursor.
const syncAll = async ({ full = false, only = null, budgetMs = 45000 } = {}) => {
    const { sources, problems, defaultStatus, pendingStatus } = getSources();
    const deadline = Date.now() + budgetMs;

    let list = only ? sources.filter((s) => s.name === only) : sources;
    if (only && list.length === 0) throw new Error(`No Supabase database named "${only}"`);

    // Databases that waited longest go first, so none is starved
    const states = await SyncState.find({ source: { $in: list.map((s) => s.name) } }).select("source lastRunAt").lean();
    const lastRun = new Map(states.map((s) => [s.source, s.lastRunAt ? new Date(s.lastRunAt).getTime() : 0]));
    list = [...list].sort((a, b) => (lastRun.get(a.name) || 0) - (lastRun.get(b.name) || 0));

    // A full resync may need several calls; remember it for databases not reached in this one
    if (full) {
        await Promise.all(list.map((s) => SyncState.updateOne({ source: s.name }, { $set: { fullRequested: true } }, { upsert: true })));
    }

    const results = [];
    for (const source of list) {
        if (Date.now() > deadline) {
            results.push({ source: source.name, caughtUp: false, pending: true });
            continue;
        }
        results.push(await syncSource(source, { full, deadline, defaultStatus, pendingStatus }));
    }

    return { configured: sources.length, problems, results, done: results.every((r) => r.caughtUp) };
};

// ---------- Webhook ----------

// payload: { type: "INSERT" | "UPDATE" | "DELETE", table, schema, record, old_record }
const handleWebhook = async (sourceName, payload) => {
    const { sources, defaultStatus, pendingStatus } = getSources();
    const source = sources.find((s) => s.name === sourceName);
    if (!source) {
        const err = new Error(`No Supabase database named "${sourceName}"`);
        err.status = 404;
        throw err;
    }
    if (!payload || !payload.type) {
        const err = new Error("Not a Supabase webhook payload");
        err.status = 400;
        throw err;
    }
    if (payload.table && payload.table !== source.table) {
        return { result: "ignored", reason: `Table ${payload.table} is not ${source.table}` };
    }

    let outcome;
    if (payload.type === "DELETE") {
        const id = payload.old_record && payload.old_record.id;
        if (id === undefined || id === null) return { result: "ignored", reason: "DELETE without old_record.id" };
        const n = await archiveRowIds(source, [id]);
        outcome = { result: n ? "archived" : "skipped", id: String(id) };
    } else if (payload.type === "INSERT" || payload.type === "UPDATE") {
        const ctx = await makeContext({ defaultStatus, pendingStatus, single: true });
        [outcome] = await applyBatch(source, [payload.record], ctx);
    } else {
        return { result: "ignored", reason: `Unknown event ${payload.type}` };
    }

    const update = { $set: { lastWebhookAt: new Date() }, $inc: { [`totals.${outcome.result}`]: 1 } };
    if (outcome.reason) {
        update.$push = { recentSkipped: { $each: [{ id: outcome.id || "?", reason: outcome.reason }], $position: 0, $slice: MAX_RECENT_SKIPPED } };
    }
    await SyncState.updateOne({ source: source.name }, update, { upsert: true });

    return outcome;
};

// ---------- Status for the admin dashboard ----------

const getStatus = async () => {
    const { sources, problems } = getSources();
    const names = sources.map((s) => s.name);
    const [states, counts] = await Promise.all([
        SyncState.find({ source: { $in: names } }).lean(),
        Question.aggregate([
            { $match: { "external.source": { $in: names } } },
            { $group: { _id: { s: "$external.source", st: "$status" }, n: { $sum: 1 } } },
        ]),
    ]);
    const byName = new Map(states.map((s) => [s.source, s]));
    const countMap = {};
    counts.forEach((c) => {
        countMap[c._id.s] = countMap[c._id.s] || {};
        countMap[c._id.s][c._id.st] = c.n;
    });

    return {
        problems,
        webhookSecretSet: Boolean(process.env.SUPABASE_WEBHOOK_SECRET),
        sources: sources.map((s) => {
            const st = byName.get(s.name) || {};
            return {
                name: s.name,
                host: s.host,
                connection: s.kind,
                table: s.table,
                updatedColumn: s.updatedColumn,
                mode: st.mode || (s.updatedColumn ? "updated" : "id"),
                caughtUp: Boolean(st.caughtUp),
                lastRunAt: st.lastRunAt || null,
                lastSuccessAt: st.lastSuccessAt || null,
                lastWebhookAt: st.lastWebhookAt || null,
                lastError: st.lastError || "",
                warning: st.warning || "",
                lastRun: st.lastRun || null,
                recentSkipped: (st.recentSkipped || []).slice(0, 10),
                questions: countMap[s.name] || {},
            };
        }),
    };
};

module.exports = { syncAll, handleWebhook, getStatus, applyBatch, SupabaseError };
