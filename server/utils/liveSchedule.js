// Keeps a live test's status right without anyone pressing "publish":
// a test whose every section has all its questions is published (students see it,
// it opens at its start time); if a section loses questions before the test opens,
// it goes back to draft. Also picks questions automatically.
const mongoose = require("mongoose");
const Question = require("../models/Question");
const Chapter = require("../models/Chapter");
const Test = require("../models/Test");
const { sampleMixed } = require("./difficultyMix");
const TestAttempt = require("../models/TestAttempt");

const IMG = /\{\{IMG::/;
const HAS_DIAGRAM = { $or: [{ "images.0": { $exists: true } }, { "options.image.url": { $exists: true } }, { text: IMG }, { "options.text": IMG }] };

// Sections picked by a lecturer must also be sent to the head lecturer before the test can go live
const needsSending = (s) => s.picker === "lecturer";

// For every section: how many MCQs and numericals it has now, whether it is full, and whether it is ready
// (full, and sent to the head lecturer when a lecturer picks it)
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
            sent: !needsSending(s) || Boolean(s.submittedAt),
        };
    });
    sections.forEach((x) => (x.ready = x.full && x.sent));
    return { sections, full: sections.every((s) => s.full), ready: sections.every((s) => s.ready), totalQuestions: ids.length, totalMarks };
};

// "Started" = a student has begun writing it. Until then the head lecturer can change the
// date, time and questions as often as needed, even after the window has opened.
// eslint-disable-next-line no-unused-vars
const hasStarted = async (test, now = new Date()) => Boolean(await TestAttempt.exists({ testId: test._id }));

// Questions, date and time can change until a student starts the test
const canEditQuestions = async (test) => test.status === "draft" || (test.status === "published" && !(await hasStarted(test)));

