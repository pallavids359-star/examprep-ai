const mongoose = require("mongoose");
const { cloudinary, isCloudinaryReady } = require("../config/cloudinary");
const ImageBlob = require("../models/ImageBlob");

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_BYTES = 2 * 1024 * 1024;

// Sends the file's bytes to Cloudinary and waits for the result
const sendToCloudinary = (buffer) =>
    new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder: "examprep/questions", resource_type: "image" },
            (error, result) => (error ? reject(error) : resolve(result))
        );
        stream.end(buffer);
    });

// Full address of this server, as the browser sees it (works behind Render / Vercel)
const serverOrigin = (req) => `${req.get("x-forwarded-proto") || req.protocol}://${req.get("x-forwarded-host") || req.get("host")}`;

// Saves an image: Cloudinary when its keys are set, otherwise in MongoDB
const storeImage = async (req, buffer, mime) => {
    if (isCloudinaryReady()) {
        const result = await sendToCloudinary(buffer);
        return { url: result.secure_url, publicId: result.public_id };
    }
    const blob = await ImageBlob.create({ data: buffer, mime, size: buffer.length, uploadedBy: req.user?._id });
    return { url: `${serverOrigin(req)}/api/images/${blob._id}` };
};

// POST /api/admin/upload   (form field "image": a file from the computer or a pasted picture)
const uploadQuestionImage = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: "Choose an image to upload" });
        res.status(201).json({ image: await storeImage(req, req.file.buffer, req.file.mimetype) });
    } catch (error) {
        console.error("uploadQuestionImage error:", error.message);
        res.status(500).json({ message: "Upload failed. Please try again." });
    }
};

// The file id inside any kind of Google Drive link
const driveFileId = (link) => {
    const s = String(link || "").trim();
    const m = s.match(/\/d\/([A-Za-z0-9_-]{10,})/) || s.match(/[?&]id=([A-Za-z0-9_-]{10,})/) || s.match(/^([A-Za-z0-9_-]{20,})$/);
    return m ? m[1] : null;
};

// POST /api/admin/upload/drive   { link }  — copies an image from a Google Drive link
// The file must be shared as "Anyone with the link".
const uploadFromDrive = async (req, res) => {
    try {
        const id = driveFileId(req.body.link);
        if (!id) return res.status(400).json({ message: "That doesn't look like a Google Drive link" });
        const tries = [`https://drive.google.com/uc?export=download&id=${id}`, `https://drive.google.com/thumbnail?id=${id}&sz=w2000`];
        for (const url of tries) {
            let r;
            try {
                r = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(15000) });
            } catch {
                continue;
            }
            const mime = (r.headers.get("content-type") || "").split(";")[0].trim();
            if (!r.ok || !ALLOWED.includes(mime)) continue;
            const buffer = Buffer.from(await r.arrayBuffer());
            if (buffer.length > MAX_BYTES * 2) return res.status(400).json({ message: "That image is too big (max 4 MB)" });
            return res.status(201).json({ image: await storeImage(req, buffer, mime) });
        }
        res.status(400).json({ message: "Couldn't open that file. In Google Drive, set sharing to “Anyone with the link”, and make sure it is an image (JPG, PNG, WEBP or GIF)." });
    } catch (error) {
        console.error("uploadFromDrive error:", error.message);
        res.status(500).json({ message: "Couldn't copy the image from Google Drive. Please try again." });
    }
};

// GET /api/images/:id   (public, so tests and results can show it)
const serveImage = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).end();
        const blob = await ImageBlob.findById(req.params.id).lean();
        if (!blob) return res.status(404).end();
        res.setHeader("Content-Type", blob.mime);
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        res.setHeader("Cross-Origin-Resource-Policy", "cross-origin"); // the website runs on another domain
        res.end(blob.data.buffer ? Buffer.from(blob.data.buffer) : blob.data);
    } catch (error) {
        console.error("serveImage error:", error.message);
        res.status(500).end();
    }
};

module.exports = { uploadQuestionImage, uploadFromDrive, serveImage, driveFileId };
