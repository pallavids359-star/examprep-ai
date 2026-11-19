// Fixes "E11000 duplicate key error ... tests index: access_code_1 dup key: { access_code: null }".
// An old unique index on tests.access_code (not used by GenPrep) allows only ONE test without
// an access code. This replaces it with the same rule applied only to tests that HAVE a code.
//   node seed/fixTestsIndex.js        -> only shows what it would do
//   node seed/fixTestsIndex.js yes    -> fixes it
require("dotenv").config({ quiet: true });
require("dns").setServers(["8.8.8.8", "1.1.1.1"]);
const m = require("mongoose");

(async () => {
    await m.connect(process.env.MONGO_URI);
    const col = m.connection.db.collection("tests");
    console.log("Database:", m.connection.name);

    const indexes = await col.indexes();
    const bad = indexes.filter((i) => i.unique && !i.partialFilterExpression && Object.keys(i.key).some((k) => k !== "_id" && !["examId", "status", "ownerId", "createdBy"].includes(k)));
    console.log("Indexes on tests:", indexes.map((i) => `${i.name}${i.unique ? " (unique)" : ""}`).join(", "));
    const withCode = await col.countDocuments({ access_code: { $type: "string" } });
    console.log("Tests that have an access_code:", withCode);

    if (!bad.length) {
        console.log("Nothing to fix.");
        return m.disconnect();
    }
    for (const i of bad) console.log(`Will change: ${i.name} -> unique only when the field is set`);

    if (process.argv[2] !== "yes") {
        console.log("\nNothing changed yet. Run again with  yes  to fix it.");
        return m.disconnect();
    }
    for (const i of bad) {
        await col.dropIndex(i.name);
        const field = Object.keys(i.key)[0];
        await col.createIndex(i.key, { name: i.name, unique: true, partialFilterExpression: { [field]: { $type: "string" } } });
        console.log("Fixed:", i.name);
    }
    await m.disconnect();
})().catch(async (e) => {
    console.log("ERROR:", e.message);
    await m.disconnect().catch(() => {});
    process.exit(1);
});
