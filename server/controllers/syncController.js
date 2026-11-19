const crypto = require("crypto");
const { syncAll, handleWebhook, getStatus } = require("../utils/supabaseSync");

// Compares secrets without leaking their length or content through timing
const safeEqual = (a, b) => {
    const x = crypto.createHash("sha256").update(String(a || "")).digest();
    const y = crypto.createHash("sha256").update(String(b || "")).digest();
    return crypto.timingSafeEqual(x, y);
};

const bearer = (req) => String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");

// POST /api/sync/supabase/webhook?source=physics
// Called by a Supabase Database Webhook on insert, update and delete.
// The webhook must send the header  x-webhook-secret: <SUPABASE_WEBHOOK_SECRET>
const supabaseWebhook = async (req, res) => {
    const secret = process.env.SUPABASE_WEBHOOK_SECRET;
    if (!secret) return res.status(503).json({ message: "SUPABASE_WEBHOOK_SECRET is not set on the server" });

    const given = req.headers["x-webhook-secret"] || bearer(req);
    if (!safeEqual(given, secret)) return res.status(401).json({ message: "Wrong webhook secret" });

    const source = String(req.query.source || "").toLowerCase();
    if (!source) return res.status(400).json({ message: "Add ?source=<database name> to the webhook URL" });

    try {
        const outcome = await handleWebhook(source, req.body);
        res.json(outcome);
    } catch (error) {
        if (error.status) return res.status(error.status).json({ message: error.message });
        console.error("supabaseWebhook error:", error.message);
        res.status(500).json({ message: "Could not save the question" });
    }
};

// GET /api/sync/cron   (Vercel Cron sends  Authorization: Bearer <CRON_SECRET>)
const cronSync = async (req, res) => {
    const secret = process.env.CRON_SECRET;
    if (!secret) return res.status(503).json({ message: "CRON_SECRET is not set on the server" });
    if (!safeEqual(bearer(req), secret)) return res.status(401).json({ message: "Unauthorized" });

    try {
        const result = await syncAll();
        res.json(result);
    } catch (error) {
        console.error("cronSync error:", error.message);
        res.status(500).json({ message: error.message });
    }
};

// POST /api/admin/sync/supabase   Body: { full?: boolean, source?: "physics" }
const runSync = async (req, res) => {
    try {
        const full = req.body && req.body.full === true;
        const only = req.body && req.body.source ? String(req.body.source).toLowerCase() : null;
        const result = await syncAll({ full, only });
        res.json(result);
    } catch (error) {
        console.error("runSync error:", error.message);
        res.status(400).json({ message: error.message });
    }
};

// GET /api/admin/sync/status
const syncStatus = async (req, res) => {
    try {
        res.json(await getStatus());
    } catch (error) {
        console.error("syncStatus error:", error.message);
        res.status(500).json({ message: "Something went wrong on the server" });
    }
};

module.exports = { supabaseWebhook, cronSync, runSync, syncStatus };
