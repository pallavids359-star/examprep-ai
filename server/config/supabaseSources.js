// Reads the Supabase question databases from environment variables.
//
// For each database N (1, 2, 3 ... up to 20) set ONE of:
//
//   A) Postgres connection string (recommended)
//      SUPABASE_N_DB_URL   postgresql://postgres.abcd:PASSWORD@aws-0-ap-south-1.pooler.supabase.com:6543/postgres
//                          Use the "Transaction pooler" string from Supabase → Connect.
//      SUPABASE_N_CA_CERT  optional: Supabase's SSL certificate (PEM text) to verify the server
//
//   B) REST API
//      SUPABASE_N_URL      https://abcd1234.supabase.co
//      SUPABASE_N_KEY      the project's service_role key
//
// Optional for both:
//   SUPABASE_N_NAME     short label, e.g. physics                (default dbN)
//   SUPABASE_N_TABLE    table that holds the questions           (default questions)
//   SUPABASE_N_SCHEMA   schema of that table                     (default public; connection string only)
//   SUPABASE_N_UPDATED_COLUMN  column changed on every edit      (default updated_at; "none" if absent)
//
// SUPABASE_DEFAULT_STATUS  status for rows without a status column (default published)

const MAX_SOURCES = 20;
const NAME_RE = /^[A-Za-z0-9_]+$/;

const env = (k) => (process.env[k] || "").trim();

// "postgresql://user:pass@host:6543/db" -> "host:6543/db" (never show the password)
const describeDbUrl = (dbUrl) => {
    try {
        const u = new URL(dbUrl);
        return `${u.hostname}${u.port ? `:${u.port}` : ""}${u.pathname}`;
    } catch {
        return "postgres";
    }
};

const getSources = () => {
    const sources = [];
    const problems = [];
    const seen = new Set();

    for (let i = 1; i <= MAX_SOURCES; i++) {
        const dbUrl = env(`SUPABASE_${i}_DB_URL`) || env(`SUPABASE_${i}_CONNECTION_STRING`);
        const url = env(`SUPABASE_${i}_URL`).replace(/\/+$/, "");
        const key = env(`SUPABASE_${i}_KEY`);
        if (!dbUrl && !url && !key) continue;

        let kind;
        if (dbUrl) {
            if (!/^postgres(ql)?:\/\//i.test(dbUrl)) {
                problems.push(`SUPABASE_${i}_DB_URL should start with postgresql://`);
                continue;
            }
            try {
                new URL(dbUrl);
            } catch {
                problems.push(`SUPABASE_${i}_DB_URL is not a valid connection string. If the password has @ # / ? or %, URL-encode it (e.g. @ → %40).`);
                continue;
            }
            kind = "postgres";
            // Direct connections are IPv6-only on Supabase; Vercel can only reach IPv4
            if (process.env.VERCEL && /^db\.[^.]+\.supabase\.co$/i.test(new URL(dbUrl).hostname)) {
                problems.push(
                    `SUPABASE_${i}_DB_URL is the "Direct connection" string, which Vercel can't reach (IPv6 only). Use the "Transaction pooler" string from Supabase → Connect.`
                );
            }
        } else {
            if (!url || !key) {
                problems.push(`SUPABASE_${i}: set SUPABASE_${i}_DB_URL, or both SUPABASE_${i}_URL and SUPABASE_${i}_KEY`);
                continue;
            }
            if (!/^https:\/\/[^/]+$/.test(url)) {
                problems.push(`SUPABASE_${i}_URL should look like https://xxxx.supabase.co`);
                continue;
            }
            kind = "rest";
        }

        const name = (env(`SUPABASE_${i}_NAME`) || `db${i}`).toLowerCase();
        if (!/^[a-z0-9_-]{1,40}$/.test(name)) {
            problems.push(`SUPABASE_${i}_NAME may only use letters, numbers, - and _`);
            continue;
        }
        if (seen.has(name)) {
            problems.push(`SUPABASE_${i}_NAME "${name}" is used twice`);
            continue;
        }

        const table = env(`SUPABASE_${i}_TABLE`) || "questions";
        const schema = env(`SUPABASE_${i}_SCHEMA`) || "public";
        if (!NAME_RE.test(table) || !NAME_RE.test(schema)) {
            problems.push(`SUPABASE_${i}_TABLE and SUPABASE_${i}_SCHEMA may only use letters, numbers and _`);
            continue;
        }

        const rawUpdated = (process.env[`SUPABASE_${i}_UPDATED_COLUMN`] ?? "updated_at").trim();
        const updatedColumn = !rawUpdated || rawUpdated.toLowerCase() === "none" ? null : rawUpdated;
        if (updatedColumn && !NAME_RE.test(updatedColumn)) {
            problems.push(`SUPABASE_${i}_UPDATED_COLUMN may only use letters, numbers and _`);
            continue;
        }

        seen.add(name);
        sources.push({
            index: i,
            kind,
            name,
            table,
            schema,
            updatedColumn,
            dbUrl: dbUrl || null,
            caCert: env(`SUPABASE_${i}_CA_CERT`).replace(/\\n/g, "\n") || null,
            url: url || null,
            key: key || null,
            host: kind === "postgres" ? describeDbUrl(dbUrl) : url.replace("https://", ""),
        });
    }

    const status = env("SUPABASE_DEFAULT_STATUS").toLowerCase() || "published";
    const defaultStatus = ["draft", "published"].includes(status) ? status : "published";

    return { sources, problems, defaultStatus };
};

module.exports = { getSources, describeDbUrl };
