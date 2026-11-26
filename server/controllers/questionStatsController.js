const Exam = require("../models/Exam");
const Subject = require("../models/Subject");
const Question = require("../models/Question");

// GET /api/admin/stats/questions
// How many questions each exam has, per subject (published and drafts)
const questionBreakdown = async (req, res) => {
  try {
    const [exams, subjects, groups] = await Promise.all([
      Exam.find().sort({ order: 1, name: 1 }).lean(),
      Subject.find().sort({ order: 1, name: 1 }).lean(),
      Question.aggregate([{ $group: { _id: { s: "$subjectId", st: "$status" }, n: { $sum: 1 } } }]),
    ]);
    const count = {};
    for (const g of groups) count[String(g._id.s) + "|" + g._id.st] = g.n;
    const result = exams.map((e) => {
      const subs = subjects
        .filter((s) => String(s.examId) === String(e._id))
        .map((s) => ({
          name: s.name,
          published: count[String(s._id) + "|published"] || 0,
          drafts: count[String(s._id) + "|draft"] || 0,
        }));
      return {
        code: e.code,
        name: e.name,
        published: subs.reduce((a, s) => a + s.published, 0),
        drafts: subs.reduce((a, s) => a + s.drafts, 0),
        subjects: subs,
      };
    });
    res.json({ exams: result });
  } catch (error) {
    console.error("questionBreakdown error:", error.message);
    res.status(500).json({ message: "Something went wrong on the server" });
  }
};

module.exports = { questionBreakdown };

// GET /api/admin/syllabus-filters?examId=...
// Subjects, chapters (with class) and topics of one exam, for the question filters
const Chapter = require("../models/Chapter");
const Topic = require("../models/Topic");
const syllabusFilters = async (req, res) => {
  try {
    const { examId } = req.query;
    if (!require("mongoose").isValidObjectId(examId)) return res.status(400).json({ message: "Choose an exam first" });
    const [subjects, chapters, topics] = await Promise.all([
      Subject.find({ examId }).sort({ order: 1, name: 1 }).select("name").lean(),
      Chapter.find({ examId }).sort({ order: 1, name: 1 }).select("name subjectId classLevel").lean(),
      Topic.find({ examId }).sort({ order: 1, name: 1 }).select("name chapterId").lean(),
    ]);
    res.json({ subjects, chapters, topics });
  } catch (error) {
    console.error("syllabusFilters error:", error.message);
    res.status(500).json({ message: "Something went wrong on the server" });
  }
};
module.exports.syllabusFilters = syllabusFilters;
// GET /api/admin/question-counts?exam=NEET&status=published|draft|all
// Every count the head lecturer asks for: total, per subject, per chapter, per concept,
// per question type and per difficulty.
const questionCounts = async (req, res) => {
  try {
    const exams = await Exam.find().sort({ order: 1, code: 1 }).select("code name").lean();
    const exam = exams.find((e) => e.code === String(req.query.exam || "").toUpperCase()) || exams.find((e) => e.code === "NEET") || exams[0];
    if (!exam) return res.json({ exams: [], exam: null, subjects: [] });
    const status = ["published", "draft", "all"].includes(req.query.status) ? req.query.status : "published";

    const match = { examId: exam._id, ...(status === "all" ? {} : { status }) };
    const [subjects, chapters, topics, groups] = await Promise.all([
      Subject.find({ examId: exam._id }).sort({ order: 1, name: 1 }).select("name").lean(),
      Chapter.find({ examId: exam._id }).sort({ classLevel: 1, order: 1, name: 1 }).select("name subjectId classLevel").lean(),
      Topic.find({ examId: exam._id }).sort({ order: 1, name: 1 }).select("name chapterId").lean(),
      Question.aggregate([
        { $match: match },
        { $group: { _id: { s: "$subjectId", c: "$chapterId", t: "$topicId", f: "$format", d: "$difficulty" }, n: { $sum: 1 } } },
      ]),
    ]);

    const empty = () => ({ total: 0, types: {}, levels: {} });
    const add = (box, g) => {
      box.total += g.n;
      const f = g._id.f || "not_set";
      const d = g._id.d || "medium";
      box.types[f] = (box.types[f] || 0) + g.n;
      box.levels[d] = (box.levels[d] || 0) + g.n;
    };
    const bySubject = new Map();
    const byChapter = new Map();
    const byTopic = new Map();
    const all = empty();
    for (const g of groups) {
      add(all, g);
      for (const [map, key] of [[bySubject, g._id.s], [byChapter, g._id.c], [byTopic, g._id.t]]) {
        const k = String(key || "none");
        if (!map.has(k)) map.set(k, empty());
        add(map.get(k), g);
      }
    }

    const out = subjects.map((s) => ({
      _id: s._id,
      name: s.name,
      ...(bySubject.get(String(s._id)) || empty()),
      chapters: chapters
        .filter((c) => String(c.subjectId) === String(s._id))
        .map((c) => ({
          _id: c._id,
          name: c.name,
          classLevel: c.classLevel,
          ...(byChapter.get(String(c._id)) || empty()),
          topics: topics
            .filter((t) => String(t.chapterId) === String(c._id))
            .map((t) => ({ _id: t._id, name: t.name, ...(byTopic.get(String(t._id)) || empty()) })),
        })),
    }));

    res.json({ exams: exams.map((e) => e.code), exam: exam.code, status, ...all, subjects: out });
  } catch (error) {
    console.error("questionCounts error:", error.message);
    res.status(500).json({ message: "Something went wrong on the server" });
  }
};
module.exports.questionCounts = questionCounts;
