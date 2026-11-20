// Lecturer side of live tests: see assigned sections, browse questions, pick them.
// Admins (head lecturers) may use every route here for any section.
const mongoose = require("mongoose");
const Test = require("../models/Test");
const Exam = require("../models/Exam");
const Subject = require("../models/Subject");
const Chapter = require("../models/Chapter");
const Topic = require("../models/Topic");
const Question = require("../models/Question");
const { phase } = require("./liveAdminController");

const isValidId = (id) => mongoose.isValidObjectId(id);
const toId = (id) => new mongoose.Types.ObjectId(String(id));
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

const PAGE_SIZE = 20;
const IMG = /\{\{IMG::/;
const HAS_DIAGRAM = { $or: [{ "images.0": { $exists: true } }, { "options.image.url": { $exists: true } }, { text: IMG }, { "options.text": IMG }] };
const asList = (v) => (Array.isArray(v) ? v : typeof v === "string" && v ? v.split(",") : []);

// The section, checked against who is asking
const loadSection = async (req) => {
    if (!isValidId(req.params.id)) throw userError("Invalid test id");
    const test = await Test.findOne({ _id: req.params.id, type: "live", status: { $ne: "archived" } });
    if (!test) throw userError("Live test not found", 404);
    const section = test.sections.find((s) => s.key === req.params.key);
    if (!section) throw userError("Section not found", 404);
    const isAdmin = req.user.role === "admin";
    if (!isAdmin && String(section.lecturerId) !== String(req.user._id)) throw userError("This section is assigned to another lecturer", 403);
    // Lecturers change picks only while the test is a draft and before handing in; admins until publishing
    const editable = test.status === "draft" && (isAdmin || !section.submittedAt);
    return { test, section, isAdmin, editable };
};

const counts = (questions) => ({
    mcq: questions.filter((q) => q.type !== "numerical").length,
    numerical: questions.filter((q) => q.type === "numerical").length,
});

// Full question for a lecturer: answer and solution included
const FULL_FIELDS = "type text images options difficulty source tags explanation chapterId topicId subjectId +correctOptionIds +numericalAnswer";
const shape = (q, chaptersById, topicsById) => ({
    _id: q._id,
    type: q.type,
    text: q.text,
    images: q.images || [],
    options: q.options || [],
    correctOptionIds: q.correctOptionIds || [],
    numericalAnswer: q.type === "numerical" ? q.numericalAnswer || null : null,
    explanation: q.explanation || null,
    difficulty: q.difficulty,
    source: q.source || null,
    chapterId: q.chapterId,
    chapter: chaptersById.get(String(q.chapterId))?.name || "",
    classLevel: chaptersById.get(String(q.chapterId))?.classLevel || "",
    topicId: q.topicId,
    topic: topicsById.get(String(q.topicId))?.name || "",
    diagram: IMG.test(q.text || "") || (q.images || []).length > 0 || (q.options || []).some((o) => IMG.test(o.text || "") || o.image?.url),
});

const namesFor = async (questions) => {
    const chapterIds = [...new Set(questions.map((q) => String(q.chapterId)))];
    const topicIds = [...new Set(questions.map((q) => String(q.topicId)))];
    const [chapters, topics] = await Promise.all([
        Chapter.find({ _id: { $in: chapterIds } }).select("name classLevel order").lean(),
        Topic.find({ _id: { $in: topicIds } }).select("name order").lean(),
    ]);
    return [new Map(chapters.map((c) => [String(c._id), c])), new Map(topics.map((t) => [String(t._id), t]))];
};

// GET /api/lecturer/sections   (my sections in live tests)
const mySections = handle("mySections", async (req, res) => {
    const filter = { type: "live", status: { $ne: "archived" } };
    if (req.user.role !== "admin") filter["sections.lecturerId"] = req.user._id;
    const tests = await Test.find(filter).sort({ "availability.startsAt": -1 }).limit(100).lean();
    const exams = await Exam.find({ _id: { $in: tests.map((t) => t.examId) } }).select("code").lean();
    const examCode = new Map(exams.map((e) => [String(e._id), e.code]));
    const allIds = tests.flatMap((t) => t.sections.flatMap((s) => s.questionIds));
    const types = await Question.find({ _id: { $in: allIds } }).select("type").lean();
    const typeById = new Map(types.map((q) => [String(q._id), q.type]));

    const items = [];
    for (const t of tests) {
        for (const s of t.sections) {
            if (req.user.role !== "admin" && String(s.lecturerId) !== String(req.user._id)) continue;
            const picked = s.questionIds.map((id) => ({ type: typeById.get(String(id)) }));
            const c = counts(picked);
            items.push({
                testId: t._id,
                title: t.title,
                exam: examCode.get(String(t.examId)) || "",
                status: t.status,
                phase: phase(t),
                startsAt: t.availability.startsAt,
                endsAt: t.availability.endsAt,
                section: {
                    key: s.key,
                    name: s.name,
                    mcqCount: s.mcqCount || 0,
                    numericalCount: s.numericalCount || 0,
                    mcqPicked: c.mcq,
                    numericalPicked: c.numerical,
                    dueAt: s.dueAt || null,
                    submittedAt: s.submittedAt || null,
                },
            });
        }
    }
    res.json({ sections: items });
});

// GET /api/lecturer/live-tests/:id/sections/:key   (section, its syllabus and the picked questions)
const getSection = handle("getSection", async (req, res) => {
    const { test, section, editable } = await loadSection(req);
    const [exam, subject, chapters] = await Promise.all([
        Exam.findById(test.examId).select("code name").lean(),
        Subject.findById(section.subjectId).select("name").lean(),
        Chapter.find({ subjectId: section.subjectId }).sort({ classLevel: 1, order: 1, name: 1 }).select("name classLevel order").lean(),
    ]);
    const picked = await Question.find({ _id: { $in: section.questionIds } }).select(FULL_FIELDS).lean();
    const [chaptersById, topicsById] = await namesFor(picked);
    const byId = new Map(picked.map((q) => [String(q._id), q]));
    const questions = section.questionIds.map((id) => byId.get(String(id))).filter(Boolean).map((q) => shape(q, chaptersById, topicsById));

    res.json({
        test: { _id: test._id, title: test.title, status: test.status, phase: phase(test), startsAt: test.availability.startsAt, endsAt: test.availability.endsAt },
        exam,
        subject,
        section: {
            key: section.key,
            name: section.name,
            mcqCount: section.mcqCount || 0,
            numericalCount: section.numericalCount || 0,
            dueAt: section.dueAt || null,
            submittedAt: section.submittedAt || null,
        },
        editable,
        chapters,
        questions,
    });
});

// GET /api/lecturer/live-tests/:id/sections/:key/questions
//   ?classLevel=11|12|both &chapterIds=a,b &topicIds=c,d &type=all|mcq|numerical
//   &difficulty=any|easy|medium|hard &diagram=1 &hideUsed=1 &page=1
const browseQuestions = handle("browseQuestions", async (req, res) => {
    const { test, section } = await loadSection(req);

    const chapterFilter = { subjectId: section.subjectId };
    if (["11", "12"].includes(req.query.classLevel)) chapterFilter.classLevel = req.query.classLevel;
    const chosenChapters = asList(req.query.chapterIds).filter(isValidId);
    if (chosenChapters.length) chapterFilter._id = { $in: chosenChapters.map(toId) };
    const chapters = await Chapter.find(chapterFilter).select("_id").lean();
    if (!chapters.length) return res.json({ total: 0, page: 1, pages: 0, topics: [], questions: [] });

    const match = {
        examId: test.examId,
        subjectId: section.subjectId,
        status: "published",
        chapterId: { $in: chapters.map((c) => c._id) },
    };
    const chosenTopics = asList(req.query.topicIds).filter(isValidId);
    if (chosenTopics.length) match.topicId = { $in: chosenTopics.map(toId) };
    if (req.query.type === "mcq") match.type = { $ne: "numerical" };
    if (req.query.type === "numerical") match.type = "numerical";
    if (["easy", "medium", "hard"].includes(req.query.difficulty)) match.difficulty = req.query.difficulty;
    const and = [];
    if (req.query.diagram === "1") and.push(HAS_DIAGRAM);
    if (req.query.hideUsed === "1") {
        const others = await Test.find({ type: "live", status: { $ne: "archived" }, _id: { $ne: test._id } }).select("sections.questionIds").lean();
        const used = others.flatMap((t) => t.sections.flatMap((s) => s.questionIds));
        if (used.length) match._id = { $nin: used };
    }
    if (and.length) match.$and = and;

    // How many questions each concept has (for the group headers), then one page in concept order
    const perTopic = await Question.aggregate([{ $match: match }, { $group: { _id: "$topicId", count: { $sum: 1 } } }]);
    const topicDocs = await Topic.find({ _id: { $in: perTopic.map((t) => t._id) } }).select("name order chapterId").lean();
    const chapterDocs = await Chapter.find({ _id: { $in: topicDocs.map((t) => t.chapterId) } }).select("name classLevel order").lean();
    const chapterById = new Map(chapterDocs.map((c) => [String(c._id), c]));
    const topicsSorted = topicDocs
        .map((t) => ({ ...t, chapter: chapterById.get(String(t.chapterId)) }))
        .sort(
            (a, b) =>
                String(a.chapter?.classLevel).localeCompare(String(b.chapter?.classLevel)) ||
                (a.chapter?.order ?? 0) - (b.chapter?.order ?? 0) ||
                String(a.chapter?.name).localeCompare(String(b.chapter?.name)) ||
                (a.order ?? 0) - (b.order ?? 0) ||
                a.name.localeCompare(b.name)
        );
    const countByTopic = new Map(perTopic.map((t) => [String(t._id), t.count]));
    const total = perTopic.reduce((a, t) => a + t.count, 0);
    const pages = Math.ceil(total / PAGE_SIZE);
    const page = Math.min(Math.max(1, Number(req.query.page) || 1), Math.max(1, pages));

    // Walk the concepts in order to find which questions fall on this page
    let skip = (page - 1) * PAGE_SIZE;
    let need = PAGE_SIZE;
    const ids = [];
    for (const t of topicsSorted) {
        if (need <= 0) break;
        const n = countByTopic.get(String(t._id)) || 0;
        if (skip >= n) {
            skip -= n;
            continue;
        }
        const take = Math.min(n - skip, need);
        const docs = await Question.find({ ...match, topicId: t._id }).sort({ difficulty: 1, _id: 1 }).skip(skip).limit(take).select("_id").lean();
        ids.push(...docs.map((d) => d._id));
        need -= take;
        skip = 0;
    }
    const docs = await Question.find({ _id: { $in: ids } }).select(FULL_FIELDS).lean();
    const byId = new Map(docs.map((q) => [String(q._id), q]));
    const [chaptersById, topicsById] = await namesFor(docs);

    res.json({
        total,
        page,
        pages,
        topics: topicsSorted.map((t) => ({ _id: t._id, name: t.name, chapter: t.chapter?.name || "", count: countByTopic.get(String(t._id)) || 0 })),
        questions: ids.map((id) => byId.get(String(id))).filter(Boolean).map((q) => shape(q, chaptersById, topicsById)),
    });
});

// PUT /api/lecturer/live-tests/:id/sections/:key   { questionIds: [...] }  (saves the picks)
const savePicks = handle("savePicks", async (req, res) => {
    const { test, section, editable } = await loadSection(req);
    if (!editable) throw userError(test.status !== "draft" ? "The test is already published" : "You handed this section in. Ask the head lecturer to re-open it.");

    const ids = [...new Set((Array.isArray(req.body.questionIds) ? req.body.questionIds : []).map(String))];
    if (ids.some((id) => !isValidId(id))) throw userError("Invalid question id");
    const max = (section.mcqCount || 0) + (section.numericalCount || 0);
    if (ids.length > max) throw userError(`This section takes ${max} questions`);

    const questions = await Question.find({ _id: { $in: ids } }).select("type status examId subjectId").lean();
    const byId = new Map(questions.map((q) => [String(q._id), q]));
    for (const id of ids) {
        const q = byId.get(id);
        if (!q) throw userError("A question you picked no longer exists. Refresh and try again.");
        if (q.status !== "published") throw userError("Only published questions can go in a live test");
        if (String(q.examId) !== String(test.examId) || String(q.subjectId) !== String(section.subjectId)) throw userError(`A question you picked is not a ${section.name} question of this exam`);
    }
    const inOther = new Set(test.sections.filter((s) => s.key !== section.key).flatMap((s) => s.questionIds.map(String)));
    if (ids.some((id) => inOther.has(id))) throw userError("One of these questions is already in another section of this test");

    const c = counts(ids.map((id) => byId.get(id)));
    if (c.mcq > (section.mcqCount || 0)) throw userError(`Too many MCQs: this section takes ${section.mcqCount}`);
    if (c.numerical > (section.numericalCount || 0)) throw userError(`Too many numerical questions: this section takes ${section.numericalCount}`);

    // MCQs first, numericals at the end, otherwise in the order given
    section.questionIds = [...ids.filter((id) => byId.get(id).type !== "numerical"), ...ids.filter((id) => byId.get(id).type === "numerical")].map(toId);
    await test.save();
    res.json({ message: "Saved", mcqPicked: c.mcq, numericalPicked: c.numerical, questionIds: section.questionIds });
});

// POST /api/lecturer/live-tests/:id/sections/:key/submit   (hand the section in)
const submitSection = handle("submitSection", async (req, res) => {
    const { test, section } = await loadSection(req);
    if (test.status !== "draft") throw userError("The test is already published");
    const questions = await Question.find({ _id: { $in: section.questionIds } }).select("type").lean();
    const c = counts(questions);
    if (c.mcq !== (section.mcqCount || 0) || c.numerical !== (section.numericalCount || 0)) {
        throw userError(`Pick exactly ${section.mcqCount} MCQ and ${section.numericalCount} numerical questions first (now ${c.mcq} + ${c.numerical})`);
    }
    section.submittedAt = new Date();
    await test.save();
    res.json({ message: "Handed in", submittedAt: section.submittedAt });
});

module.exports = { mySections, getSection, browseQuestions, savePicks, submitSection };
