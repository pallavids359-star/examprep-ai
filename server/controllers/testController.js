const mongoose = require("mongoose");
const Test = require("../models/Test");
const Question = require("../models/Question");
const Exam = require("../models/Exam");
const Subject = require("../models/Subject");
const Chapter = require("../models/Chapter");
const Topic = require("../models/Topic");
const TestAttempt = require("../models/TestAttempt");
const { finalizeAttempt, isExpired } = require("../utils/finalizeAttempt");

const isValidId = (id) => mongoose.isValidObjectId(id);
const toObjectId = (id) => new mongoose.Types.ObjectId(id);
const TEST_TYPES = ["chapter", "subject", "full_syllabus", "pyq", "custom"];

// An error whose message is safe to show to the user
const userError = (message, status = 400) => Object.assign(new Error(message), { status });

const sendError = (res, error, where) => {
    if (error.status) return res.status(error.status).json({ message: error.message });
    console.error(`${where} error:`, error);
    // On your own computer show the real reason; on the live site keep it generic
    const detail = process.env.NODE_ENV !== "production" && !process.env.VERCEL ? ` (${error.name}: ${error.message})` : "";
    return res.status(500).json({ message: "Something went wrong on the server" + detail });
};

// Fills one section: the exact questions listed, or random ones by count
const buildSection = async (examId, section) => {
    if (!isValidId(section.subjectId)) throw userError("Each section needs a valid subjectId");
    const subject = await Subject.findOne({ _id: section.subjectId, examId });
    if (!subject) throw userError("A section's subject does not belong to this exam");

    // Option 1: the admin chose exact questions
    if (Array.isArray(section.questionIds) && section.questionIds.length > 0) {
        const ids = section.questionIds.filter(isValidId);
        const found = await Question.countDocuments({ _id: { $in: ids }, subjectId: subject._id, status: "published" });
        if (found !== ids.length) throw userError(`Some ${subject.name} questions were not found or are not published`);
        return { name: subject.name, subjectId: subject._id, questionIds: ids };
    }

    // Option 2: pick random published questions
    const count = parseInt(section.count) || 0;
    if (count < 1) throw userError(`Give a question count for ${subject.name}`);

    const match = { examId: toObjectId(examId), subjectId: subject._id, status: "published" };
    const chapterIds = (section.chapterIds || []).filter(isValidId);
    if (chapterIds.length > 0) match.chapterId = { $in: chapterIds.map(toObjectId) };

    const picked = await Question.aggregate([{ $match: match }, { $sample: { size: count } }, { $project: { _id: 1 } }]);
    if (picked.length < count) {
        throw userError(`Only ${picked.length} published ${subject.name} questions are available, but ${count} were requested`);
    }
    return { name: subject.name, subjectId: subject._id, questionIds: picked.map((q) => q._id) };
};

// ADMIN: POST /api/admin/tests
// Body: { title, examId, type, durationMinutes, instructions, maxAttempts,
//         sections: [{ subjectId, count, chapterIds? }  or  { subjectId, questionIds }] }
const createTest = async (req, res) => {
    try {
        const { title, examId, type = "subject", durationMinutes, instructions = "", maxAttempts = 0, sections, status = "published" } = req.body;

        if (!title || !title.trim()) throw userError("A title is required");
        if (!isValidId(examId)) throw userError("A valid examId is required");
        const exam = await Exam.findById(examId);
        if (!exam) throw userError("Exam not found", 404);

        const minutes = parseInt(durationMinutes);
        if (!minutes || minutes < 1 || minutes > 360) throw userError("Duration must be between 1 and 360 minutes");
        if (!TEST_TYPES.includes(type)) throw userError(`Type must be one of: ${TEST_TYPES.join(", ")}`);
        if (!Array.isArray(sections) || sections.length === 0) throw userError("Add at least one section");

        const built = [];
        for (const section of sections) built.push(await buildSection(examId, section));

        const totalQuestions = built.reduce((sum, s) => sum + s.questionIds.length, 0);
        const markingScheme = {
            correct: exam.markingScheme.correct,
            incorrect: exam.markingScheme.incorrect,
            unanswered: exam.markingScheme.unanswered,
        };

        const test = await Test.create({
            title: title.trim(),
            examId,
            type,
            sections: built,
            durationMinutes: minutes,
            markingScheme,
            totalQuestions,
            totalMarks: totalQuestions * markingScheme.correct,
            instructions,
            maxAttempts: Math.max(0, parseInt(maxAttempts) || 0),
            status: ["draft", "published"].includes(status) ? status : "published",
            createdBy: req.user._id,
        });

        res.status(201).json({ message: "Test created", test });
    } catch (error) {
        sendError(res, error, "createTest");
    }
};

