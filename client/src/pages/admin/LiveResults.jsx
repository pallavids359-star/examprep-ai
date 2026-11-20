import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api, { getErrorMessage } from "../../api/axios";
import AdminLayout from "../../components/AdminLayout";
import { PHASE, fmtDuration } from "../../components/liveHelpers";

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
  const top = data.rows.slice(0, 3);
  const MEDAL = ["🥇", "🥈", "🥉"];

  return (
    <AdminLayout>
      <Link to={`/admin/live-tests/${id}`} className="text-sm text-slate-500 hover:text-slate-900">
        ← {data.test.title}
      </Link>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Leaderboard</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${ph.cls}`}>{ph.label}</span>
            {data.stats.finished} finished
            {data.stats.inProgress ? ` · ${data.stats.inProgress} writing now` : ""}
            {data.stats.average !== null ? ` · average ${data.stats.average} / ${data.test.totalMarks}` : ""}
          </p>
        </div>
        {data.rows.length > 0 && (
          <button type="button" onClick={download} className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Download CSV
          </button>
        )}
      </div>

      {data.rows.length === 0 ? (
        <p className="py-16 text-center text-sm text-slate-400">No one has finished yet. Ranks appear here as students submit.</p>
      ) : (
        <>
          {/* Top 3 */}
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {top.map((r, i) => (
              <div key={r.attemptId} className={`rounded-xl border bg-white p-5 ${i === 0 ? "border-amber-300 shadow-sm" : "border-slate-200"}`}>
                <div className="flex items-center justify-between">
                  <span className="text-2xl">{MEDAL[r.rank - 1] || ""}</span>
                  <span className="text-xs font-medium text-slate-400">Rank {r.rank}</span>
                </div>
                <p className="mt-3 truncate text-base font-semibold text-slate-900">{r.student?.name || "Deleted account"}</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                  {r.score}
                  <span className="ml-1 text-sm font-normal text-slate-400">/ {r.maxScore}</span>
                </p>
                <Link to={`/admin/attempts/${r.attemptId}`} className="mt-3 inline-block text-sm font-medium text-amber-800 hover:underline">
                  View answers
                </Link>
              </div>
            ))}
          </div>

          {/* Everyone */}
          <h2 className="mt-10 text-lg font-bold text-slate-900">All ranks</h2>
          <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="w-16 px-4 py-2.5 font-medium">Rank</th>
                  <th className="px-4 py-2.5 font-medium">Student</th>
                  <th className="px-4 py-2.5 font-medium">Score</th>
                  <th className="px-4 py-2.5 font-medium">Correct</th>
                  <th className="px-4 py-2.5 font-medium">Wrong</th>
                  <th className="px-4 py-2.5 font-medium">Blank</th>
                  <th className="px-4 py-2.5 font-medium">Time</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.attemptId} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-semibold tabular-nums text-slate-900">
                      {r.rank <= 3 ? `${MEDAL[r.rank - 1]} ` : ""}
                      {r.rank}
                    </td>
                    <td className="px-4 py-3">
                      {r.student ? (
                        <Link to={`/admin/students/${r.student._id}`} className="font-medium text-slate-900 hover:underline">
                          {r.student.name}
                        </Link>
                      ) : (
                        <span className="text-slate-400">Deleted account</span>
                      )}
                      <p className="text-xs text-slate-500">{r.student?.email}</p>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-900">
                      {r.score} <span className="text-slate-400">/ {r.maxScore}</span>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{r.correct}</td>
                    <td className="px-4 py-3 tabular-nums">{r.incorrect}</td>
                    <td className="px-4 py-3 tabular-nums">{r.unanswered}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-600">{fmtDuration(r.timeTakenSec)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link to={`/admin/attempts/${r.attemptId}`} className="font-medium text-amber-800 hover:underline">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </AdminLayout>
  );
}
