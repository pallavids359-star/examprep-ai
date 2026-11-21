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
const { finalizeAttempt, isExpired, computeRank } = require("../utils/finalizeAttempt");
const { liveResultsOf } = require("../utils/liveResults");

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
const resultsOpen = (test, now = new Date()) => test.live?.showResults === "after_submit" || now > new Date(test.availability.endsAt);

const shuffle = (list) => {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
};

// GET /api/live-tests?examId=...
const listLive = handle("listLive", async (req, res) => {
    if (!isValidId(req.query.examId)) throw userError("A valid examId is required");
    const now = new Date();
    const tests = await Test.find({ examId: req.query.examId, type: "live", status: "published" })
        .sort({ "availability.startsAt": -1 })
        .limit(100)
        .select("title durationMinutes totalQuestions totalMarks markingScheme availability live.showResults sections.name sections.mcqCount sections.numericalCount")
        .lean();
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
            showResults: t.live?.showResults || "after_close",
            state,
            attemptId: a?._id || null,
            resultsReady: open,
            result: open && a?.result ? { score: a.result.score, maxScore: a.result.maxScore, percentage: a.result.percentage } : null,
            rank,
        });
    }
    // Live tests of the other exams (so a student on the wrong exam can switch)
    const otherTests = await Test.find({ examId: { $ne: req.query.examId }, type: "live", status: "published", "availability.endsAt": { $gt: now } })
        .select("examId availability.startsAt")
        .lean();
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
    if (!test) throw userError("Live test not found", 404);

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
const batchStats = async (testId) => {
    const rows = await TestAttempt.aggregate([
        { $match: { testId, status: { $in: FINISHED } } },
        { $unwind: "$answers" },
        {
            $group: {
                _id: "$answers.questionId",
                takers: { $sum: 1 },
                avgTime: { $avg: "$answers.timeSpentSec" },
                answered: { $sum: { $cond: [{ $ne: ["$answers.isCorrect", null] }, 1, 0] } },
                correct: { $sum: { $cond: [{ $eq: ["$answers.isCorrect", true] }, 1, 0] } },
            },
        },
    ]);
    return new Map(rows.map((r) => [String(r._id), r]));
};

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
        showResults: test.live?.showResults || "after_close",
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
    const loadQuestions = async (ids) => {
        const qs = await Question.find({ _id: { $in: ids } })
            .select("type text images options explanation chapterId topicId subjectId +correctOptionIds +numericalAnswer")
            .lean();
        const [chapters, topics] = await Promise.all([
            Chapter.find({ _id: { $in: qs.map((q) => q.chapterId) } }).select("name").lean(),
            Topic.find({ _id: { $in: qs.map((q) => q.topicId) } }).select("name").lean(),
        ]);
        const cName = new Map(chapters.map((c) => [String(c._id), c.name]));
        const tName = new Map(topics.map((t) => [String(t._id), t.name]));
        return new Map(qs.map((q) => [String(q._id), { ...q, chapter: cName.get(String(q.chapterId)) || "", topic: tName.get(String(q.topicId)) || "" }]));
    };
    const questionBody = (q) => ({
        type: q.type,
        text: q.text,
        images: q.images || [],
        options: q.options || [],
        chapter: q.chapter,
        topic: q.topic,
        correctOptionIds: q.correctOptionIds || [],
        correctNumericalValue: q.type === "numerical" ? q.numericalAnswer?.value ?? null : null,
        explanation: q.explanation || null,
    });

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
    const [qs, stats, rank, subjects] = await Promise.all([
        loadQuestions(attempt.answers.map((a) => a.questionId)),
        batchStats(test._id),
        computeRank(attempt),
        Subject.find({ _id: { $in: test.sections.map((s) => s.subjectId) } }).select("name").lean(),
    ]);
    const subjectName = new Map(subjects.map((s) => [String(s._id), s.name]));

    const questions = attempt.answers.map((a, i) => {
        const q = qs.get(String(a.questionId));
        const st = stats.get(String(a.questionId));
        const answered = a.isCorrect !== null && a.isCorrect !== undefined;
        const visited = a.visited || a.timeSpentSec > 0 || answered;
        const status = a.isCorrect === true ? "correct" : a.isCorrect === false ? "wrong" : visited ? "skipped" : "not_visited";
        return {
            number: i + 1,
            questionId: a.questionId,
            section: sectionOf.get(String(a.questionId)) || subjectName.get(String(a.subjectId)) || "",
            status,
            markedForReview: a.markedForReview,
            selectedOptionIds: a.selectedOptionIds,
            numericalValue: a.numericalValue ?? null,
            marksAwarded: a.marksAwarded,
            timeSpentSec: a.timeSpentSec || 0,
            batch: st ? { avgTimeSec: Math.round(st.avgTime || 0), correctPct: st.takers ? Math.round((st.correct / st.takers) * 1000) / 10 : null, takers: st.takers } : null,
            ...(q ? questionBody(q) : { text: "(this question was removed)", options: [], images: [] }),
        };
    });

    // Per section: marks, counts, time and weakest chapter
    const sections = test.sections.map((s) => {
        const list = questions.filter((q) => q.section === s.name);
        const byChapter = new Map();
        list.forEach((q) => {
            if (!q.chapter) return;
            const c = byChapter.get(q.chapter) || { name: q.chapter, correct: 0, total: 0 };
            c.total += 1;
            if (q.status === "correct") c.correct += 1;
            byChapter.set(q.chapter, c);
        });
        const weakest = [...byChapter.values()].filter((c) => c.total >= 2).sort((a, b) => a.correct / a.total - b.correct / b.total)[0] || null;
        const maxScore = list.length * (test.markingScheme.correct ?? 4);
        return {
            name: s.name,
            questions: list.length,
            score: list.reduce((a, q) => a + (q.marksAwarded || 0), 0),
            maxScore,
            correct: list.filter((q) => q.status === "correct").length,
            wrong: list.filter((q) => q.status === "wrong").length,
            skipped: list.filter((q) => q.status === "skipped").length,
            notVisited: list.filter((q) => q.status === "not_visited").length,
            timeSec: list.reduce((a, q) => a + q.timeSpentSec, 0),
            weakestChapter: weakest,
        };
    });

    const r = attempt.result || {};
    res.json({
        test: head,
        state: "ready",
        ...(asAdmin ? { student: await User.findById(viewerId).select("name email").lean() } : {}),
        attemptId: attempt._id,
        startedAt: attempt.startedAt,
        submittedAt: attempt.submittedAt,
        autoSubmitted: attempt.status === "auto_submitted",
        summary: {
            score: r.score,
            maxScore: r.maxScore,
            percentage: r.percentage,
            accuracy: r.accuracy,
            correct: questions.filter((q) => q.status === "correct").length,
            wrong: questions.filter((q) => q.status === "wrong").length,
            skipped: questions.filter((q) => q.status === "skipped").length,
            notVisited: questions.filter((q) => q.status === "not_visited").length,
            marked: questions.filter((q) => q.markedForReview).length,
            markedAnswered: questions.filter((q) => q.markedForReview && (q.status === "correct" || q.status === "wrong")).length,
            timeTakenSec: r.timeTakenSec || 0,
            negativeMarks: questions.filter((q) => q.status === "wrong").reduce((a, q) => a + (q.marksAwarded || 0), 0),
        },
        rank,
        sections,
        questions,
    });
});

