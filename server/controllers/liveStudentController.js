// Student side of live tests: the list, starting one, and the detailed report.
const mongoose = require("mongoose");
const Test = require("../models/Test");
const User = require("../models/User");
const Exam = require("../models/Exam");
const TestAttempt = require("../models/TestAttempt");
const Question = require("../models/Question");
const Subject = require("../models/Subject");
const Chapter = require("../models/Chapter");
const Topic = require("../models/Topic");
const { buildReport, loadQuestions, questionBody } = require("../utils/attemptReport");
const { finalizeAttempt, isExpired, computeRank } = require("../utils/finalizeAttempt");
const { liveResultsOf } = require("../utils/liveResults");
const { sameCollege } = require("../utils/college");

const isValidId = (id) => mongoose.isValidObjectId(id);
const userError = (message, status = 400) => Object.assign(new Error(message), { status });
const handle = (where, fn) => async (req, res) => {
    try {
        await fn(req, res);
    } catch (error) {
        if (error.status) return res.status(error.status).json({ message: error.message });
        console.error(`${where} error:`, error);
        res.status(500).json({ message: "Something went wrong on the server" });
    }
};

const FINISHED = ["submitted", "auto_submitted"];
const isFinished = (a) => a && FINISHED.includes(a.status);

// Can this student see their result yet?
// Students see their own result as soon as they finish (every live test)
const resultsOpen = () => true;

const shuffle = (list) => {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
};

// Is this live test for this student? (no college set = every student)
const forMe = (t, user) => {
    const college = t.live?.college || "";
    if (!college) return true;
    if (!sameCollege(user.college, college)) return false;
    const secs = t.live?.sections || [];
    return !secs.length || secs.includes(user.section);
};

// GET /api/live-tests?examId=...
const listLive = handle("listLive", async (req, res) => {
    if (!isValidId(req.query.examId)) throw userError("A valid examId is required");
    const now = new Date();
    const tests = await Test.find({ examId: req.query.examId, type: "live", status: "published" })
        .sort({ "availability.startsAt": -1 })
        .limit(100)
        .select("title durationMinutes totalQuestions totalMarks markingScheme availability live.showResults live.college live.sections sections.name sections.mcqCount sections.numericalCount")
        .lean()
        .then((list) => list.filter((t) => forMe(t, req.user)));
    const attempts = await TestAttempt.find({ userId: req.user._id, testId: { $in: tests.map((t) => t._id) } })
        .select("testId status expiresAt startedAt submittedAt result.score result.maxScore result.percentage")
        .lean();
    const byTest = new Map(attempts.map((a) => [String(a.testId), a]));

    const items = [];
    for (const t of tests) {
        const a = byTest.get(String(t._id));
        const startsAt = new Date(t.availability.startsAt);
        const endsAt = new Date(t.availability.endsAt);
        let state;
        if (a && a.status === "in_progress" && !isExpired(a)) state = "in_progress";
        else if (a) state = "finished"; // an expired open attempt is closed when the report is opened
        else if (now < startsAt) state = "upcoming";
        else if (now <= endsAt) state = "open";
        else state = "missed";

        const open = state === "finished" && resultsOpen(t, now);
        let rank = null;
        if (open && a && isFinished(a)) rank = await computeRank(a);
        items.push({
            _id: t._id,
            title: t.title,
            durationMinutes: t.durationMinutes,
            totalQuestions: t.totalQuestions,
            totalMarks: t.totalMarks,
            markingScheme: t.markingScheme,
            sections: t.sections.map((s) => ({ name: s.name, questions: (s.mcqCount || 0) + (s.numericalCount || 0) })),
            startsAt,
            endsAt,
            showResults: "after_submit",
            state,
            attemptId: a?._id || null,
            resultsReady: open,
            result: open && a?.result ? { score: a.result.score, maxScore: a.result.maxScore, percentage: a.result.percentage } : null,
            rank,
        });
    }
    // Live tests of the other exams (so a student on the wrong exam can switch)
    const otherTests = await Test.find({ examId: { $ne: req.query.examId }, type: "live", status: "published", "availability.endsAt": { $gt: now } })
        .select("examId availability.startsAt live.college live.sections")
        .lean()
        .then((list) => list.filter((t) => forMe(t, req.user)));
    const otherExams = otherTests.length ? await Exam.find({ _id: { $in: otherTests.map((t) => t.examId) } }).select("code").lean() : [];
    const others = otherExams.map((e) => {
        const mine = otherTests.filter((t) => String(t.examId) === String(e._id));
        return { examId: e._id, code: e.code, open: mine.filter((t) => new Date(t.availability.startsAt) <= now).length, upcoming: mine.filter((t) => new Date(t.availability.startsAt) > now).length };
    });
    res.json({ serverNow: now, tests: items, others });
});

