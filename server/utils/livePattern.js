// Default sections for a live test, per exam. The head lecturer can change the
// counts and leave sections out; Biology can be split into Botany and Zoology.
// [key, section name, subject in the syllabus, MCQs, numericals]
const PATTERNS = {
    JEE: {
        minutes: 180,
        sections: [
            ["physics", "Physics", "physics", 20, 5],
            ["chemistry", "Chemistry", "chemistry", 20, 5],
            ["mathematics", "Mathematics", "mathematics", 20, 5],
        ],
    },
    NEET: {
        minutes: 180,
        sections: [
            ["physics", "Physics", "physics", 45, 0],
            ["chemistry", "Chemistry", "chemistry", 45, 0],
            ["biology", "Biology", "biology", 90, 0],
        ],
        split: [
            ["botany", "Botany", "biology", 45, 0],
            ["zoology", "Zoology", "biology", 45, 0],
        ],
    },
    KCET: {
        minutes: 320,
        sections: [
            ["physics", "Physics", "physics", 60, 0],
            ["chemistry", "Chemistry", "chemistry", 60, 0],
            ["mathematics", "Mathematics", "mathematics", 60, 0],
            ["biology", "Biology", "biology", 60, 0],
        ],
        split: [
            ["botany", "Botany", "biology", 30, 0],
            ["zoology", "Zoology", "biology", 30, 0],
        ],
    },
};

const subjectKey = (name) => {
    const k = String(name || "").toLowerCase().replace(/[^a-z]/g, "");
    return k === "maths" || k === "math" ? "mathematics" : k;
};

// The sections an exam offers: [{ key, name, subjectKey, mcqCount, numericalCount }]
const sectionsFor = (examCode, splitBiology) => {
    const p = PATTERNS[String(examCode).toUpperCase()];
    if (!p) return [];
    const list = [];
    for (const s of p.sections) {
        if (s[0] === "biology" && splitBiology && p.split) list.push(...p.split);
        else list.push(s);
    }
    return list.map(([key, name, subj, mcq, num]) => ({ key, name, subjectKey: subj, mcqCount: mcq, numericalCount: num }));
};

const patternFor = (examCode) => PATTERNS[String(examCode).toUpperCase()] || null;
const canSplitBiology = (examCode) => Boolean(patternFor(examCode)?.split);

module.exports = { sectionsFor, patternFor, canSplitBiology, subjectKey };
