// One-time: fill in each question's "format" (assertion & reason, match the following, ...)
//   node seed/setQuestionFormats.js
require("dotenv").config();
require("dns").setServers(["8.8.8.8"]);
const mongoose = require("mongoose");
const { formatOf } = require("../utils/questionFormat");

(async () => {
    await mongoose.connect(process.env.MONGO_URI);
    const col = mongoose.connection.db.collection("questions");
    const counts = {};
    let ops = [];
    const cursor = col.find({}, { projection: { type: 1, tags: 1, text: 1, format: 1 } });
    for await (const q of cursor) {
        const f = formatOf(q);
        counts[f] = (counts[f] || 0) + 1;
        if (q.format !== f) ops.push({ updateOne: { filter: { _id: q._id }, update: { $set: { format: f } } } });
        if (ops.length >= 1000) {
            await col.bulkWrite(ops, { ordered: false });
            ops = [];
        }
    }
    if (ops.length) await col.bulkWrite(ops, { ordered: false });
    console.log("Question types:", counts);
    await mongoose.disconnect();
})().catch((e) => {
    console.error("Failed:", e.message);
    process.exit(1);
});
