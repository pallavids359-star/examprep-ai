import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api, { getErrorMessage } from "../../api/axios";
import AdminLayout from "../../components/AdminLayout";
import { PHASE, fmtDateTime, fmtDuration } from "../../components/liveHelpers";
import { ICONS, Stat } from "../../components/premium";

// Head lecturer: leaderboard of a live test
export default function LiveResults() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get(`/admin/live-tests/${id}/results`)
      .then((res) => setData(res.data))
      .catch((err) => setError(getErrorMessage(err)));
  }, [id]);

  const download = () => {
    const head = ["Rank", "Name", "Email", "Score", "Out of", "Percent", "Correct", "Wrong", "Unanswered", "Time (min)", "Submitted"];
    const lines = data.rows.map((r) =>
      [r.rank, r.student?.name || "", r.student?.email || "", r.score, r.maxScore, r.percentage, r.correct, r.incorrect, r.unanswered, Math.round(r.timeTakenSec / 60), new Date(r.submittedAt).toLocaleString("en-IN")]
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(",")
    );
    const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${data.test.title.replace(/[^\w]+/g, "-")}-results.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (error) {
    return (
      <AdminLayout title="Results">
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      </AdminLayout>
    );
  }
  if (!data) {
    return (
      <AdminLayout title="Results">
        <p className="text-sm text-slate-500">Loading...</p>
      </AdminLayout>
    );
  }
  const ph = PHASE[data.test.phase] || PHASE.draft;
  const top = data.rows.filter((r) => r.rank <= 3).slice(0, 3);
  // Podium order: 2nd, 1st, 3rd
  const podium = [top[1], top[0], top[2]];
  const MEDAL = {
    1: { ring: "from-amber-200 to-amber-500", h: "h-36", label: "1st", crown: "👑" },
    2: { ring: "from-slate-200 to-slate-400", h: "h-28", label: "2nd", crown: "" },
    3: { ring: "from-orange-200 to-orange-400", h: "h-24", label: "3rd", crown: "" },
  };
  const initials = (n = "") => n.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";

  return (
    <AdminLayout>
      <Link to={`/admin/live-tests/${id}`} className="text-sm font-semibold text-amber-800 hover:underline">
        ← Back to the test
      </Link>

      <section className="gp-hero mt-3 p-6 md:p-8">
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-200/80">Leaderboard</p>
            <h1 className="mt-2 text-2xl font-extrabold text-white md:text-3xl">{data.test.title}</h1>
            <p className="gp-muted mt-1 flex flex-wrap items-center gap-2 text-sm">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${ph.cls}`}>{ph.label}</span>
              {fmtDateTime(data.test.startsAt)} → {fmtDateTime(data.test.endsAt)}
            </p>
          </div>
          {data.rows.length > 0 && (
            <button type="button" onClick={download} className="rounded-xl px-4 py-2 text-sm font-semibold text-amber-100 ring-1 ring-amber-200/40 hover:bg-white/10">
              ⬇ Download Excel (CSV)
            </button>
          )}
        </div>

        {/* Podium */}
        {top.length > 0 && (
          <div className="relative mx-auto mt-8 grid max-w-2xl grid-cols-3 items-end gap-3 md:gap-5">
            {podium.map((r, i) =>
              r ? (
                <div key={r.attemptId} className="flex flex-col items-center text-center">
                  <span className="text-2xl leading-none">{MEDAL[r.rank]?.crown}</span>
                  <span className={`mt-1 grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br p-[3px] md:h-20 md:w-20 ${MEDAL[r.rank]?.ring}`}>
                    <span className="grid h-full w-full place-items-center rounded-full bg-slate-900 font-display text-lg font-extrabold text-amber-100 md:text-xl">{initials(r.student?.name)}</span>
                  </span>
                  <p className="mt-2 max-w-full truncate text-sm font-bold text-white">{r.student?.name || "Deleted account"}</p>
                  <p className="font-display text-lg font-extrabold">
                    <span className="gp-gold-text">{r.score}</span>
                    <span className="text-xs text-amber-100/60"> / {r.maxScore}</span>
                  </p>
                  <div className={`mt-2 flex w-full flex-col items-center justify-start rounded-t-2xl bg-gradient-to-b pt-3 ${MEDAL[r.rank]?.ring} ${MEDAL[r.rank]?.h}`}>
                    <span className="font-display text-3xl font-extrabold text-slate-900">{r.rank}</span>
                    <span className="text-[11px] font-bold uppercase tracking-widest text-slate-800/80">{MEDAL[r.rank]?.label}</span>
                  </div>
                </div>
              ) : (
                <div key={`empty-${i}`} />
              )
            )}
          </div>
        )}
      </section>

      <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Finished" value={data.stats.finished} sub="students" icon={ICONS.users} accent />
        <Stat label="Writing now" value={data.stats.inProgress} sub="in progress" icon={ICONS.clock} />
        <Stat label="Average" value={data.stats.average ?? "—"} sub={`out of ${data.test.totalMarks}`} icon={ICONS.target} />
        <Stat label="Highest" value={data.stats.highest ?? "—"} sub={`out of ${data.test.totalMarks}`} icon={ICONS.trophy} />
      </div>

      {data.rows.length === 0 ? (
        <p className="gp-card mt-6 p-10 text-center text-sm text-slate-500">No one has finished yet. The leaderboard fills in as students submit.</p>
      ) : (
        <section className="mt-6">
          <h2 className="text-xl font-extrabold text-slate-900">All students</h2>
          <div className="mt-3 space-y-2">
            {data.rows.map((r) => (
              <div key={r.attemptId} className={`gp-card flex flex-wrap items-center gap-4 p-4 ${r.rank <= 3 ? "ring-1 ring-amber-300" : ""}`}>
                <span
                  className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl font-display text-lg font-extrabold ${
                    r.rank === 1 ? "bg-gradient-to-br from-amber-200 to-amber-500 text-slate-900" : r.rank === 2 ? "bg-slate-200 text-slate-800" : r.rank === 3 ? "bg-orange-200 text-orange-900" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {r.rank}
                </span>
                <div className="min-w-0 flex-1">
                  {r.student ? (
                    <Link to={`/admin/students/${r.student._id}`} className="font-bold text-slate-900 hover:underline">
                      {r.student.name}
                    </Link>
                  ) : (
                    <span className="font-bold text-slate-500">Deleted account</span>
                  )}
                  <p className="truncate text-xs text-slate-500">
                    {r.student?.email} · {fmtDateTime(r.submittedAt)}
                    {r.autoSubmitted ? " · time ran out" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-5 text-center">
                  <div>
                    <p className="font-display text-lg font-extrabold tabular-nums text-green-700">{r.correct}</p>
                    <p className="text-[11px] text-slate-500">correct</p>
                  </div>
                  <div>
                    <p className="font-display text-lg font-extrabold tabular-nums text-orange-700">{r.incorrect}</p>
                    <p className="text-[11px] text-slate-500">wrong</p>
                  </div>
                  <div>
                    <p className="font-display text-lg font-extrabold tabular-nums text-slate-500">{r.unanswered}</p>
                    <p className="text-[11px] text-slate-500">blank</p>
                  </div>
                  <div className="hidden sm:block">
                    <p className="font-display text-lg font-extrabold tabular-nums text-slate-700">{fmtDuration(r.timeTakenSec)}</p>
                    <p className="text-[11px] text-slate-500">time</p>
                  </div>
                  <div className="border-l border-slate-200 pl-5">
                    <p className="font-display text-xl font-extrabold tabular-nums text-slate-900">
                      {r.score}
                      <span className="text-sm text-slate-400">/{r.maxScore}</span>
                    </p>
                    <p className="text-[11px] text-slate-500">{r.percentage}%</p>
                  </div>
                </div>
                <Link to={`/admin/attempts/${r.attemptId}`} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-amber-200 hover:bg-black">
                  View answers →
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}
    </AdminLayout>
  );
}
