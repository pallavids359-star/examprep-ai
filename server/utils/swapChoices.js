// The choices from the Swap pop-up: class, chapter, concept, difficulty, question type.
// Returns a Mongo match (on top of the paper's exam + subject) or null when nothing was chosen.
const mongoose = require("mongoose");
const { FORMATS } = require("./questionFormat");

const swapMatch = async (choices = {}, { Chapter, subjectId }) => {
    const c = choices || {};
    const ok = (id) => mongoose.isValidObjectId(id);
    const m = {};
    if (ok(c.topicId)) m.topicId = new mongoose.Types.ObjectId(String(c.topicId));
    if (ok(c.chapterId)) m.chapterId = new mongoose.Types.ObjectId(String(c.chapterId));
    else if (c.classLevel === "11" || c.classLevel === "12") {
        const ids = await Chapter.find({ subjectId, classLevel: c.classLevel }).distinct("_id");
        m.chapterId = { $in: ids };
    }
    if (["easy", "medium", "hard"].includes(c.difficulty)) m.difficulty = c.difficulty;
    if (FORMATS.includes(c.format)) m.format = c.format;
    return Object.keys(m).length ? m : null;
};

module.exports = { swapMatch };
