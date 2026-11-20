import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { getErrorMessage } from "../api/axios";

const KINDS = [
  ["all", "All"],
  ["live", "Live"],
  ["mock", "Mock"],
  ["practice", "Practice"],
];
const day = (d) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

// Admin: every test a student took — one clean row each, with View
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-slate-900">Tests taken</h2>
        <div className="flex rounded-lg bg-white p-0.5 ring-1 ring-slate-200">
          {KINDS.map(([k, l]) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`rounded-md px-3 py-1 text-sm font-medium ${kind === k ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="mt-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs font-medium text-slate-500">
              <th className="px-4 py-2.5 font-medium">Test</th>
              <th className="px-4 py-2.5 font-medium">Score</th>
              <th className="px-4 py-2.5 font-medium">Correct</th>
              <th className="px-4 py-2.5 font-medium">Wrong</th>
              <th className="px-4 py-2.5 font-medium">Rank</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {!rows && !error && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  Loading...
                </td>
              </tr>
            )}
            {rows && shown.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  No tests yet.
                </td>
              </tr>
            )}
            {shown.map((r) => {
              const done = r.status === "submitted" || r.status === "auto_submitted";
              return (
                <tr key={r.attemptId} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{r.title}</p>
                    <p className="text-xs text-slate-500">
                      {r.modeLabel} · {r.exam} · {day(r.startedAt)}
                      {!done && " · in progress"}
                    </p>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-900">{done && r.score !== null ? `${r.score} / ${r.maxScore}` : "—"}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-700">{done ? r.correct : "—"}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-700">{done ? r.wrong : "—"}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-700">{r.rank ? `${r.rank.rank} of ${r.rank.total}` : "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/admin/attempts/${r.attemptId}`} className="font-medium text-amber-800 hover:underline">
                      View
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
