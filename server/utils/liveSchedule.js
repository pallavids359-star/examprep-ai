// Keeps a live test's status right without anyone pressing "publish":
// a test whose every section has all its questions is published (students see it,
// it opens at its start time); if a section loses questions before the test opens,
// it goes back to draft. Also picks questions automatically.
const mongoose = require("mongoose");
const Question = require("../models/Question");
const Chapter = require("../models/Chapter");
const Test = require("../models/Test");
const TestAttempt = require("../models/TestAttempt");

const IMG = /\{\{IMG::/;
const HAS_DIAGRAM = { $or: [{ "images.0": { $exists: true } }, { "options.image.url": { $exists: true } }, { text: IMG }, { "options.text": IMG }] };

// For every section: how many MCQs and numericals it has now, and whether it is full
const sectionState = async (test) => {
    const ids = test.sections.flatMap((s) => s.questionIds);
    const qs = ids.length ? await Question.find({ _id: { $in: ids } }).select("type status marks").lean() : [];
    const byId = new Map(qs.map((q) => [String(q._id), q]));
    let totalMarks = 0;
    const sections = test.sections.map((s) => {
        const list = s.questionIds.map((id) => byId.get(String(id)));
        const live = list.filter((q) => q && q.status === "published");
        const mcq = live.filter((q) => q.type !== "numerical").length;
        const numerical = live.filter((q) => q.type === "numerical").length;
        live.forEach((q) => (totalMarks += q.marks?.correct ?? test.markingScheme?.correct ?? 4));
        return {
            key: s.key,
            mcq,
            numerical,
            missing: list.length - live.length, // deleted or unpublished since being picked
            full: mcq === (s.mcqCount || 0) && numerical === (s.numericalCount || 0) && list.length === live.length,
        };
    });
    return { sections, full: sections.every((s) => s.full), totalQuestions: ids.length, totalMarks };
};

const hasStarted = async (test, now = new Date()) =>
    now >= new Date(test.availability.startsAt) || Boolean(await TestAttempt.exists({ testId: test._id }));

// Questions can change until the test opens (and nobody has started)
const canEditQuestions = async (test) => test.status === "draft" || (test.status === "published" && !(await hasStarted(test)));

// Publishes or un-publishes to match the sections. Saves the test. Returns { status, state }.
const syncLiveStatus = async (test) => {
    if (test.status === "archived") return { status: test.status };
    const state = await sectionState(test);
    const now = new Date();
    if (test.status === "draft" && state.full && new Date(test.availability.endsAt) > now) {
        test.status = "published";
        test.live.publishedAt = now;
    } else if (test.status === "published" && !state.full && !(await hasStarted(test, now))) {
        test.status = "draft";
    }
    test.totalQuestions = state.totalQuestions;
    test.totalMarks = state.totalMarks;
    await test.save();
    return { status: test.status, state };
};

const sample = (match, size) =>
    size > 0 ? Question.aggregate([{ $match: match }, { $sample: { size } }, { $project: { _id: 1, type: 1 } }]) : Promise.resolve([]);

// Fills a section with random published questions.
//   chapterIds: only these chapters (default: every chapter of the subject, optionally one class)
//   replace: start from empty instead of keeping what is already picked
// About 2 in 9 MCQs come with a diagram where the bank has them. Questions already used in
// other live tests are avoided when possible.
const autoPick = async (test, section, { chapterIds = [], classLevel = "both", replace = false } = {}) => {
    const chapterFilter = { subjectId: section.subjectId };
    if (["11", "12"].includes(classLevel)) chapterFilter.classLevel = classLevel;
    if (chapterIds.length) chapterFilter._id = { $in: chapterIds };
    const chapters = await Chapter.find(chapterFilter).select("_id").lean();
    if (!chapters.length) throw Object.assign(new Error("No chapters to pick from"), { status: 400 });

    const keep = replace ? [] : section.questionIds.map(String);
    const kept = keep.length ? await Question.find({ _id: { $in: keep }, status: "published" }).select("type").lean() : [];
    const keptMcq = kept.filter((q) => q.type !== "numerical").length;
    const keptNum = kept.filter((q) => q.type === "numerical").length;
    let needMcq = Math.max(0, (section.mcqCount || 0) - keptMcq);
    let needNum = Math.max(0, (section.numericalCount || 0) - keptNum);

    const inThisTest = test.sections.filter((s) => s.key !== section.key).flatMap((s) => s.questionIds.map(String));
    const others = await Test.find({ type: "live", status: { $ne: "archived" }, _id: { $ne: test._id } }).select("sections.questionIds").lean();
    const usedElsewhere = others.flatMap((t) => t.sections.flatMap((s) => s.questionIds.map(String)));

    const base = { examId: test.examId, subjectId: section.subjectId, status: "published", chapterId: { $in: chapters.map((c) => c._id) } };
    const picked = [];
    const take = async (extra, size, avoidUsed) => {
        if (size <= 0) return 0;
        const exclude = [...keep, ...inThisTest, ...picked.map((q) => String(q._id)), ...(avoidUsed ? usedElsewhere : [])];
        const got = await sample({ ...base, ...extra, _id: { $nin: exclude.map((id) => new mongoose.Types.ObjectId(String(id))) } }, size);
        picked.push(...got);
        return got.length;
    };

    // Diagram MCQs first, then the rest; fresh questions first, then reused ones if the bank runs short
    const diagramTarget = Math.min(needMcq, Math.round(((section.mcqCount || 0) * 2) / 9));
    for (const avoidUsed of [true, false]) {
        const d = await take({ type: { $ne: "numerical" }, $and: [HAS_DIAGRAM] }, Math.min(diagramTarget, needMcq) - picked.filter((q) => q.diagram).length, avoidUsed);
        picked.slice(-d).forEach((q) => (q.diagram = true));
        needMcq -= d;
        needMcq -= await take({ type: { $ne: "numerical" } }, needMcq, avoidUsed);
        needNum -= await take({ type: "numerical" }, needNum, avoidUsed);
        if (needMcq <= 0 && needNum <= 0) break;
    }

    const all = [...kept.map((q) => ({ _id: q._id, type: q.type })), ...picked];
    section.questionIds = [...all.filter((q) => q.type !== "numerical"), ...all.filter((q) => q.type === "numerical")].map((q) => q._id);
    return { added: picked.length, shortMcq: Math.max(0, needMcq), shortNumerical: Math.max(0, needNum) };
};

module.exports = { sectionState, syncLiveStatus, canEditQuestions, autoPick, hasStarted };
