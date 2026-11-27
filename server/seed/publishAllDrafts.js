// Publish every draft question at once (so students and assignments can use them).
//   node seed/publishAllDrafts.js          -> only shows how many would change (nothing is saved)
//   node seed/publishAllDrafts.js yes      -> publishes them
//   node seed/publishAllDrafts.js undo     -> puts back to draft only the ones this script published
// Drafts with no answer (or an MCQ with fewer than 2 options) are skipped, so broken questions never reach students.
require("dotenv").config();
require("dns").setServers(["8.8.8.8", "1.1.1.1"]);
const mongoose = require("mongoose");

(async () => {
    const mode = (process.argv[2] || "").toLowerCase();
    await mongoose.connect(process.env.MONGO_URI);
    const db = mongoose.connection.db;
    const Q = db.collection("questions");
    const exams = new Map((await db.collection("exams").find().toArray()).map((e) => [String(e._id), e.code]));
    const subjects = new Map((await db.collection("subjects").find().toArray()).map((s) => [String(s._id), s.name]));

    if (mode === "undo") {
        const r = await Q.updateMany({ bulkPublishedAt: { $exists: true } }, { $set: { status: "draft" }, $unset: { bulkPublishedAt: "" } });
        console.log(`Put back to draft: ${r.modifiedCount}`);
        return mongoose.disconnect();
    }

    const ok = [];
    const skipped = [];
    const count = {};
    const cur = Q.find({ status: "draft" }, { projection: { type: 1, options: 1, correctOptionIds: 1, numericalAnswer: 1, examId: 1, subjectId: 1 } });
    for await (const q of cur) {
        const hasAnswer = q.type === "numerical" ? q.numericalAnswer?.value != null : (q.correctOptionIds || []).length > 0 && (q.options || []).length >= 2;
        if (!hasAnswer) {
            skipped.push(q._id);
            continue;
        }
        ok.push(q._id);
        const k = `${(exams.get(String(q.examId)) || "?").padEnd(6)}${subjects.get(String(q.subjectId)) || "?"}`;
        count[k] = (count[k] || 0) + 1;
    }
    console.table(Object.entries(count).sort().map(([k, n]) => ({ "exam / subject": k, "will publish": n })));
    console.log(`Ready to publish: ${ok.length}   Skipped (no answer / too few options): ${skipped.length}`);

    if (mode !== "yes") {
        console.log('\nNothing changed. To publish them run:  node seed/publishAllDrafts.js yes');
        return mongoose.disconnect();
    }
    const now = new Date();
    let done = 0;
    for (let i = 0; i < ok.length; i += 2000) {
        const r = await Q.updateMany({ _id: { $in: ok.slice(i, i + 2000) }, status: "draft" }, { $set: { status: "published", bulkPublishedAt: now } });
        done += r.modifiedCount;
        process.stdout.write(`\rPublished ${done} / ${ok.length}`);
    }
    console.log(`\nDone. Published ${done}. (Undo with: node seed/publishAllDrafts.js undo)`);
    await mongoose.disconnect();
})().catch((e) => {
    console.error(e.message);
    process.exit(1);
});
