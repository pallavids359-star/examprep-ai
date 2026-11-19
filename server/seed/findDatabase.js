// READ-ONLY: lists every database in your MongoDB cluster with its exams and question count,
// so you can see which one your live website uses.
// Put in C:\examprep-ai\server\seed\ and run:  node seed/findDatabase.js
require("dotenv").config({ quiet: true });
require("dns").setServers(["8.8.8.8", "1.1.1.1"]);
const m = require("mongoose");

(async () => {
    await m.connect(process.env.MONGO_URI);
    console.log("Your .env MONGO_URI uses database:", m.connection.name, "\n");
    const { databases } = await m.connection.db.admin().listDatabases();
    for (const d of databases) {
        if (["admin", "local", "config"].includes(d.name)) continue;
        const db = m.connection.client.db(d.name);
        const cols = (await db.listCollections().toArray()).map((c) => c.name);
        const exams = cols.includes("exams") ? (await db.collection("exams").find().project({ code: 1 }).toArray()).map((e) => e.code) : [];
        const questions = cols.includes("questions") ? await db.collection("questions").estimatedDocumentCount() : 0;
        const users = cols.includes("users") ? await db.collection("users").estimatedDocumentCount() : 0;
        console.log(`Database "${d.name}"   exams: [${exams.join(", ")}]   questions: ${questions}   users: ${users}`);
    }
    await m.disconnect();
})().catch((e) => {
    console.log("ERROR:", e.message);
    process.exit(1);
});
