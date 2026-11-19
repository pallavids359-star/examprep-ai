// Runs the Supabase -> GenPrep sync from your computer (no 60-second Vercel limit).
// Use it for the first big import. It only READS from Supabase.
//
//   node seed/syncSupabase.js          import new and changed questions
//   node seed/syncSupabase.js full     re-read everything and hide questions deleted in Supabase
//   node seed/syncSupabase.js db3      only one database (its SUPABASE_N_NAME, or db1..db8)
//
// Uses MONGO_URI and SUPABASE_N_DB_URL from server/.env. Make sure MONGO_URI points to the
// same database as the live site (same name after .mongodb.net/ ), or the questions go elsewhere.
require("dotenv").config();
if (!process.env.VERCEL) require("dns").setServers(["8.8.8.8", "1.1.1.1"]);
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const { syncAll } = require("../utils/supabaseSync");
const { getSources } = require("../config/supabaseSources");

(async () => {
    const args = process.argv.slice(2).map((a) => a.toLowerCase());
    const full = args.includes("full");
    const only = args.find((a) => a !== "full") || null;

    await connectDB();
    console.log("MongoDB database:", mongoose.connection.name);

    const totals = new Map();
    const { sources, problems } = getSources();
    problems.forEach((p) => console.log("!!", p));
    if (!sources.length) console.log("No SUPABASE_N_DB_URL found in server/.env");
    const list = only ? sources.filter((s) => s.name === only) : sources;

    // One database at a time, so "full" really starts every database from the beginning
    for (const source of list) {
        let round = 0;
        for (;;) {
            round += 1;
            const r = await syncAll({ full: full && round === 1, only: source.name, budgetMs: 10 * 60 * 1000 });
            const x = r.results[0];
            console.log(
                `${x.source.padEnd(12)} saved ${String(x.upserted || 0).padStart(6)}   archived ${String(x.archived || 0).padStart(5)}   skipped ${String(x.skipped || 0).padStart(5)}` +
                    (x.caughtUp ? "   done" : "   ...") +
                    (x.error ? `   ERROR: ${x.error}` : "") +
                    (x.warning ? `   NOTE: ${x.warning}` : "")
            );
            (x.topReasons || []).forEach((t) => totals.set(`${x.source}: ${t.reason}`, (totals.get(`${x.source}: ${t.reason}`) || 0) + t.count));
            if (x.caughtUp || x.error || round >= 20) break;
        }
    }

    if (totals.size) {
        console.log("\nWhy rows were not (fully) imported:");
        [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40).forEach(([k, n]) => console.log(`  ${String(n).padStart(6)}  ${k}`));
    }

    await mongoose.disconnect();
})().catch(async (e) => {
    console.log("ERROR:", e.message);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
});