// Publishes once every section is ready; goes back to draft if a section is no longer full
// (or, with { pullBack: true }, no longer ready) before the test opens. Saves. Returns { status, state }.
const syncLiveStatus = async (test, { pullBack = false } = {}) => {
    if (test.status === "archived") return { status: test.status };
    const state = await sectionState(test);
    const now = new Date();
    if (test.status === "draft" && state.ready && new Date(test.availability.endsAt) > now) {
        test.status = "published";
        test.live.publishedAt = now;
    } else if (test.status === "published" && !(pullBack ? state.ready : state.full) && !(await hasStarted(test, now))) {
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
const autoPick = async (test, section, { chapterIds = [], classLevel, replace = false, useSettings = false } = {}) => {
    // The head lecturer's auto-pick choices (class, difficulty %, types, per-chapter counts)
    const auto = useSettings ? test.live?.auto || {} : {};
    if (!classLevel) classLevel = auto.classLevel || "both";
    const mix = auto.mix && (auto.mix.easy || auto.mix.medium || auto.mix.hard) ? { easy: auto.mix.easy || 0, medium: auto.mix.medium || 0, hard: auto.mix.hard || 0 } : null;
    const formats = (auto.formats || []).filter(Boolean);
    const mcqFormats = formats.filter((f) => f !== "numerical");
    const perChapter = (auto.perChapter || []).filter((p) => p.sectionKey === section.key && p.count > 0);
    if (perChapter.length && !chapterIds.length) chapterIds = perChapter.map((p) => p.chapterId);
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
    const take = async (extra, size, avoidUsed, alsoExclude = []) => {
        if (size <= 0) return 0;
        const exclude = [...new Set([...keep, ...inThisTest, ...picked.map((q) => String(q._id)), ...(avoidUsed ? usedElsewhere : []), ...alsoExclude.map(String)])];
        const where = Object.fromEntries(Object.entries(extra).filter(([, v]) => v !== undefined));
        const got = await sample({ ...base, ...where, _id: { $nin: exclude.map((id) => new mongoose.Types.ObjectId(String(id))) } }, size);
        picked.push(...got);
        return got.length;
    };

    const mcqWhere = { type: { $ne: "numerical" }, ...(mcqFormats.length ? { format: { $in: mcqFormats } } : {}) };
    // sampleMixed asks for (match, size) and wants the picked questions back
    const sampleFor = (avoidUsed) => async (m, n) => {
        const { _id, ...rest } = m;
        const before = picked.length;
        await take(rest, n, avoidUsed, _id?.$nin || []);
        return picked.slice(before);
    };
    // Chosen counts per chapter, or a difficulty mix: follow them first (fresh questions, then reused)
    if ((perChapter.length || mix) && needMcq > 0) {
        const groups = perChapter.length ? perChapter.map((p) => ({ where: { chapterId: p.chapterId }, count: p.count })) : [{ where: {}, count: needMcq }];
        for (const g of groups) {
            let want = Math.min(g.count, needMcq);
            for (const avoidUsed of [true, false]) {
                if (want <= 0) break;
                const where = { ...mcqWhere, ...g.where };
                const got = mix ? (await sampleMixed(where, want, mix, sampleFor(avoidUsed))).length : await take(where, want, avoidUsed);
                want -= got;
                needMcq -= got;
            }
        }
    }

    // Diagram MCQs first, then the rest; fresh questions first, then reused ones if the bank runs short
    const diagramTarget = Math.min(needMcq, Math.round(((section.mcqCount || 0) * 2) / 9));
    for (const avoidUsed of [true, false]) {
        const d = await take({ type: { $ne: "numerical" }, $and: [HAS_DIAGRAM] }, Math.min(diagramTarget, needMcq) - picked.filter((q) => q.diagram).length, avoidUsed);
        picked.slice(-d).forEach((q) => (q.diagram = true));
        needMcq -= d;
        needMcq -= await take(mcqWhere, needMcq, avoidUsed);
        needNum -= await take({ type: "numerical" }, needNum, avoidUsed);
        if (needMcq <= 0 && needNum <= 0) break;
    }

    const all = [...kept.map((q) => ({ _id: q._id, type: q.type })), ...picked];
    section.questionIds = [...all.filter((q) => q.type !== "numerical"), ...all.filter((q) => q.type === "numerical")].map((q) => q._id);
    return { added: picked.length, shortMcq: Math.max(0, needMcq), shortNumerical: Math.max(0, needNum) };
};

// Finds one replacement for a picked question: same kind (MCQ / numerical), as close as
// possible (same concept, then same chapter, then anywhere in the subject), preferring the
// same difficulty and questions not used in other live tests.
const findSwap = async (test, section, old) => {
    const isNum = old.type === "numerical";
    const inThisTest = test.sections.flatMap((s) => s.questionIds.map(String));
    const others = await Test.find({ type: "live", status: { $ne: "archived" }, _id: { $ne: test._id } }).select("sections.questionIds").lean();
    const usedElsewhere = others.flatMap((t) => t.sections.flatMap((s) => s.questionIds.map(String)));
    const oid = (ids) => ids.map((id) => new mongoose.Types.ObjectId(String(id)));
    const base = { examId: test.examId, subjectId: section.subjectId, status: "published", type: isNum ? "numerical" : { $ne: "numerical" } };
    const places = [old.topicId && { topicId: old.topicId }, old.chapterId && { chapterId: old.chapterId }, {}].filter(Boolean);
    const levels = old.difficulty ? [{ difficulty: old.difficulty }, {}] : [{}];
    for (const avoidUsed of [true, false]) {
        const exclude = oid([...inThisTest, String(old._id), ...(avoidUsed ? usedElsewhere : [])]);
        for (const place of places) {
            for (const level of levels) {
                const [got] = await sample({ ...base, ...place, ...level, _id: { $nin: exclude } }, 1);
                if (got) return got;
            }
        }
    }
    return null;
};

module.exports = { needsSending, sectionState, syncLiveStatus, canEditQuestions, autoPick, hasStarted, findSwap };