// POST /api/live-tests/:id/start
const startLive = handle("startLive", async (req, res) => {
    if (!isValidId(req.params.id)) throw userError("Invalid test id");
    const test = await Test.findOne({ _id: req.params.id, type: "live", status: "published" }).lean();
    if (!test || !forMe(test, req.user)) throw userError("Live test not found", 404);

    const existing = await TestAttempt.findOne({ userId: req.user._id, testId: test._id });
    if (existing) {
        if (existing.status === "in_progress" && !isExpired(existing)) return res.json({ attemptId: existing._id, resumed: true });
        if (existing.status === "in_progress") await finalizeAttempt(existing, null, true);
        throw userError("You have already taken this test", 409);
    }

    const now = new Date();
    if (now < new Date(test.availability.startsAt)) throw userError("This test has not opened yet", 403);
    if (now > new Date(test.availability.endsAt)) throw userError("This test has closed", 403);

    // Questions in section order; within a section MCQs (optionally shuffled) and then numericals
    const allIds = test.sections.flatMap((s) => s.questionIds);
    const questions = await Question.find({ _id: { $in: allIds } }).select("type subjectId chapterId topicId").lean();
    const byId = new Map(questions.map((q) => [String(q._id), q]));
    const ordered = [];
    for (const s of test.sections) {
        const qs = s.questionIds.map((id) => byId.get(String(id))).filter(Boolean);
        const mcq = qs.filter((q) => q.type !== "numerical");
        const num = qs.filter((q) => q.type === "numerical");
        ordered.push(...(test.live?.shuffle ? [...shuffle(mcq), ...shuffle(num)] : [...mcq, ...num]));
    }
    if (!ordered.length) throw userError("This test has no questions");

    // Full time from the start, but never past the closing time
    const deadline = Math.min(now.getTime() + test.durationMinutes * 60 * 1000, new Date(test.availability.endsAt).getTime());
    try {
        const attempt = await TestAttempt.create({
            userId: req.user._id,
            examId: test.examId,
            mode: "live",
            testId: test._id,
            markingScheme: { ...test.markingScheme },
            startedAt: now,
            expiresAt: new Date(deadline),
            answers: ordered.map((q) => ({ questionId: q._id, subjectId: q.subjectId, chapterId: q.chapterId, topicId: q.topicId })),
        });
        res.status(201).json({ attemptId: attempt._id, resumed: false, expiresAt: attempt.expiresAt });
    } catch (error) {
        // Two clicks at once: use the attempt that won
        const again = await TestAttempt.findOne({ userId: req.user._id, testId: test._id }).select("_id").lean();
        if (again) return res.json({ attemptId: again._id, resumed: true });
        throw error;
    }
});

// Per-question numbers across everyone who finished: average time and % right


// GET /api/live-tests/:id/report
const liveReport = handle("liveReport", async (req, res) => {
    if (!isValidId(req.params.id)) throw userError("Invalid test id");
    const test = await Test.findOne({ _id: req.params.id, type: "live", status: { $in: ["published", "archived"] } }).lean();
    if (!test) throw userError("Live test not found", 404);
    const now = new Date();
    const closed = now > new Date(test.availability.endsAt);
    const head = {
        _id: test._id,
        title: test.title,
        exam: (await Exam.findById(test.examId).select("code").lean())?.code || "",
        startsAt: test.availability.startsAt,
        endsAt: test.availability.endsAt,
        durationMinutes: test.durationMinutes,
        totalMarks: test.totalMarks,
        markingScheme: test.markingScheme,
        showResults: "after_submit",
        closed,
    };

    // Admin looking at one student's report (same page the student sees)
    const asAdmin = Boolean(req.reportUserId);
    const viewerId = req.reportUserId || req.user._id;
    let attempt = await TestAttempt.findOne({ userId: viewerId, testId: test._id });
    if (attempt && attempt.status === "in_progress") {
        if (!isExpired(attempt)) return res.json({ test: head, state: "in_progress", attemptId: attempt._id });
        await finalizeAttempt(attempt, null, true);
    }

    const sectionOf = new Map();
    test.sections.forEach((s) => s.questionIds.forEach((id) => sectionOf.set(String(id), s.name)));
    // Never started
    if (!attempt) {
        if (!closed || asAdmin) throw userError(asAdmin ? "This student has not taken this test" : "You have not taken this test yet", 404);
        const ids = test.sections.flatMap((s) => s.questionIds);
        const qs = await loadQuestions(ids);
        return res.json({
            test: head,
            state: "missed",
            paper: ids
                .map((id, i) => {
                    const q = qs.get(String(id));
                    return q ? { number: i + 1, section: sectionOf.get(String(id)) || "", ...questionBody(q) } : null;
                })
                .filter(Boolean),
        });
    }

    if (!asAdmin && !resultsOpen(test, now)) {
        return res.json({ test: head, state: "waiting", submittedAt: attempt.submittedAt, resultsAt: test.availability.endsAt });
    }

    // Full report
    const report = await buildReport(attempt, { test, head });
    res.json({ ...report, ...(asAdmin ? { student: await User.findById(viewerId).select("name email").lean() } : {}) });
});

// GET /api/live-tests/my-results   (all my live tests, by exam)
const myResults = handle("myResults", async (req, res) => {
    res.json(await liveResultsOf(req.user._id, { hideUntilOut: true }));
});

// GET /api/admin/live-tests/:id/report/:userId   (admin: a student's report, results open or not)
const studentReportForAdmin = (req, res) => {
    if (!isValidId(req.params.userId)) return res.status(400).json({ message: "Invalid student id" });
    req.reportUserId = req.params.userId;
    return liveReport(req, res);
};

module.exports = { studentReportForAdmin, listLive, startLive, liveReport, myResults, resultsOpen };
