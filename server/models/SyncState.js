const mongoose = require("mongoose");

// One document per Supabase database: where the last sync stopped and how it went
const syncStateSchema = new mongoose.Schema(
    {
        source: { type: String, required: true, unique: true },

        // Last row processed. updatedAt is kept as the exact text Postgres sent,
        // because JavaScript dates drop the microseconds Postgres stores.
        cursor: {
            updatedAt: { type: String, default: null },
            id: { type: String, default: null },
        },
        mode: { type: String, enum: ["updated", "id"], default: "updated" },
        caughtUp: { type: Boolean, default: false },
        pendingReconcile: { type: Boolean, default: false },

        lastRunAt: { type: Date },
        lastSuccessAt: { type: Date },
        lastWebhookAt: { type: Date },
        lastError: { type: String, default: "" },

        lastRun: {
            upserted: { type: Number, default: 0 },
            skipped: { type: Number, default: 0 },
            archived: { type: Number, default: 0 },
        },
        totals: {
            upserted: { type: Number, default: 0 },
            skipped: { type: Number, default: 0 },
            archived: { type: Number, default: 0 },
        },
        // A few recent rows that could not be imported, with the reason
        recentSkipped: {
            type: [{ id: String, reason: String, _id: false }],
            default: [],
        },
        warning: { type: String, default: "" },
    },
    { timestamps: true }
);

module.exports = mongoose.model("SyncState", syncStateSchema);