// ADMIN: GET /api/admin/tests?examId=...
const listTestsAdmin = async (req, res) => {
    try {
        const filter = { status: { $ne: "archived" }, type: { $ne: "live" } }; // live tests have their own page
        if (isValidId(req.query.examId)) filter.examId = req.query.examId;
        const tests = await Test.find(filter).sort({ createdAt: -1 }).select("-sections.questionIds").lean();
        res.json({ tests });
    } catch (error) {
        sendError(res, error, "listTestsAdmin");
    }
};

// ADMIN: DELETE /api/admin/tests/:id  (archive, so old results keep working)
const deleteTest = async (req, res) => {
    try {
        if (!isValidId(req.params.id)) throw userError("Invalid test id");
        const test = await Test.findByIdAndUpdate(req.params.id, { status: "archived" });
        if (!test) throw userError("Test not found", 404);
        res.json({ message: "Test deleted (archived)" });
    } catch (error) {
        sendError(res, error, "deleteTest");
    }
};

// STUDENT: GET /api/tests?examId=...
const listTests = async (req, res) => {
    try {
        const { examId } = req.query;
        if (!isValidId(examId)) throw userError("A valid examId is required");

        const tests = await Test.find({ examId, status: "published", type: { $ne: "live" } })
            .sort({ createdAt: -1 })
            .select("title type durationMinutes totalQuestions totalMarks maxAttempts instructions markingScheme availability stats sections.name")
            .lean();

        const attempts = await TestAttempt.find({ userId: req.user._id, testId: { $in: tests.map((t) => t._id) } })
            .sort({ createdAt: -1 })
            .select("testId status result.score expiresAt")
            .lean();

        const now = new Date();
        res.json({
            tests: tests.map((t) => {
                const mine = attempts.filter((a) => String(a.testId) === String(t._id));
                const done = mine.filter((a) => a.status !== "in_progress");
                const open = mine.find((a) => a.status === "in_progress" && !isExpired(a));
                const scores = done.map((a) => a.result?.score).filter((s) => typeof s === "number");
                const startsAt = t.availability?.startsAt;
                const endsAt = t.availability?.endsAt;
                return {
                    ...t,
                    sections: t.sections.map((s) => s.name),
                    attemptsUsed: mine.length,
                    bestScore: scores.length ? Math.max(...scores) : null,
                    lastAttemptId: done[0]?._id || null,
                    inProgressAttemptId: open ? open._id : null,
                    isOpen: (!startsAt || startsAt <= now) && (!endsAt || endsAt >= now),
                };
            }),
        });
    } catch (error) {
        sendError(res, error, "listTests");
    }
};

// STUDENT: POST /api/tests/:id/start
const startTest = async (req, res) => {
    try {
        if (!isValidId(req.params.id)) throw userError("Invalid test id");
        const test = await Test.findOne({ _id: req.params.id, status: "published", type: { $ne: "live" } });
        if (!test) throw userError("Test not found", 404);

        const now = new Date();
        if (test.availability?.startsAt && test.availability.startsAt > now) throw userError("This test has not opened yet", 403);
        if (test.availability?.endsAt && test.availability.endsAt < now) throw userError("This test has closed", 403);

        // Resume an unfinished attempt instead of starting a new one
        const open = await TestAttempt.findOne({ userId: req.user._id, testId: test._id, status: "in_progress" });
        if (open) {
            if (!isExpired(open)) return res.json({ attemptId: open._id, resumed: true });
            await finalizeAttempt(open, null, true); // its time ran out while the student was away
        }

        if (test.maxAttempts > 0) {
            const used = await TestAttempt.countDocuments({ userId: req.user._id, testId: test._id });
            if (used >= test.maxAttempts) throw userError(`You have used all ${test.maxAttempts} attempt(s) for this test`, 403);
        }

        // Keep the question order of the sections
        const orderedIds = test.sections.flatMap((s) => s.questionIds);
        const questions = await Question.find({ _id: { $in: orderedIds }, status: "published" })
            .select("subjectId chapterId topicId")
            .lean();
        const byId = new Map(questions.map((q) => [String(q._id), q]));
        const answers = orderedIds
            .map((qid) => byId.get(String(qid)))
            .filter(Boolean)
            .map((q) => ({ questionId: q._id, subjectId: q.subjectId, chapterId: q.chapterId, topicId: q.topicId }));
        if (answers.length === 0) throw userError("This test has no available questions");

        const attempt = await TestAttempt.create({
            userId: req.user._id,
            examId: test.examId,
            mode: "mock",
            testId: test._id,
            markingScheme: {
                correct: test.markingScheme.correct,
                incorrect: test.markingScheme.incorrect,
                unanswered: test.markingScheme.unanswered,
            },
            startedAt: now,
            expiresAt: new Date(now.getTime() + test.durationMinutes * 60 * 1000), // the official deadline
            answers,
        });

        res.status(201).json({ attemptId: attempt._id, resumed: false });
    } catch (error) {
        sendError(res, error, "startTest");
    }
};

