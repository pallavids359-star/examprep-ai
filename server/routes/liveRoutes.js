// Live tests: head lecturer (admin), lecturers and students
const express = require("express");
const protect = require("../middleware/auth");
const isAdmin = require("../middleware/isAdmin");
const isLecturer = require("../middleware/isLecturer");
const head = require("../controllers/liveAdminController");
const lecturer = require("../controllers/liveLecturerController");
const assignments = require("../controllers/assignmentController");
const student = require("../controllers/liveStudentController");

// /api/admin/... (head lecturer)
const adminRouter = express.Router();
adminRouter.use(["/lecturers", "/live-tests"], protect, isAdmin);
adminRouter.get("/lecturers", head.listLecturers);
adminRouter.post("/lecturers", head.createLecturer);
adminRouter.put("/lecturers/:id", head.updateLecturer);
adminRouter.get("/live-tests/pattern", head.getPattern);
adminRouter.get("/live-tests/:id/report/:userId", student.studentReportForAdmin);
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

// Assignments (lecturers and the head lecturer)
lecturerRouter.get("/assignments/options", assignments.options);
lecturerRouter.get("/assignments/chapters", assignments.chapters);
lecturerRouter.get("/assignments", assignments.listMine);
lecturerRouter.post("/assignments", assignments.create);
lecturerRouter.get("/assignments/:id", assignments.getOne);
lecturerRouter.put("/assignments/:id", assignments.update);
lecturerRouter.post("/assignments/:id/swap", assignments.swap);
lecturerRouter.get("/assignments/:id/browse", assignments.browse);
lecturerRouter.post("/assignments/:id/add", assignments.addQuestion);
lecturerRouter.post("/assignments/:id/publish", assignments.publish);
lecturerRouter.post("/assignments/:id/unpublish", assignments.unpublish);
lecturerRouter.delete("/assignments/:id", assignments.remove);
lecturerRouter.get("/assignments/:id/submissions", assignments.submissions);

// /api/live-tests/... (students)
const studentRouter = express.Router();
studentRouter.use(protect);
studentRouter.get("/", student.listLive);
studentRouter.get("/my-results", student.myResults);
studentRouter.post("/:id/start", student.startLive);
studentRouter.get("/:id/report", student.liveReport);

// /api/assignments/... (students)
const assignmentRouter = express.Router();
assignmentRouter.use(protect);
assignmentRouter.get("/", assignments.myAssignments);
assignmentRouter.post("/:id/start", assignments.startAssignment);

module.exports = { adminRouter, lecturerRouter, studentRouter, assignmentRouter };
