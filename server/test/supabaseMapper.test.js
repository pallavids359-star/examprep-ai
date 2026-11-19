// Run with:  node --test server/test/*.test.js
const test = require("node:test");
const assert = require("node:assert");
const { mapRow, buildPageQuery, buildIdQuery } = require("../utils/supabaseMapper");

const TOPIC = "64b7f0c2a1b2c3d4e5f60718";

test("maps a row in GenPrep's own shape", () => {
    const r = mapRow({
        id: 7,
        topicId: TOPIC,
        type: "mcq_single",
        text: " SI unit of luminous intensity ",
        options: [{ id: "A", text: "lumen" }, { id: "B", text: "candela" }, { id: "C", text: "lux" }, { id: "D", text: "watt" }],
        correctOptionIds: ["B"],
        difficulty: "easy",
        explanation: { text: "Candela is a base unit." },
        tags: ["units"],
    });
    assert.equal(r.ok, true);
    assert.equal(r.id, "7");
    assert.equal(r.topicId, TOPIC);
    assert.equal(r.data.text, "SI unit of luminous intensity");
    assert.deepEqual(r.data.correctOptionIds, ["B"]);
    assert.equal(r.data.options[1].text, "candela");
    assert.equal(r.data.status, "published");
    assert.equal(r.data.explanation.text, "Candela is a base unit.");
});

test("maps snake_case columns, option_a..d and 'A,C' answers", () => {
    const r = mapRow({
        id: "uuid-1",
        topic_id: TOPIC,
        question_type: "multi",
        question_text: "Pick two",
        option_a: "1",
        option_b: "2",
        option_c: "3",
        option_d: "4",
        correct_answer: "a, c",
        status: "draft",
        tags: "x, y",
        marks_correct: 4,
        marks_incorrect: -2,
        source_kind: "PYQ",
        source_year: "2023",
    });
    assert.equal(r.ok, true);
    assert.equal(r.data.type, "mcq_multi");
    assert.deepEqual(r.data.options.map((o) => o.id), ["A", "B", "C", "D"]);
    assert.deepEqual(r.data.correctOptionIds, ["A", "C"]);
    assert.equal(r.data.status, "draft");
    assert.deepEqual(r.data.tags, ["x", "y"]);
    assert.deepEqual(r.data.marks, { correct: 4, incorrect: -2 });
    assert.deepEqual(r.data.source, { kind: "pyq", year: 2023 });
});

test("options stored as JSON text and as a plain list", () => {
    const a = mapRow({ id: 1, topic_id: TOPIC, text: "q", options: '["w","x","y","z"]', correct_option_ids: '["D"]' });
    assert.deepEqual(a.data.options.map((o) => o.text), ["w", "x", "y", "z"]);
    assert.deepEqual(a.data.correctOptionIds, ["D"]);
    const b = mapRow({ id: 2, topic_id: TOPIC, text: "q", options: { A: "1", B: "2", C: "3", D: "4" }, answer: 3 });
    assert.deepEqual(b.data.correctOptionIds, ["C"]);
});

test("numerical questions", () => {
    const r = mapRow({ id: 3, topic_id: TOPIC, type: "integer", text: "g?", numerical_answer: 9.8, tolerance: 0.1 });
    assert.equal(r.data.type, "numerical");
    assert.deepEqual(r.data.numericalAnswer, { value: 9.8, tolerance: 0.1 });
    assert.deepEqual(r.data.options, []);
});

test("deleted flags become archived", () => {
    assert.equal(mapRow({ id: 1, topic_id: TOPIC, text: "q", is_deleted: true }).data.status, "archived");
    assert.equal(mapRow({ id: 1, topic_id: TOPIC, text: "q", deleted_at: "2026-01-01" }).data.status, "archived");
    assert.equal(mapRow({ id: 1, topic_id: TOPIC, text: "q" }, { defaultStatus: "draft" }).data.status, "draft");
});

test("rejects rows it cannot use, with a reason", () => {
    assert.match(mapRow({ topic_id: TOPIC, text: "q" }).reason, /no id/);
    assert.match(mapRow({ id: 1, topic_id: "physics", text: "q" }).reason, /topic_id/);
    assert.match(mapRow({ id: 1, topic_id: TOPIC, text: "  " }).reason, /empty/);
    assert.match(mapRow({ id: 1, topic_id: TOPIC, text: "q", type: "essay" }).reason, /Unknown question type/);
});

test("page query: first page, then keyset after the cursor", () => {
    const first = new URLSearchParams(buildPageQuery({ mode: "updated", updatedColumn: "updated_at", cursor: null, limit: 500 }));
    assert.equal(first.get("order"), "updated_at.asc,id.asc");
    assert.equal(first.get("updated_at"), "not.is.null");
    assert.equal(first.get("or"), null);

    const t = "2026-11-19T10:00:00.123456+00:00";
    const qs = buildPageQuery({ mode: "updated", updatedColumn: "updated_at", cursor: { updatedAt: t, id: "42" }, limit: 500 });
    assert.ok(qs.includes("%2B00%3A00"), "the + in the timestamp must be URL-encoded");
    const next = new URLSearchParams(qs);
    assert.equal(next.get("or"), `(updated_at.gt."${t}",and(updated_at.eq."${t}",id.gt."42"))`);

    const byId = new URLSearchParams(buildPageQuery({ mode: "id", cursor: { id: "9" }, limit: 10 }));
    assert.equal(byId.get("order"), "id.asc");
    assert.equal(byId.get("id"), "gt.9");

    const ids = new URLSearchParams(buildIdQuery({ afterId: 5, limit: 1000 }));
    assert.equal(ids.get("select"), "id");
    assert.equal(ids.get("id"), "gt.5");
});
