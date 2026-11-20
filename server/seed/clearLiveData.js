// Deletes ALL live tests, every student attempt/report of those live tests, and ALL lecturer accounts.
// Questions, mock tests, practice history, students and admin accounts are NOT touched.
//
//   node seed/clearLiveData.js          -> only shows what would be deleted
//   node seed/clearLiveData.js --yes    -> deletes it (cannot be undone)
require("dotenv").config();
require("dns").setServers(["8.8.8.8"]);
const mongoose = require("mongoose");

(async () => {
    if (!process.env.MONGO_URI) throw new Error("MONGO_URI is missing in server/.env");
    await mongoose.connect(process.env.MONGO_URI);
    const db = mongoose.connection.db;
    const tests = db.collection("tests");
    const attempts = db.collection("testattempts");
    const users = db.collection("users");
    const tokens = db.collection("refreshtokens");

    const liveIds = (await tests.find({ type: "live" }).project({ _id: 1 }).toArray()).map((t) => t._id);
    const lecturerIds = (await users.find({ role: "lecturer" }).project({ _id: 1 }).toArray()).map((u) => u._id);
    const attemptFilter = { $or: [{ testId: { $in: liveIds } }, { mode: "live" }] };

    console.log("Database:", db.databaseName);
    console.log("Live tests:            ", liveIds.length);
    console.log("Live test attempts:    ", await attempts.countDocuments(attemptFilter));
    console.log("Lecturer accounts:     ", lecturerIds.length);

    if (!process.argv.includes("--yes")) {
        console.log("\nNothing deleted. Run again with --yes to delete all of the above.");
        return mongoose.disconnect();
    }

    const a = await attempts.deleteMany(attemptFilter);
    const t = await tests.deleteMany({ type: "live" });
    const r = lecturerIds.length ? await tokens.deleteMany({ userId: { $in: lecturerIds } }) : { deletedCount: 0 };
    const u = await users.deleteMany({ role: "lecturer" });
    console.log("\nDeleted:");
    console.log("  live test attempts:", a.deletedCount);
    console.log("  live tests:        ", t.deletedCount);
    console.log("  lecturer logins:   ", r.deletedCount);
    console.log("  lecturer accounts: ", u.deletedCount);
    console.log("Done. Questions, mock tests, students and admins were not touched.");
    await mongoose.disconnect();
})().catch(async (e) => {
    console.error("Failed:", e.message);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
});
