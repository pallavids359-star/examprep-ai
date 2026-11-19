// READ-ONLY: per exam and subject, how many published questions there are,
// how many have a diagram, and how many are numerical.
//   node seed/countDiagrams.js
require("dotenv").config({ quiet: true });
require("dns").setServers(["8.8.8.8", "1.1.1.1"]);
const m = require("mongoose");

const IMG = /\{\{IMG::/;
const HAS_DIAGRAM = {
    $or: [{ "images.0": { $exists: true } }, { "options.image.url": { $exists: true } }, { text: IMG }, { "options.text": IMG }],
};

(async () => {
    await m.connect(process.env.MONGO_URI);
    const db = m.connection.db;
    const exams = await db.collection("exams").find().sort({ code: 1 }).toArray();
    console.log("Exam   Subject        Published  Diagrams  Numerical");
    for (const e of exams) {
        const subjects = await db.collection("subjects").find({ examId: e._id }).sort({ order: 1 }).toArray();
        for (const s of subjects) {
            const base = { examId: e._id, subjectId: s._id, status: "published" };
            const [all, diag, num] = await Promise.all([
                db.collection("questions").countDocuments(base),
                db.collection("questions").countDocuments({ ...base, $and: [HAS_DIAGRAM] }),
                db.collection("questions").countDocuments({ ...base, type: "numerical" }),
            ]);
            console.log(`${e.code.padEnd(6)} ${s.name.padEnd(14)} ${String(all).padStart(9)} ${String(diag).padStart(9)} ${String(num).padStart(10)}`);
        }
    }
    await m.disconnect();
})().catch((e) => {
    console.log("ERROR:", e.message);
    process.exit(1);
});
