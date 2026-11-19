// Finds the GenPrep topic for (exam code, subject, chapter, topic) given as names,
// using the same name matching as the bulk upload. Loads the syllabus once per sync.
//
// SUPABASE_CREATE_TOPICS   (default true)  add a missing topic under an existing chapter
// SUPABASE_CREATE_CHAPTERS (default false) add a missing chapter under an existing subject

const Exam = require("../models/Exam");
const Subject = require("../models/Subject");
const Chapter = require("../models/Chapter");
const Topic = require("../models/Topic");

const clean = (v) => (v === undefined || v === null ? "" : String(v).trim());
const key = (v) => clean(v).toLowerCase().replace(/[‘’'`]/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
const slugify = (s) => String(s).toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const SUBJECT_ALIASES = { maths: ["mathematics", "math"], mathematics: ["maths", "math"], math: ["maths", "mathematics"] };

const flag = (name, fallback) => {
    const v = clean(process.env[name]).toLowerCase();
    if (!v) return fallback;
    return ["1", "true", "yes", "on"].includes(v);
};

const makeResolver = async () => {
    const createTopics = flag("SUPABASE_CREATE_TOPICS", true);
    const createChapters = flag("SUPABASE_CREATE_CHAPTERS", false);

    const [exams, subjects, chapters, topics] = await Promise.all([
        Exam.find().select("code").lean(),
        Subject.find().select("examId name").lean(),
        Chapter.find().select("examId subjectId name").lean(),
        Topic.find().select("examId subjectId chapterId name").lean(),
    ]);
    const examByCode = new Map(exams.map((e) => [String(e.code).toUpperCase(), e]));
    const subjectMap = new Map(subjects.map((s) => [s.examId + "|" + key(s.name), s]));
    const chapterMap = new Map(chapters.map((c) => [c.subjectId + "|" + key(c.name), c]));
    const topicMap = new Map(topics.map((t) => [t.chapterId + "|" + key(t.name), t]));
    // "Semiconductor Electronics: Materials, Devices and Simple Circuits" -> "Semiconductor Electronics"
    // (also the other way round). Not used for "(Legacy / Removed Syllabus)" chapters.
    const beforeColon = (name) => key(String(name).split(":")[0]).replace(/^the /, "");
    const shortChapters = new Map();
    for (const c of chapters) {
        const k = c.subjectId + "|" + beforeColon(c.name);
        if (!shortChapters.has(k)) shortChapters.set(k, c);
    }
    const findShortChapter = (subject, name) => {
        if (/legacy|removed/i.test(name)) return null;
        return shortChapters.get(subject._id + "|" + beforeColon(name)) || null;
    };
    // Chapters never created automatically
    const noAutoCreate = (name) => /legacy|removed|^\s*general\s*$|^\s*misc/i.test(name);
    const creating = new Map(); // one create per new chapter/topic, even with parallel rows

    const createOnce = (mapKey, map, create) => {
        if (!creating.has(mapKey)) {
            creating.set(
                mapKey,
                create().then((doc) => {
                    map.set(mapKey, doc);
                    return doc;
                })
            );
        }
        return creating.get(mapKey);
    };

    const newChapter = (subject, name, klass) =>
        createOnce(subject._id + "|" + key(name), chapterMap, async () => {
            const slug = slugify(name) || "chapter-" + Date.now();
            const found = await Chapter.findOne({ subjectId: subject._id, slug }).lean();
            if (found) return found;
            const order = await Chapter.countDocuments({ subjectId: subject._id });
            return (
                await Chapter.create({ examId: subject.examId, subjectId: subject._id, name, slug, classLevel: klass, order: order + 1 })
            ).toObject();
        });

    const newTopic = (chapter, name) =>
        createOnce(chapter._id + "|" + key(name), topicMap, async () => {
            const slug = slugify(name) || "topic-" + Date.now();
            const found = await Topic.findOne({ chapterId: chapter._id, slug }).lean();
            if (found) return found;
            const order = await Topic.countDocuments({ chapterId: chapter._id });
            try {
                return (
                    await Topic.create({ examId: chapter.examId, subjectId: chapter.subjectId, chapterId: chapter._id, name, slug, order: order + 1 })
                ).toObject();
            } catch (err) {
                if (err.code === 11000) return Topic.findOne({ chapterId: chapter._id, slug }).lean();
                throw err;
            }
        });

    // Returns { topic } or { error }
    const resolve = async (examCode, names) => {
        const exam = examByCode.get(String(examCode).toUpperCase());
        if (!exam) return { error: `Exam "${examCode}" does not exist in GenPrep` };

        const subjectKeys = [key(names.subject), ...(SUBJECT_ALIASES[key(names.subject)] || [])];
        const subject = subjectKeys.map((k) => subjectMap.get(exam._id + "|" + k)).find(Boolean);
        if (!subject) return { error: `Subject "${names.subject}" not found in ${examCode}` };

        let chapter = chapterMap.get(subject._id + "|" + key(names.chapter)) || findShortChapter(subject, names.chapter);
        if (!chapter) {
            if (!createChapters || !["11", "12"].includes(names.klass) || noAutoCreate(names.chapter)) {
                return { error: `Chapter "${names.chapter}" not found in ${examCode} ${subject.name}` };
            }
            chapter = await newChapter(subject, names.chapter, names.klass);
        }

        let topic = topicMap.get(chapter._id + "|" + key(names.topic));
        if (!topic) {
            if (!createTopics) return { error: `Topic "${names.topic}" not found in ${chapter.name}` };
            topic = await newTopic(chapter, names.topic);
        }
        return { topic };
    };

    return { resolve };
};

module.exports = { makeResolver };
