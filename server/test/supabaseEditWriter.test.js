// Run with:  npm test   (from the server folder)
const test = require("node:test");
const assert = require("node:assert");
const { buildPatch } = require("../utils/supabaseEditWriter");
const { convertQbpRow } = require("../utils/qbpFormat");

const row = {
    id: "000a5e74-5c73-4892-97d2-e1c31258bbf0", subject: "Physics", klass: "11", chapter: "Laws of Motion", topic: "Newton", exams: ["NEET"],
    q_type: "mcq_single", question: "A 2 kg block is pulled by 10 N. Acceleration? [QBP_SRC:x]",
    opt_a: "2", opt_b: "5", opt_c: "10", opt_d: "20", assertion: "", reason: "", correct_option: "C", num_answer: "",
    solution_text: "a = F/m\n[QBP_DIFFICULTY:Medium]", review_status: "accepted",
};
const asGenPrep = (r) => convertQbpRow(r).data;

test("nothing changed -> nothing sent", () => {
    const r = buildPatch(row, asGenPrep(row));
    assert.deepEqual(r.sent, []);
    assert.deepEqual(r.patch, {});
});

test("fixed answer key and solution; markers and tags kept", () => {
    const q = asGenPrep(row);
    q.correctOptionIds = ["B"];
    q.explanation.text = "a = F/m = 10/2 = 5";
    const r = buildPatch(row, q);
    assert.deepEqual(r.sent, ["correct answer", "solution"]);
    assert.equal(r.patch.correct_option, "B");
    assert.equal(r.patch.solution_text, "a = F/m = 10/2 = 5\n[QBP_DIFFICULTY:Medium]");
    assert.equal(r.difficulty, null);
});

test("text and options keep the portal's tags", () => {
    const q = asGenPrep(row);
    q.text = "A 2 kg block is pulled by 10 N on a smooth floor. Acceleration?";
    q.options[3].text = "40";
    const r = buildPatch(row, q);
    assert.equal(r.patch.question, "A 2 kg block is pulled by 10 N on a smooth floor. Acceleration? [QBP_SRC:x]");
    assert.equal(r.patch.opt_d, "40");
    assert.equal(r.patch.opt_a, "2");
});

test("difficulty goes through the workflow with the new marker", () => {
    const q = asGenPrep(row);
    q.difficulty = "hard";
    q.explanation.text = "new solution";
    const r = buildPatch(row, q);
    assert.equal(r.difficulty.value, "Hard");
    assert.equal(r.difficulty.solution, "new solution\n[QBP_DIFFICULTY:Hard]");
    assert.equal(r.patch.solution_text, undefined);
});

test("numerical answer and assertion-reason", () => {
    const num = { ...row, q_type: "numerical", opt_a: "", opt_b: "", opt_c: "", opt_d: "", correct_option: "5", num_answer: "5" };
    const q = asGenPrep(num);
    q.numericalAnswer = { value: 4.5, tolerance: 0.5 };
    assert.equal(buildPatch(num, q).patch.num_answer, "4 to 5");

    const ar = { ...row, q_type: "assertion_reason", question: "", assertion: "Sky is blue", reason: "Rayleigh scattering", opt_a: "", opt_b: "", opt_c: "", opt_d: "", correct_option: "A" };
    const qa = asGenPrep(ar);
    qa.text = qa.text.replace("Rayleigh scattering", "Scattering of light");
    const r = buildPatch(ar, qa);
    assert.equal(r.patch.reason, "Scattering of light");
    assert.equal(r.patch.assertion, "Sky is blue");
});

test("match question text is not sent", () => {
    const m = { ...row, q_type: "match", column_a: ["x", "y"], column_b: ["1", "2"] };
    const q = asGenPrep(m);
    q.text = q.text + " edited";
    const r = buildPatch(m, q);
    assert.equal(r.patch.question, undefined);
    assert.ok(r.notSent[0].startsWith("question text"));
});
