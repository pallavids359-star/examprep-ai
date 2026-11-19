// Shows how many Supabase questions are in GenPrep so far. Read-only.
// Put in C:\examprep-ai\server\seed\ and run:  node seed/checkProgress.js
require("dotenv").config({ quiet: true });
require("dns").setServers(["8.8.8.8", "1.1.1.1"]);
const m = require("mongoose");

(async () => {
    await m.connect(process.env.MONGO_URI);
    const db = m.connection.db;
    const rows = await db
        .collection("questions")
        .aggregate([
            { $match: { "external.source": { $exists: true } } },
            { $group: { _id: { s: "$external.source", st: "$status" }, n: { $sum: 1 } } },
            { $sort: { "_id.s": 1, "_id.st": 1 } },
        ])
        .toArray();
    if (!rows.length) console.log("No Supabase questions saved yet (still working, or not started).");
    for (const r of rows) console.log(`${r._id.s.padEnd(10)} ${r._id.st.padEnd(10)} ${r.n}`);
    const states = await db.collection("syncstates").find().toArray();
    for (const s of states) console.log(`${s.source.padEnd(10)} last run ${s.lastRunAt ? s.lastRunAt.toLocaleTimeString() : "-"}${s.lastError ? "  ERROR: " + s.lastError : ""}`);
    await m.disconnect();
})().catch((e) => {
    console.log("ERROR:", e.message);
    process.exit(1);
});
