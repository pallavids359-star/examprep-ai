const mongoose = require("mongoose");

// Question images kept in MongoDB, used when Cloudinary is not set up
const imageBlobSchema = new mongoose.Schema(
    {
        data: { type: Buffer, required: true },
        mime: { type: String, required: true },
        size: Number,
        uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    },
    { timestamps: true }
);

module.exports = mongoose.model("ImageBlob", imageBlobSchema);