// ---------- Student-made mock tests ----------

// The real paper pattern for each exam. KCET has two streams.
const PATTERNS = {
    NEET: { minutes: 180, sections: [["physics", 45], ["chemistry", 45], ["biology", 90]] },
    JEE: { minutes: 180, sections: [["physics", 25], ["chemistry", 25], ["mathematics", 25]] },
    KCET_PCM: { minutes: 240, sections: [["physics", 60], ["chemistry", 60], ["mathematics", 60]] },
    KCET_PCB: { minutes: 240, sections: [["physics", 60], ["chemistry", 60], ["biology", 60]] },
    KCET_PCMB: { minutes: 320, sections: [["physics", 60], ["chemistry", 60], ["mathematics", 60], ["biology", 60]] },
};
const subjectKey = (name) => {
    const k = String(name || "").toLowerCase().replace(/[^a-z]/g, "");
    return k === "maths" || k === "math" ? "mathematics" : k;
};
const patternFor = (code, stream) => {
    if (code === "KCET") {
        const s = ["PCMB", "PCB"].includes(stream) ? stream : "PCM";
        return { key: `KCET_${s}`, label: `KCET (${s})` };
    }
    return { key: code, label: code };
};

// ---------- How each subject's questions are picked ----------

// JEE Main: each subject has 20 MCQs followed by 5 numerical questions.
// NEET and KCET are MCQ only.
const NUMERICAL_PER_SUBJECT = { JEE: 5 };

// Every subject gets a share of questions with a diagram: at least 10,
// and more for long sections (about 2 in 9, e.g. 20 of NEET Biology's 90).
const diagramTarget = (count) => Math.min(count, Math.max(10, Math.round((count * 2) / 9)));

