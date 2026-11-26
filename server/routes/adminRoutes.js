const express = require("express");
const protect = require("../middleware/auth");
const isAdmin = require("../middleware/isAdmin");
const {
    createQuestion,
    listQuestions,
    getQuestion,
    updateQuestion,
    deleteQuestion,
} = require("../controllers/questionController");
const { createTest, listTestsAdmin, deleteTest } = require("../controllers/testController");
const admin = require("../controllers/adminController");
const attempts = require("../controllers/adminAttemptController");
const uploadImage = require("../middleware/upload");
const { uploadQuestionImage, uploadFromDrive } = require("../controllers/uploadController");
const { bulkImport, bulkSyllabus } = require("../controllers/bulkQuestionController");

const router = express.Router();

// Every route in this file needs: logged in AND admin
router.use(protect, isAdmin);

router.get("/overview", admin.getOverview);
router.post("/upload", uploadImage, uploadQuestionImage);
router.post("/upload/drive", uploadFromDrive);

// Questions
router.post("/questions", createQuestion);
router.post("/questions/bulk", bulkImport);
router.get("/questions/bulk/syllabus", bulkSyllabus);
router.get("/questions", listQuestions);
router.post("/questions/status", require("../controllers/questionController").setQuestionsStatus);
router.get("/questions/:id", getQuestion);
router.put("/questions/:id", updateQuestion);
router.delete("/questions/:id", deleteQuestion);

// Syllabus
router.post("/chapters", admin.createChapter);
router.put("/chapters/:id", admin.updateChapter);
router.delete("/chapters/:id", admin.deleteChapter);
router.post("/topics", admin.createTopic);
router.delete("/topics/:id", admin.deleteTopic);

// Mock tests
router.post("/tests", createTest);
router.get("/tests", listTestsAdmin);
router.delete("/tests/:id", deleteTest);

// Students
router.get("/students", admin.listStudents);
router.get("/students/:id", admin.getStudent);
router.get("/students/:id/history", admin.getStudentHistory);
router.get("/students/:id/attempts", attempts.listStudentAttempts);
router.get("/students/:id/live-results", attempts.studentLiveResults);
router.get("/attempts/:id/report", require("../controllers/reportController").adminReport);
router.get("/attempts/:id", attempts.getAttemptDetail);
router.put("/students/:id/status", admin.setStudentStatus);

const { questionBreakdown } = require("../controllers/questionStatsController");
router.get("/stats/questions", questionBreakdown);

const { syllabusFilters } = require("../controllers/questionStatsController");
router.get("/syllabus-filters", syllabusFilters);

// Supabase question databases
const { runSync, syncStatus } = require("../controllers/syncController");
router.get("/sync/status", syncStatus);
router.post("/sync/supabase", runSync);

// Errors from the app and the server
const appErrors = require("../controllers/appErrorController");
router.get("/app-errors", appErrors.listAppErrors);
router.delete("/app-errors", appErrors.clearAppErrors);

// Questions students reported as wrong
const qReports = require("../controllers/questionReportController");
router.get("/question-reports/count", qReports.openCount);
router.get("/question-reports", qReports.listReports);
router.post("/question-reports/:questionId/accept", qReports.acceptReport);
router.post("/question-reports/:questionId/reject", qReports.rejectReport);

module.exports = router;