// GET /api/live-tests/:id/leaderboard   (every student's rank, once results are out)
const liveLeaderboard = handle("liveLeaderboard", async (req, res) => {
    if (!isValidId(req.params.id)) throw userError("Invalid test id");
    const test = await Test.findOne({ _id: req.params.id, type: "live", status: { $in: ["published", "archived"] } }).select("title examId totalMarks availability live").lean();
    if (!test) throw userError("Live test not found", 404);
    if (!resultsOpen(test)) throw userError("The leaderboard opens when the test closes");
    const exam = await Exam.findById(test.examId).select("code").lean();
    const attempts = await TestAttempt.find({ testId: test._id, status: { $in: ["submitted", "auto_submitted"] } })
        .select("userId result.score result.maxScore result.timeTakenSec")
        .populate("userId", "name")
        .lean();
    attempts.sort((a, b) => (b.result?.score ?? 0) - (a.result?.score ?? 0) || (a.result?.timeTakenSec ?? 0) - (b.result?.timeTakenSec ?? 0));
    res.json({
        test: { _id: test._id, title: test.title, exam: exam?.code || "", totalMarks: test.totalMarks },
        rows: attempts.map((a, i) => ({
            attemptId: String(i), // students never open other students' answers
            rank: i + 1,
            me: String(a.userId?._id) === String(req.user._id),
            student: { name: a.userId?.name || "Student" },
            score: a.result?.score ?? 0,
            maxScore: a.result?.maxScore ?? test.totalMarks,
            timeTakenSec: a.result?.timeTakenSec ?? 0,
        })),
    });
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

module.exports = { studentReportForAdmin, listLive, startLive, liveReport, liveLeaderboard, myResults, resultsOpen };
