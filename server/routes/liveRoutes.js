// Live tests: head lecturer (admin), lecturers and students
const express = require("express");
const protect = require("../middleware/auth");
const isAdmin = require("../middleware/isAdmin");
const isLecturer = require("../middleware/isLecturer");
const head = require("../controllers/liveAdminController");
const lecturer = require("../controllers/liveLecturerController");
const student = require("../controllers/liveStudentController");

// /api/admin/... (head lecturer)
const adminRouter = express.Router();
adminRouter.use(["/lecturers", "/live-tests"], protect, isAdmin);
adminRouter.get("/lecturers", head.listLecturers);
adminRouter.post("/lecturers", head.createLecturer);
adminRouter.put("/lecturers/:id", head.updateLecturer);
adminRouter.get("/live-tests/pattern", head.getPattern);
adminRouter.get("/live-tests", head.listLiveTests);
adminRouter.post("/live-tests", head.createLiveTest);
adminRouter.get("/live-tests/:id", head.getLiveTest);
adminRouter.put("/live-tests/:id", head.updateLiveTest);
adminRouter.delete("/live-tests/:id", head.deleteLiveTest);
adminRouter.post("/live-tests/:id/publish", head.publishLiveTest);
adminRouter.post("/live-tests/:id/unpublish", head.unpublishLiveTest);
adminRouter.post("/live-tests/:id/sections/:key/reopen", head.reopenSection);
adminRouter.post("/live-tests/:id/sections/:key/accept", head.acceptSection);
adminRouter.put("/live-tests/:id/sections/:key/lecturer", head.changeSectionLecturer);
adminRouter.get("/live-tests/:id/results", head.liveResults);

// /api/lecturer/...
const lecturerRouter = express.Router();
lecturerRouter.use(protect, isLecturer);
lecturerRouter.get("/sections", lecturer.mySections);
lecturerRouter.get("/live-tests/:id/sections/:key", lecturer.getSection);
lecturerRouter.get("/live-tests/:id/sections/:key/questions", lecturer.browseQuestions);
lecturerRouter.put("/live-tests/:id/sections/:key", lecturer.savePicks);
lecturerRouter.post("/live-tests/:id/sections/:key/submit", lecturer.submitSection);
lecturerRouter.post("/live-tests/:id/sections/:key/autopick", lecturer.autoPickSection);
lecturerRouter.post("/live-tests/:id/sections/:key/swap", lecturer.swapQuestion);
lecturerRouter.post("/live-tests/:id/sections/:key/unsubmit", lecturer.unsubmitSection);

// /api/live-tests/... (students)
const studentRouter = express.Router();
studentRouter.use(protect);
studentRouter.get("/", student.listLive);
studentRouter.post("/:id/start", student.startLive);
studentRouter.get("/:id/report", student.liveReport);

module.exports = { adminRouter, lecturerRouter, studentRouter };
