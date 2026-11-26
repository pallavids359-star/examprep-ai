// Saves errors to the AppError collection (never throws, never loops).
const crypto = require("crypto");

let saving = false;
const cut = (v, n) => String(v || "").slice(0, n);

const logError = async ({ where, message, stack, page, device, role }) => {
    if (saving) return;
    try {
        saving = true;
        const mongoose = require("mongoose");
        if (mongoose.connection.readyState !== 1) return; // no database yet
        const AppError = require("../models/AppError");
        const msg = cut(message, 500).replace(/postgres(ql)?:\/\/\S+|mongodb(\+srv)?:\/\/\S+/gi, "[connection]");
        const key = crypto.createHash("sha1").update(`${where}|${msg}|${cut(page, 120).replace(/[0-9a-f]{24}/gi, ":id")}`).digest("hex");
        await AppError.updateOne(
            { key },
            {
                $setOnInsert: { key, where, message: msg, stack: cut(stack, 3000), page: cut(page, 300), firstAt: new Date() },
                $set: { lastAt: new Date(), device: cut(device, 300), role: role || "" },
                $inc: { count: 1 },
            },
            { upsert: true }
        );
    } catch {
        /* never let logging break anything */
    } finally {
        saving = false;
    }
};

// Every console.error on the server is also saved (controllers log their errors this way)
const captureServerErrors = () => {
    const original = console.error.bind(console);
    console.error = (...args) => {
        original(...args);
        const text = args.map((a) => (a instanceof Error ? a.message : typeof a === "string" ? a : JSON.stringify(a))).join(" ");
        const err = args.find((a) => a instanceof Error);
        logError({ where: "server", message: text, stack: err?.stack });
    };
};

module.exports = { logError, captureServerErrors };
