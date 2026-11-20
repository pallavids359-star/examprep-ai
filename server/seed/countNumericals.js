// How many MCQ and numerical questions each exam and subject has (JEE needs 5 numericals per subject per test).
//   node seed/countNumericals.js
require("dotenv").config();
require("dns").setServers(["8.8.8.8"]);
const mongoose = require("mongoose");
(async () => {
    await mongoose.connect(process.env.MONGO_URI);
    const db = mongoose.connection.db;
    const exams = await db.collection("exams").find().toArray();
    const subjects = await db.collection("subjects").find().toArray();
    for (const e of exams) {
        console.log(`\n${e.code}`);
        for (const s of subjects.filter((x) => String(x.examId) === String(e._id))) {
            const q = { examId: e._id, subjectId: s._id };
            const [mcq, num, numDraft] = await Promise.all([
                db.collection("questions").countDocuments({ ...q, status: "published", type: { $ne: "numerical" } }),
                db.collection("questions").countDocuments({ ...q, status: "published", type: "numerical" }),
                db.collection("questions").countDocuments({ ...q, status: "draft", type: "numerical" }),
            ]);
            console.log(`  ${s.name.padEnd(12)} MCQ: ${String(mcq).padStart(6)}   numerical: ${String(num).padStart(5)}${numDraft ? `   (+${numDraft} numerical in draft)` : ""}`);
        }
    }
    await mongoose.disconnect();
})().catch((e) => {
    console.error("Failed:", e.message);
    process.exit(1);
});
