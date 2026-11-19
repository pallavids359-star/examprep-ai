// Run with:  npm test   (from the server folder)
const test = require("node:test");
const assert = require("node:assert");
const { pageSql, idsSql, cleanConnectionString } = require("../utils/pgReader");
const { getSources } = require("../config/supabaseSources");

const src = { schema: "public", table: "questions", updatedColumn: "updated_at" };

test("first page and keyset page SQL", () => {
    const first = pageSql(src, { mode: "updated", cursor: null, limit: 500 });
    assert.match(first.sql, /from "public"\."questions" where "updated_at" is not null order by "updated_at" asc, "id" asc limit \$1$/);
    assert.match(first.sql, /"updated_at"::text as "__genprep_ts"/);
    assert.deepEqual(first.params, [500]);

    const next = pageSql(src, { mode: "updated", cursor: { updatedAt: "2026-11-19 10:00:00.123456+00", id: "42" }, limit: 500 });
    assert.match(next.sql, /\("updated_at" > \$1 or \("updated_at" = \$1 and "id" > \$2\)\)/);
    assert.deepEqual(next.params, ["2026-11-19 10:00:00.123456+00", "42", 500]);

    const byId = pageSql(src, { mode: "id", cursor: { id: "9" }, limit: 10 });
    assert.equal(byId.sql, 'select * from "public"."questions" where "id" > $1 order by "id" asc limit $2');

    const ids = idsSql(src, { afterId: null, limit: 1000 });
    assert.equal(ids.sql, 'select "id" from "public"."questions" order by "id" asc limit $1');
});

test("sslmode is removed so our SSL settings apply", () => {
    const out = cleanConnectionString("postgresql://postgres.ab:p%40ss@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require");
    assert.ok(!out.includes("sslmode"));
    assert.ok(out.includes("p%40ss@"));
});

test("reads connection strings from env without exposing passwords", () => {
    const keep = { ...process.env };
    for (const k of Object.keys(process.env)) if (k.startsWith("SUPABASE_")) delete process.env[k];
    process.env.SUPABASE_1_DB_URL = "postgresql://postgres.ab:secret@aws-0-ap-south-1.pooler.supabase.com:6543/postgres";
    process.env.SUPABASE_1_NAME = "Physics";
    process.env.SUPABASE_2_DB_URL = "mysql://nope";
    process.env.SUPABASE_3_URL = "https://x.supabase.co";
    const { sources, problems } = getSources();
    process.env = keep;

    assert.equal(sources.length, 1);
    assert.equal(sources[0].kind, "postgres");
    assert.equal(sources[0].name, "physics");
    assert.equal(sources[0].host, "aws-0-ap-south-1.pooler.supabase.com:6543/postgres");
    assert.equal(problems.length, 2);
});