// A question "has a diagram" when it has an uploaded image, an option image,
// or a {{IMG::https://...}} picture in its text or options.
const IMG_IN_TEXT = /\{\{IMG::/;
const HAS_DIAGRAM = {
    $or: [{ "images.0": { $exists: true } }, { "options.image.url": { $exists: true } }, { text: IMG_IN_TEXT }, { "options.text": IMG_IN_TEXT }],
};

const shuffle = (list) => {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
};

const sample = (match, size) =>
    size > 0
        ? Question.aggregate([{ $match: match }, { $sample: { size } }, { $project: { _id: 1, type: 1, subjectId: 1, chapterId: 1, topicId: 1 } }])
        : Promise.resolve([]);

// Picks one subject's questions: MCQs (with the diagram share mixed in), then numericals at the end.
// Numericals are looked for in the chosen chapters and difficulty first, then any difficulty, then
// the whole subject (wider), so JEE gets its 5 whenever the bank has them. Only if the subject has
// none left are the missing places filled with MCQs.
const pickSection = async (baseMatch, count, numericalCount, wider = []) => {
    const numericals = await sample({ ...baseMatch, type: "numerical" }, numericalCount);
    for (const w of wider) {
        if (numericals.length >= numericalCount) break;
        numericals.push(...(await sample({ ...w, type: "numerical", _id: { $nin: numericals.map((q) => q._id) } }, numericalCount - numericals.length)));
    }
    const mcqCount = count - numericals.length; // too few numericals: fill with MCQs
    const mcqMatch = { ...baseMatch, type: { $ne: "numerical" } };

    const diagrams = await sample({ ...mcqMatch, $and: [HAS_DIAGRAM] }, Math.min(diagramTarget(count), mcqCount));
    const taken = diagrams.map((q) => q._id);
    const others = await sample({ ...mcqMatch, _id: { $nin: taken } }, mcqCount - diagrams.length);

    return [...shuffle([...diagrams, ...others]), ...numericals];
};

// For a chapter-wise mock: which chapters (and ticked concepts) to use, grouped by subject.
// A chapter with ticked concepts gives only those concepts; one with none gives all of it.
const chosenSyllabus = async (exam, chapterIds, topicIds) => {
    const asList = (v) => (Array.isArray(v) ? v : v ? [v] : []);
    const wanted = [...new Set(asList(chapterIds).map(String))].filter(isValidId).slice(0, 300);
    if (wanted.length === 0) return null; // full syllabus

    const chapters = await Chapter.find({ _id: { $in: wanted.map(toObjectId) }, examId: exam._id }).select("subjectId").lean();
    if (chapters.length === 0) throw userError("Choose at least one chapter from this exam");

    const chapterSet = new Set(chapters.map((c) => String(c._id)));
    const validTopics = asList(topicIds).filter(isValidId).slice(0, 1000);
    const topics = validTopics.length ? await Topic.find({ _id: { $in: validTopics.map(toObjectId) } }).select("chapterId").lean() : [];
    const topicsByChapter = new Map();
    for (const t of topics) {
        const k = String(t.chapterId);
        if (!chapterSet.has(k)) continue;
        if (!topicsByChapter.has(k)) topicsByChapter.set(k, []);
        topicsByChapter.get(k).push(t._id);
    }

    const bySubject = new Map(); // subjectId -> [$or parts]
    for (const c of chapters) {
        const k = String(c.subjectId);
        if (!bySubject.has(k)) bySubject.set(k, []);
        const ts = topicsByChapter.get(String(c._id));
        bySubject.get(k).push(ts ? { chapterId: c._id, topicId: { $in: ts } } : { chapterId: c._id });
    }
    return bySubject;
};

// STUDENT: POST /api/tests/generate
// Body: { examId, stream?: "PCM" | "PCB" | "PCMB",
//         chapterIds?: [...], topicIds?: [...],   (leave out for the full syllabus)
//         difficulty?: "any" | "easy" | "medium" | "hard" }
// Makes a fresh mock test from random published questions and starts it.
const generateMock = async (req, res) => {
    try {
        const { examId, stream, chapterIds, topicIds } = req.body;
        const difficulty = ["easy", "medium", "hard"].includes(req.body.difficulty) ? req.body.difficulty : "any";
        if (!isValidId(examId)) throw userError("Choose an exam");
        const exam = await Exam.findById(examId);
        if (!exam) throw userError("Exam not found", 404);
        const { key, label } = patternFor(exam.code, stream);
        const pattern = PATTERNS[key];
        if (!pattern) throw userError(`Mock tests are not ready for ${exam.code} yet`);

        // Only one mock at a time: resume the unfinished one
        const open = await TestAttempt.findOne({ userId: req.user._id, mode: "mock", status: "in_progress" });
        if (open) {
            if (!isExpired(open)) return res.json({ attemptId: open._id, resumed: true });
            await finalizeAttempt(open, null, true);
        }

        const custom = await chosenSyllabus(exam, chapterIds, topicIds);

        const subjects = await Subject.find({ examId: exam._id }).lean();
        const sections = [];
        const notes = [];
        for (const [name, count] of pattern.sections) {
            const subject = subjects.find((s) => subjectKey(s.name) === name);
            if (!subject) continue;
            const match = { examId: exam._id, subjectId: subject._id, status: "published" };
            if (custom) {
                const parts = custom.get(String(subject._id));
                if (!parts) continue; // no chapters chosen in this subject
                match.$or = parts;
            }
            if (difficulty !== "any") match.difficulty = difficulty;
            const numNeed = NUMERICAL_PER_SUBJECT[exam.code] || 0;
            const anyLevel = { ...match };
            delete anyLevel.difficulty;
            const wholeSubject = { examId: exam._id, subjectId: subject._id, status: "published" };
            const picked = await pickSection(match, count, numNeed, [anyLevel, wholeSubject]);
            const gotNum = picked.filter((q) => q.type === "numerical").length;
            if (numNeed && gotNum < numNeed) notes.push(`${subject.name}: only ${gotNum} numerical question${gotNum === 1 ? "" : "s"} in the bank, so ${numNeed - gotNum} MCQ${numNeed - gotNum === 1 ? "" : "s"} added instead`);
            if (picked.length) sections.push({ name: subject.name, subjectId: subject._id, picked });
        }
        const all = sections.flatMap((s) => s.picked);
        if (all.length === 0) {
            throw userError(custom || difficulty !== "any" ? "No questions found for these choices. Try more chapters or another difficulty." : `No questions are available for ${label} yet`);
        }

        // Full paper: the real time. Chapter-wise: time in proportion to the questions
        const patternTotal = pattern.sections.reduce((a, [, n]) => a + n, 0);
        const minutes = custom ? Math.max(5, Math.round((pattern.minutes * all.length) / patternTotal)) : pattern.minutes;
        const level = difficulty === "any" ? "" : ` (${difficulty[0].toUpperCase()}${difficulty.slice(1)})`;

        const markingScheme = {
            correct: exam.markingScheme.correct,
            incorrect: exam.markingScheme.incorrect,
            unanswered: exam.markingScheme.unanswered,
        };
        const number = (await Test.countDocuments({ ownerId: req.user._id, examId: exam._id })) + 1;
        const test = await Test.create({
            title: `${label} ${custom ? "Chapter-wise " : ""}Mock Test ${number}${level}`,
            examId: exam._id,
            type: custom ? "custom" : "full_syllabus",
            sections: sections.map((s) => ({ name: s.name, subjectId: s.subjectId, questionIds: s.picked.map((q) => q._id) })),
            durationMinutes: minutes,
            markingScheme,
            totalQuestions: all.length,
            totalMarks: all.length * markingScheme.correct,
            instructions: "",
            status: "archived", // personal test: never listed for other students
            createdBy: req.user._id,
            ownerId: req.user._id,
        });

        const now = new Date();
        const attempt = await TestAttempt.create({
            userId: req.user._id,
            examId: exam._id,
            mode: "mock",
            testId: test._id,
            markingScheme,
            startedAt: now,
            expiresAt: new Date(now.getTime() + minutes * 60 * 1000),
            answers: all.map((q) => ({ questionId: q._id, subjectId: q.subjectId, chapterId: q.chapterId, topicId: q.topicId })),
        });

        res.status(201).json({ attemptId: attempt._id, resumed: false, title: test.title, totalQuestions: all.length, minutes, notes });
    } catch (error) {
        sendError(res, error, "generateMock");
    }
};

// STUDENT: GET /api/tests/mine   (my recent mock tests)
const myMocks = async (req, res) => {
    try {
        const attempts = await TestAttempt.find({ userId: req.user._id, mode: "mock" })
            .sort({ createdAt: -1 })
            .limit(20)
            .select("testId examId status result.score result.maxScore result.percentage startedAt submittedAt expiresAt")
            .lean();
        const tests = await Test.find({ _id: { $in: attempts.map((a) => a.testId).filter(Boolean) } }).select("title totalQuestions").lean();
        const exams = await Exam.find({ _id: { $in: attempts.map((a) => a.examId) } }).select("code").lean();
        const testById = new Map(tests.map((t) => [String(t._id), t]));
        const examById = new Map(exams.map((e) => [String(e._id), e.code]));
        res.json({
            mocks: attempts.map((a) => ({
                attemptId: a._id,
                title: testById.get(String(a.testId))?.title || "Mock test",
                examCode: examById.get(String(a.examId)) || "",
                totalQuestions: testById.get(String(a.testId))?.totalQuestions || 0,
                inProgress: a.status === "in_progress" && !isExpired(a),
                score: a.result?.score ?? null,
                maxScore: a.result?.maxScore ?? null,
                percentage: a.result?.percentage ?? null,
                date: a.submittedAt || a.startedAt,
            })),
        });
    } catch (error) {
        sendError(res, error, "myMocks");
    }
};

module.exports = { createTest, listTestsAdmin, deleteTest, listTests, startTest, generateMock, myMocks };