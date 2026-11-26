const AppError = require("../models/AppError");
const { logError } = require("../utils/errorLog");

// POST /api/app-errors   (the website reports a crash; login not needed)
const reportAppError = async (req, res) => {
    const b = req.body || {};
    if (!b.message) return res.status(400).json({ message: "message is required" });
    await logError({ where: "app", message: b.message, stack: b.stack, page: b.page, device: req.headers["user-agent"], role: b.role });
    res.status(204).end();
};

// GET /api/admin/app-errors
const listAppErrors = async (req, res) => {
    try {
        const errors = await AppError.find().sort({ lastAt: -1 }).limit(200).lean();
        res.json({ errors });
    } catch (error) {
        console.error("listAppErrors error:", error.message);
        res.status(500).json({ message: "Something went wrong on the server" });
    }
};

// DELETE /api/admin/app-errors   (clear the list after fixing)
const clearAppErrors = async (req, res) => {
    try {
        await AppError.deleteMany({});
        res.json({ message: "Cleared" });
    } catch (error) {
        res.status(500).json({ message: "Something went wrong on the server" });
    }
};

module.exports = { reportAppError, listAppErrors, clearAppErrors };
