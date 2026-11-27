// Why are some chapters' questions not showing when picking questions for an assignment?
// Run from the server folder:   node seed/whyMissing.js "Chemistry assignment – 27 Nov"
// (no title = the newest assignment). Prints, per chapter, how many questions exist and why each group is left out.
require("dotenv").config();
require("dns").setServers(["8.8.8.8", "1.1.1.1"]);
const mongoose = require("mongoose");

(async () => {
    await mongoose.connect(process.env.MONGO_URI);
    const db = mongoose.connection.db;
    const title = process.argv[2];
    const a = title
        ? await db.collection("assignments").findOne({ title })
        : await db.collection("assignments").find().sort({ createdAt: -1 }).limit(1).next();
    if (!a) {
        console.log("No assignment found" + (title ? ` called "${title}"` : ""));
        return mongoose.disconnect();
    }
    const exam = await db.collection("exams").findOne({ _id: a.examId });
    const subject = await db.collection("subjects").findOne({ _id: a.subjectId });
    const chosenTopics = new Set((a.settings?.topicIds || []).map(String));
    const jeeOnly = ["multi_correct", "numerical"];
    console.log(`\n${a.title}  ·  ${exam?.code} ${subject?.name}  ·  class ${a.settings?.classLevel}  ·  ${chosenTopics.size} concepts chosen\n`);

    const rows = [];
    for (const cid of a.settings?.chapterIds || []) {
        const ch = await db.collection("chapters").findOne({ _id: new mongoose.Types.ObjectId(String(cid)) });
        const qs = await db.collection("questions").find({ chapterId: ch?._id }).project({ status: 1, examId: 1, subjectId: 1, format: 1, topicId: 1 }).toArray();
        const topicsHere = (await db.collection("topics").find({ chapterId: ch?._id }).project({ _id: 1 }).toArray()).map((t) => String(t._id));
        const limited = topicsHere.some((t) => chosenTopics.has(t));
        const r = { chapter: (ch?.name || String(cid)).slice(0, 38), class: ch?.classLevel, total: qs.length, draft: 0, otherExam: 0, otherSubject: 0, jeeOnlyType: 0, otherConcept: 0, USABLE: 0 };
        for (const q of qs) {
            if (q.status !== "published") r.draft++;
            else if (String(q.examId) !== String(a.examId)) r.otherExam++;
            else if (String(q.subjectId) !== String(a.subjectId)) r.otherSubject++;
            else if (exam?.code !== "JEE" && jeeOnly.includes(q.format)) r.jeeOnlyType++;
            else if (limited && !chosenTopics.has(String(q.topicId))) r.otherConcept++;
            else r.USABLE++;
        }
        rows.push(r);
    }
    console.table(rows);
    console.log("draft = not published yet (Admin → Draft questions)   otherExam / otherSubject = saved under a different exam or subject");
    console.log("jeeOnlyType = multiple-correct / numerical, not used for NEET/KCET   otherConcept = outside the concepts you ticked\n");
    await mongoose.disconnect();
})().catch((e) => {
    console.error(e.message);
    process.exit(1);
});
