// Puts a backup back into MongoDB.  node scripts/restore.js backups/2026-11-26 [collection]
// Only fills EMPTY collections, so nothing is ever overwritten. To replace data, empty the collection first.
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const readline = require("readline");
const mongoose = require("mongoose");
const { EJSON } = mongoose.mongo.BSON;

(async () => {
    const dir = process.argv[2];
    const only = process.argv[3];
    if (!dir || !fs.existsSync(dir)) throw new Error("Give the backup folder, e.g. backups/2026-11-26");
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 20000 });
    const db = mongoose.connection.db;
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".json.gz"))) {
        const name = f.replace(/\.json\.gz$/, "");
        if (only && name !== only) continue;
        if ((await db.collection(name).estimatedDocumentCount()) > 0) {
            console.log(`${name}: skipped (not empty)`);
            continue;
        }
        const lines = readline.createInterface({ input: fs.createReadStream(path.join(dir, f)).pipe(zlib.createGunzip()) });
        let batch = [];
        let n = 0;
        for await (const line of lines) {
            if (!line.trim()) continue;
            batch.push(EJSON.parse(line, { relaxed: false }));
            if (batch.length === 500) {
                await db.collection(name).insertMany(batch);
                n += batch.length;
                batch = [];
            }
        }
        if (batch.length) await db.collection(name).insertMany(batch);
        console.log(`${name}: ${n + batch.length} restored`);
    }
    await mongoose.disconnect();
})().catch((e) => {
    console.error("Restore failed:", e.message);
    process.exit(1);
});
