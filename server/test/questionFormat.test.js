const test = require("node:test");
const assert = require("node:assert");
const { formatOf, FORMATS } = require("../utils/questionFormat");

test("all Question Bank Portal types are known", () => {
    for (const f of ["single_correct", "assertion_reason", "statement_based", "match_following", "diagram_based", "true_false", "numerical", "multi_correct"]) assert.ok(FORMATS.includes(f), f);
});

test("formatOf works out each type", () => {
    const mcq = (extra) => ({ type: "mcq_single", text: "Q", options: ["A", "B", "C", "D"].map((id) => ({ id, text: id })), ...extra });
    assert.equal(formatOf(mcq()), "single_correct");
    assert.equal(formatOf({ type: "numerical" }), "numerical");
    assert.equal(formatOf(mcq({ options: [{ id: "A", text: "True" }, { id: "B", text: "False" }] })), "true_false");
    assert.equal(formatOf(mcq({ tags: ["true_false"] })), "true_false");
    assert.equal(formatOf(mcq({ text: "Assertion (A): x\n\nReason (R): y" })), "assertion_reason");
    assert.equal(formatOf(mcq({ text: "Match List I with List II" })), "match_following");
    assert.equal(formatOf(mcq({ text: "Statement I: x Statement II: y" })), "statement_based");
    assert.equal(formatOf(mcq({ images: [{ url: "x.png" }] })), "diagram_based");
    assert.equal(formatOf(mcq({ text: "Look {{IMG::abc}}" })), "diagram_based");
    assert.equal(formatOf(mcq({ tags: ["diagram_based"] })), "diagram_based");
    assert.equal(formatOf({ type: "mcq_multi", text: "Q" }), "multi_correct");
});
