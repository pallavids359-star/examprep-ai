// One student's live tests, grouped by exam: rank, marks, correct, wrong, skipped, time.
// Used by the student's "My results" page and by the admin's student page.
const TestAttempt = require("../models/TestAttempt");
const Test = require("../models/Test");
const Exam = require("../models/Exam");
const { computeRank } = require("./finalizeAttempt");

const FINISHED = ["submitted", "auto_submitted"];
const resultsOut = (test, now = new Date()) => test.live?.showResults === "after_submit" || now > new Date(test.availability.endsAt);

const liveResultsOf = async (userId, { hideUntilOut = false } = {}) => {
    const attempts = await TestAttempt.find({ userId, mode: "live", status: { $in: FINISHED } })
        .sort({ submittedAt: -1 })
        .select("testId examId status startedAt submittedAt result")
        .lean();
    const [tests, exams] = await Promise.all([
        Test.find({ _id: { $in: attempts.map((a) => a.testId) } }).select("title examId availability live totalMarks totalQuestions").lean(),
        Exam.find().select("code name").sort({ code: 1 }).lean(),
    ]);
    const testById = new Map(tests.map((t) => [String(t._id), t]));
    const code = new Map(exams.map((e) => [String(e._id), e.code]));

    const rows = [];
    for (const a of attempts) {
        const t = testById.get(String(a.testId));
        if (!t) continue;
        const ready = !hideUntilOut || resultsOut(t);
        const r = a.result || {};
        const rank = ready ? await computeRank(a) : null;
        rows.push({
            attemptId: a._id,
            testId: t._id,
            title: t.title,
            exam: code.get(String(t.examId)) || "",
            date: t.availability.startsAt,
            submittedAt: a.submittedAt,
            autoSubmitted: a.status === "auto_submitted",
            resultsReady: ready,
            resultsOn: t.availability.endsAt,
            questions: t.totalQuestions || 0,
            ...(ready
                ? {
                      score: r.score ?? 0,
                      maxScore: r.maxScore ?? t.totalMarks ?? 0,
                      percentage: r.percentage ?? 0,
                      correct: r.correct ?? 0,
                      wrong: r.incorrect ?? 0,
                      skipped: r.unanswered ?? 0,
                      timeTakenSec: r.timeTakenSec ?? 0,
                      rank: rank?.rank ?? null,
                      totalCandidates: rank?.totalCandidates ?? null,
                  }
                : {}),
        });
    }

    const byExam = exams.map((e) => {
        const list = rows.filter((x) => x.exam === e.code);
        const ready = list.filter((x) => x.resultsReady);
        const sum = (k) => ready.reduce((n, x) => n + (x[k] || 0), 0);
        const ranks = ready.map((x) => x.rank).filter(Boolean);
        return {
            exam: e.code,
            name: e.name,
            tests: list.length,
            correct: sum("correct"),
            wrong: sum("wrong"),
            skipped: sum("skipped"),
            timeTakenSec: sum("timeTakenSec"),
            bestRank: ranks.length ? Math.min(...ranks) : null,
        };
    });
    return { exams: byExam, tests: rows };
};

module.exports = { liveResultsOf };
