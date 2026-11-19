// Reads question rows straight from a Supabase Postgres database using its
// connection string (SUPABASE_N_DB_URL). Used by utils/supabaseSync.js.

let pg = null;
const getPg = () => {
    if (!pg) pg = require("pg");
    return pg;
};

// One small pool per database, reused across requests on the same Vercel instance
const pools = global._genprepPgPools || (global._genprepPgPools = new Map());

// pg lets "sslmode" in the connection string override the ssl option below,
// so remove it and set SSL ourselves.
const cleanConnectionString = (dbUrl) => {
    const url = new URL(dbUrl);
    for (const p of ["sslmode", "sslcert", "sslkey", "sslrootcert", "uselibpqcompat"]) url.searchParams.delete(p);
    return url.toString();
};

const getPool = (source) => {
    let pool = pools.get(source.name);
    if (pool && pool._genprepUrl === source.dbUrl) return pool;

    const { Pool } = getPg();
    pool = new Pool({
        connectionString: cleanConnectionString(source.dbUrl),
        // Supabase signs its certificates with its own CA. Paste it into SUPABASE_N_CA_CERT
        // (Database Settings → SSL Configuration → Download certificate) to verify it.
        ssl: source.caCert ? { ca: source.caCert, rejectUnauthorized: true } : { rejectUnauthorized: false },
        max: 2,
        idleTimeoutMillis: 10000,
        connectionTimeoutMillis: 10000,
        statement_timeout: 20000,
        query_timeout: 25000,
        application_name: "genprep-sync",
    });
    pool.on("error", (err) => console.error(`Postgres pool (${source.name}) error:`, err.message));
    pool._genprepUrl = source.dbUrl;
    pools.set(source.name, pool);
    return pool;
};

// Names are already checked against /^[A-Za-z0-9_]+$/ in config/supabaseSources.js
const ident = (name) => `"${name}"`;
const tableName = (source) => `${ident(source.schema)}.${ident(source.table)}`;

const run = async (source, sql, params = []) => {
    try {
        const res = await getPool(source).query(sql, params);
        return res.rows;
    } catch (err) {
        const e = new Error(`Postgres (${source.name}): ${err.message}`);
        e.code = err.code; // e.g. 42703 = column does not exist, 42P01 = table does not exist
        throw e;
    }
};

// One page of rows after the cursor, ordered by (updated_at, id) or by id.
// updated_at is also returned as text in __genprep_ts, because JavaScript dates
// drop the microseconds Postgres stores and the cursor needs the exact value.
const pageSql = (source, { mode, cursor, limit }) => {
    const t = tableName(source);
    const params = [];
    if (mode === "updated") {
        const col = ident(source.updatedColumn);
        let where = `${col} is not null`;
        if (cursor && cursor.updatedAt) {
            params.push(cursor.updatedAt);
            if (cursor.id !== undefined && cursor.id !== null && cursor.id !== "") {
                params.push(cursor.id);
                where += ` and (${col} > $1 or (${col} = $1 and "id" > $2))`;
            } else {
                where += ` and ${col} >= $1`;
            }
        }
        params.push(limit);
        return {
            sql: `select *, ${col}::text as "__genprep_ts" from ${t} where ${where} order by ${col} asc, "id" asc limit $${params.length}`,
            params,
        };
    }
    let where = "";
    if (cursor && cursor.id !== undefined && cursor.id !== null && cursor.id !== "") {
        params.push(cursor.id);
        where = ` where "id" > $1`;
    }
    params.push(limit);
    return { sql: `select * from ${t}${where} order by "id" asc limit $${params.length}`, params };
};

const idsSql = (source, { afterId, limit }) => {
    const params = [];
    let where = "";
    if (afterId !== undefined && afterId !== null && afterId !== "") {
        params.push(afterId);
        where = ` where "id" > $1`;
    }
    params.push(limit);
    return { sql: `select "id" from ${tableName(source)}${where} order by "id" asc limit $${params.length}`, params };
};

const makePgReader = (source) => ({
    page: (opts) => {
        const { sql, params } = pageSql(source, opts);
        return run(source, sql, params);
    },
    ids: (opts) => {
        const { sql, params } = idsSql(source, opts);
        return run(source, sql, params);
    },
    hasBlankUpdated: async () => {
        const rows = await run(source, `select 1 from ${tableName(source)} where ${ident(source.updatedColumn)} is null limit 1`);
        return rows.length > 0;
    },
});

module.exports = { makePgReader, pageSql, idsSql, cleanConnectionString };
