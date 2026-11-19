// Run with:  npm test   (from the server folder)
const test = require("node:test");
const assert = require("node:assert");
const { convertQbpRow, isQbpRow, normText } = require("../utils/qbpFormat");
const { mapRow } = require("../utils/supabaseMapper");

const base = {
    id: "000a5e74-5c73-4892-97d2-e1c31258bbf0",
    subject: "Mathematics",
    klass: "11",
    chapter: "Relations and Functions",
    topic: "Types of Functions",
    exams: ["JEE"],
    q_type: "mcq_single",
    question: "12. The domain of $f$ is",
    opt_a: "$[-3,3]$",
    opt_b: "$(-3,0)\\cup(0,3)$",
    opt_c: "$[-3,0)\\cup(0,3]$",
    opt_d: "$\\mathbb{R}$",
    assertion: "",
    reason: "",
    predef_options: "",
    column_a: [],
    column_b: [],
    match_options: { A: "", B: "", C: "", D: "" },
    num_answer: "",
    correct_option: "C",
    solution_text: "[QBP_DIFFICULTY:Easy] Both square roots must be defined.",
    review_status: null,
    acceptance_status: null,
    source: "",
    year: "",
};

test("recognises question website rows and maps them via mapRow", () => {
    assert.equal(isQbpRow(base), true);
    const r = mapRow(base);
    assert.equal(r.ok, true);
    assert.deepEqual(r.exams, ["JEE"]);
    assert.deepEqual(r.names, { subject: "Mathematics", klass: "11", chapter: "Relations and Functions", topic: "Types of Functions" });
    assert.equal(r.data.type, "mcq_single");
    assert.deepEqual(r.data.correctOptionIds, ["C"]);
    assert.equal(r.data.options[3].text, "$\\mathbb{R}$");
    assert.equal(r.data.difficulty, "easy");
    assert.equal(r.data.explanation.text, "Both square roots must be defined.");
    assert.equal(r.data.status, "published");
    assert.deepEqual(r.data.tags, ["mcq_single"]);
});

test("review status: pending -> draft, rejected -> archived", () => {
    assert.equal(convertQbpRow({ ...base, review_status: "pending", acceptance_status: "pending" }).data.status, "draft");
    assert.equal(convertQbpRow({ ...base, acceptance_status: "pending" }, { pendingStatus: "published" }).data.status, "published");
    assert.equal(convertQbpRow({ ...base, acceptance_status: "rejected" }).data.status, "archived");
    assert.equal(convertQbpRow({ ...base, review_status: "approved", acceptance_status: "accepted" }).data.status, "published");
});

test("correct_option '1' means A; 'A,C' is multi-correct", () => {
    assert.deepEqual(convertQbpRow({ ...base, correct_option: "1" }).data.correctOptionIds, ["A"]);
    const multi = convertQbpRow({ ...base, correct_option: "a, c" });
    assert.deepEqual(multi.data.correctOptionIds, ["A", "C"]);
    assert.equal(multi.data.type, "mcq_multi");
});

test("several exams and exams stored as text", () => {
    assert.deepEqual(convertQbpRow({ ...base, exams: '["JEE","neet"]' }).exams, ["JEE", "NEET"]);
    assert.deepEqual(convertQbpRow({ ...base, exams: "KCET" }).exams, ["KCET"]);
    assert.deepEqual(convertQbpRow({ ...base, exams: ["NEET/JEE"] }).exams, ["NEET", "JEE"]);
    assert.deepEqual(convertQbpRow({ ...base, exams: ["JEE MAIN", "JEE Advanced", "NEET"] }).exams, ["JEE", "NEET"]);
    assert.match(convertQbpRow({ ...base, exams: [] }).reason, /exams column is empty/);
});

test("assertion-reason uses standard options when none are given", () => {
    const r = convertQbpRow({
        ...base, q_type: "assertion_reason", question: "", assertion: "A is true", reason: "R is true",
        opt_a: "", opt_b: "", opt_c: "", opt_d: "", correct_option: "A",
    });
    assert.equal(r.data.text, "Assertion (A): A is true\n\nReason (R): R is true");
    assert.match(r.data.options[0].text, /Both A and R are true and R is the correct explanation/);
});

test("match the column builds the lists", () => {
    const r = convertQbpRow({
        ...base, q_type: "match_the_column", question: "Match", column_a: ["Golgi", "ER"], column_b: ["Packaging", "Synthesis"],
        opt_a: "", opt_b: "", opt_c: "", opt_d: "", match_options: { A: "P-1, Q-2", B: "P-2, Q-1", C: "P-1, Q-1", D: "P-2, Q-2" }, correct_option: "A",
    });
    assert.equal(r.data.text, "Match\n\nList I:\n(P) Golgi\n(Q) ER\n\nList II:\n(1) Packaging\n(2) Synthesis");
    assert.equal(r.data.options[1].text, "P-2, Q-1");
});

test("numerical questions", () => {
    const r = convertQbpRow({ ...base, q_type: "numerical", num_answer: "$ 9.8 $", opt_a: "", opt_b: "", opt_c: "", opt_d: "" });
    assert.deepEqual(r.data.numericalAnswer, { value: 9.8, tolerance: 0 });
    assert.match(convertQbpRow({ ...base, q_type: "numerical", num_answer: "x^2" }).reason, /not a number/);
});

test("skips rows it can't use, with a reason", () => {
    assert.match(convertQbpRow({ ...base, opt_d: "" }).reason, /Needs 4 options/);
    assert.match(convertQbpRow({ ...base, correct_option: "" }).reason, /Correct option is missing/);
    assert.match(convertQbpRow({ ...base, topic: "" }).reason, /Topic is empty/);
});

test("normText ignores QBP notes and spacing", () => {
    assert.equal(normText("  The  domain\n of f [QBP_SRC:x] "), "The domain of f");
});
