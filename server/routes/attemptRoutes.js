const express = require("express");
const protect = require("../middleware/auth");
const {
    startPractice,
    saveAnswers,
    submitAttempt,
    getAttempt,
} = require("../controllers/attemptController");
const {
    startWrongAnswerPractice,
    startBookmarkPractice,
} = require("../controllers/revisionController");

const router = express.Router();

router.use(protect);

router.post("/practice", startPractice);
router.post("/wrong-answers", startWrongAnswerPractice);
router.post("/bookmarks", startBookmarkPractice);
router.put("/:id/answers", saveAnswers); // autosave
router.post("/:id/submit", submitAttempt);
const flags = require("../controllers/questionReportController");
router.get("/:id/flags", flags.myFlags);
router.post("/:id/flags", flags.flagQuestion);
router.delete("/:id/flags/:questionId", flags.unflagQuestion);
router.get("/:id/report", require("../controllers/reportController").myReport);
router.get("/:id", getAttempt);

module.exports = router;
