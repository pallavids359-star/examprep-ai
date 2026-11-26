// Saves every MongoDB collection to backups/<date>/<collection>.json.gz (Extended JSON, one document per line).
// Run:  node scripts/backup.js            (needs MONGO_URI in .env or the environment)
// Restore one backup:  node scripts/restore.js backups/2026-11-26
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const mongoose = require("mongoose");
const { EJSON } = mongoose.mongo.BSON;

(async () => {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 20000 });
    const db = mongoose.connection.db;
    const day = new Date().toISOString().slice(0, 10);
    const dir = path.join(__dirname, "..", "backups", day);
    fs.mkdirSync(dir, { recursive: true });

    const collections = (await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name).filter((n) => !n.startsWith("system."));
    let total = 0;
    for (const name of collections) {
        const out = zlib.createGzip();
        const file = fs.createWriteStream(path.join(dir, `${name}.json.gz`));
        out.pipe(file);
        let n = 0;
        for await (const doc of db.collection(name).find()) {
            if (!out.write(EJSON.stringify(doc, { relaxed: false }) + "\n")) await new Promise((r) => out.once("drain", r));
            n++;
        }
        out.end();
        await new Promise((r) => file.on("finish", r));
        console.log(`${name}: ${n}`);
        total += n;
    }
    console.log(`Backup done: ${collections.length} collections, ${total} documents -> ${dir}`);
    await mongoose.disconnect();
})().catch((e) => {
    console.error("Backup failed:", e.message);
    process.exit(1);
});
