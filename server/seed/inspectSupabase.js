// READ-ONLY: shows what is inside your Supabase databases (no changes are made).
// Put this file in C:\examprep-ai\server\seed\ and run:  node seed/inspectSupabase.js
require("dotenv").config();
const { Pool } = require("pg");

const short = (v) => {
    const s = v instanceof Date ? v.toISOString() : typeof v === "object" && v !== null ? JSON.stringify(v) : String(v);
    return s.length > 80 ? s.slice(0, 80) + "..." : s;
};

(async () => {
    for (let i = 1; i <= 20; i++) {
        const dbUrl = process.env[`SUPABASE_${i}_DB_URL`] || process.env[`SUPABASE_${i}_CONNECTION_STRING`];
        if (!dbUrl) continue;
        const url = new URL(dbUrl);
        url.searchParams.delete("sslmode");
        const name = process.env[`SUPABASE_${i}_NAME`] || `db${i}`;
        const table = process.env[`SUPABASE_${i}_TABLE`] || "questions";
        const pool = new Pool({ connectionString: url.toString(), ssl: { rejectUnauthorized: false }, max: 1 });

        console.log(`\n========== SUPABASE_${i} (${name}) ==========`);
        try {
            await pool.query("SET default_transaction_read_only = on").catch(() => {});
            const tables = await pool.query(
                `select table_schema, table_name from information_schema.tables
                 where table_schema not in ('pg_catalog','information_schema','auth','storage','realtime','supabase_functions','vault','extensions','graphql','graphql_public','pgsodium','net','cron')
                   and table_type = 'BASE TABLE' order by 1, 2`
            );
            console.log("Tables:");
            for (const t of tables.rows) {
                const c = await pool.query(`select count(*)::int as n from "${t.table_schema}"."${t.table_name}"`);
                console.log(`  ${t.table_schema}.${t.table_name}  (${c.rows[0].n} rows)`);
            }

            const exists = tables.rows.some((t) => t.table_schema === "public" && t.table_name === table);
            if (!exists) {
                console.log(`\n!! No table public.${table}. Set SUPABASE_${i}_TABLE to the right name from the list above.`);
                continue;
            }
            const sample = await pool.query(`select * from public."${table}" limit 1`);
            console.log(`\nColumns and first row of public.${table}:`);
            const row = sample.rows[0] || {};
            for (const f of sample.fields) console.log(`  ${f.name.padEnd(24)} = ${row[f.name] === undefined ? "" : short(row[f.name])}`);
        } catch (e) {
            console.log("ERROR:", e.message);
        } finally {
            await pool.end();
        }
    }
})();
