import { useCallback, useEffect, useState } from "react";
import api, { getErrorMessage } from "../api/axios";
import { toast } from "./Toaster";

// Admin overview: the Supabase question databases and how their sync is going
const fmt = (n) => Number(n || 0).toLocaleString("en-IN");

const ago = (date) => {
  if (!date) return "never";
  const s = Math.round((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(date).toLocaleString("en-IN");
};

const MAX_ROUNDS = 30; // each round is one server call of up to ~45 seconds

export default function SupabaseSyncPanel() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");
  const [running, setRunning] = useState("");
  const [open, setOpen] = useState(null);

  const load = useCallback(() => {
    api
      .get("/admin/sync/status")
      .then((res) => {
        setStatus(res.data);
        setError("");
      })
      .catch((err) => setError(getErrorMessage(err)));
  }, []);

  useEffect(load, [load]);

  // A first import can be bigger than one server call, so keep going until every database is caught up
  const run = async (full) => {
    if (full && !window.confirm("Re-read every row from all Supabase databases and archive questions deleted there?")) return;
    setRunning(full ? "full" : "sync");
    const totals = { upserted: 0, skipped: 0, archived: 0 };
    try {
      for (let round = 0; round < MAX_ROUNDS; round++) {
        const { data } = await api.post("/admin/sync/supabase", { full: full && round === 0 });
        data.results.forEach((r) => {
          totals.upserted += r.upserted || 0;
          totals.skipped += r.skipped || 0;
          totals.archived += r.archived || 0;
        });
        load();
        const failed = data.results.filter((r) => r.error);
        if (data.done || (failed.length && failed.length === data.results.length)) break;
      }
      toast(`Synced: ${fmt(totals.upserted)} saved, ${fmt(totals.archived)} archived, ${fmt(totals.skipped)} skipped`);
    } catch (err) {
      toast(getErrorMessage(err), "error");
    } finally {
      setRunning("");
      load();
    }
  };

  if (error) {
    return <div className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">Supabase sync: {error}</div>;
  }
  if (!status) return null;

  const none = status.sources.length === 0;

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Supabase question databases</h2>
          <p className="text-sm text-slate-500">
            New questions from the Question Bank Portal come in with "Sync now" (and every night). Questions you edit or publish
            here are kept, and the change is sent back to the Question Bank Portal.
          </p>
        </div>
        {!none && (
          <div className="flex gap-2">
            <button
              onClick={() => run(false)}
              disabled={Boolean(running)}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {running === "sync" ? "Syncing..." : "Sync now"}
            </button>
            <button
              onClick={() => run(true)}
              disabled={Boolean(running)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-indigo-400 disabled:opacity-60"
            >
              {running === "full" ? "Resyncing..." : "Full resync"}
            </button>
          </div>
        )}
      </div>

      {status.problems.length > 0 && (
        <ul className="mt-3 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {status.problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      {!none && !status.webhookSecretSet && (
        <p className="mt-3 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          SUPABASE_WEBHOOK_SECRET is not set, so instant updates are off. Only "Sync now" and the daily check will run.
        </p>
      )}

      {none ? (
        <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">
          No Supabase databases are connected yet. Add SUPABASE_1_DB_URL (the connection string) and so on up to SUPABASE_8_DB_URL to the server's
          environment variables. See SUPABASE_SYNC.md in the repo.
        </p>
      ) : (
        <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {status.sources.map((s) => {
            const q = s.questions || {};
            const health = s.lastError ? "bg-red-500" : s.caughtUp ? "bg-emerald-500" : "bg-amber-400";
            return (
              <div key={s.name} className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 font-semibold text-slate-900">
                    <span className={`h-2.5 w-2.5 rounded-full ${health}`} />
                    {s.name}
                  </h3>
                  <span className="text-2xl font-bold tabular-nums text-indigo-600">{fmt(q.published)}</span>
                </div>
                <p className="truncate text-xs text-slate-500" title={`${s.host} · ${s.table}`}>
                  {s.host} · {s.table}{s.connection === "postgres" ? " · Postgres" : " · REST"}
                </p>
                <dl className="mt-3 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Drafts / archived</dt>
                    <dd className="tabular-nums text-slate-800">
                      {fmt(q.draft)} / {fmt(q.archived)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Last sync</dt>
                    <dd className="text-slate-800">{ago(s.lastSuccessAt)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Last webhook</dt>
                    <dd className="text-slate-800">{ago(s.lastWebhookAt)}</dd>
                  </div>
                </dl>
                {s.lastError && <p className="mt-3 rounded bg-red-50 px-2 py-1 text-xs text-red-700">{s.lastError}</p>}
                {s.warning && <p className="mt-3 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">{s.warning}</p>}
                {s.recentSkipped.length > 0 && (
                  <div className="mt-3">
                    <button
                      onClick={() => setOpen(open === s.name ? null : s.name)}
                      className="text-xs font-medium text-indigo-700 hover:underline"
                    >
                      {open === s.name ? "Hide" : "Show"} rows that could not be imported
                    </button>
                    {open === s.name && (
                      <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-xs text-slate-600">
                        {s.recentSkipped.map((r, i) => (
                          <li key={`${r.id}-${i}`}>
                            <span className="font-mono text-slate-800">#{r.id}</span> {r.reason}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
