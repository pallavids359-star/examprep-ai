import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { getErrorMessage } from "../api/axios";
import { fmtDateTime, fmtDuration } from "./liveHelpers";

const KINDS = [
  ["all", "All"],
  ["live", "Live tests"],
  ["mock", "Mock tests"],
  ["practice", "Practice"],
];

// Admin: every test and practice a student took, each with a View button
export default function StudentAttempts({ studentId }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [kind, setKind] = useState("all");

  useEffect(() => {
    api
      .get(`/admin/students/${studentId}/attempts`)
      .then((res) => setRows(res.data.attempts))
      .catch((err) => setError(getErrorMessage(err)));
  }, [studentId]);

  const shown = (rows || []).filter((r) => kind === "all" || (kind === "practice" ? !["live", "mock"].includes(r.mode) : r.mode === kind));

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Tests taken</h2>
          <p className="text-sm text-slate-500">Open any test to see every question: what the student answered, and what was right or wrong.</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {KINDS.map(([k, l]) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${kind === k ? "bg-slate-900 text-amber-200" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:ring-amber-300"}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {!rows && !error && <div className="gp-card mt-4 h-32 animate-pulse bg-white/60" />}
      {rows && shown.length === 0 && <p className="gp-card mt-4 p-8 text-center text-sm text-slate-500">Nothing here yet.</p>}

      <div className="mt-4 space-y-3">
        {shown.map((r) => {
          const done = r.status === "submitted" || r.status === "auto_submitted";
          const total = r.questions || r.correct + r.wrong + r.unanswered;
          return (
            <div key={r.attemptId} className="gp-card flex flex-wrap items-center gap-5 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${r.mode === "live" ? "bg-slate-900 text-amber-200" : r.mode === "mock" ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-700"}`}>{r.modeLabel}</span>
                  <span className="text-xs font-semibold text-slate-500">{r.exam}</span>
                  {!done && <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700">In progress</span>}
                </div>
                <p className="mt-1 truncate font-bold text-slate-900">{r.title}</p>
                <p className="text-xs text-slate-500">
                  {fmtDateTime(r.startedAt)}
                  {done && r.timeTakenSec ? ` · ${fmtDuration(r.timeTakenSec)}` : ""}
                </p>
              </div>

              {done && (
                <div className="flex items-center gap-5 text-center">
                  <div>
                    <p className="font-display text-xl font-extrabold tabular-nums text-green-700">{r.correct}</p>
                    <p className="text-[11px] text-slate-500">correct</p>
                  </div>
                  <div>
                    <p className="font-display text-xl font-extrabold tabular-nums text-orange-700">{r.wrong}</p>
                    <p className="text-[11px] text-slate-500">wrong</p>
                  </div>
                  <div>
                    <p className="font-display text-xl font-extrabold tabular-nums text-slate-500">{r.unanswered}</p>
                    <p className="text-[11px] text-slate-500">blank</p>
                  </div>
                  {r.score !== null && (
                    <div className="border-l border-slate-200 pl-5">
                      <p className="font-display text-xl font-extrabold tabular-nums text-slate-900">
                        {r.score}
                        <span className="text-sm text-slate-400">/{r.maxScore}</span>
                      </p>
                      <p className="text-[11px] text-slate-500">{r.percentage}% · {total} Qs</p>
                    </div>
                  )}
                  {r.rank && (
                    <div className="rounded-xl bg-amber-50 px-3 py-1.5 ring-1 ring-amber-200">
                      <p className="font-display text-xl font-extrabold text-amber-900">#{r.rank.rank}</p>
                      <p className="text-[11px] text-amber-800">of {r.rank.total}</p>
                    </div>
                  )}
                </div>
              )}

              <Link to={`/admin/attempts/${r.attemptId}`} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-amber-200 hover:bg-black">
                View →
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}
