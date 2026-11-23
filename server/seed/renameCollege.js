// One-time: change the college name "MB PU" (any spacing or case) to "MBPU" everywhere
//   node seed/renameCollege.js
require("dotenv").config();
require("dns").setServers(["8.8.8.8"]);
const mongoose = require("mongoose");

(async () => {
    await mongoose.connect(process.env.MONGO_URI);
    const db = mongoose.connection.db;
    const old = /^\s*mb\s*pu\s*$/i;
    const users = await db.collection("users").updateMany({ college: old }, { $set: { college: "MBPU" } });
    const tests = await db.collection("tests").updateMany({ "live.college": old }, { $set: { "live.college": "MBPU" } });
    const assignments = await db.collection("assignments").updateMany({ college: old }, { $set: { college: "MBPU" } });
    console.log(`Renamed to MBPU: ${users.modifiedCount} students, ${tests.modifiedCount} live tests, ${assignments.modifiedCount} assignments`);
    await mongoose.disconnect();
})().catch((e) => {
    console.error("Failed:", e.message);
    process.exit(1);
});
