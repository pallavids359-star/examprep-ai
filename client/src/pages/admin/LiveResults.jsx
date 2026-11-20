import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api, { getErrorMessage } from "../../api/axios";
import AdminLayout from "../../components/AdminLayout";
import { PHASE, fmtDateTime, fmtDuration } from "../../components/liveHelpers";

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

  return (
    <AdminLayout
      title={`${data.test.title}: results`}
      actions={
        data.rows.length > 0 && (
          <button type="button" onClick={download} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Download CSV
          </button>
        )
      }
    >
      <Link to={`/admin/live-tests/${id}`} className="text-sm font-medium text-indigo-700 hover:underline">
        ← Back to the test
      </Link>
      <p className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-600">
        <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${ph.cls}`}>{ph.label}</span>
        {fmtDateTime(data.test.startsAt)} → {fmtDateTime(data.test.endsAt)}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        {[
          ["Finished", data.stats.finished],
          ["Writing now", data.stats.inProgress],
          ["Average", data.stats.average ?? "—"],
          ["Highest", data.stats.highest ?? "—"],
        ].map(([l, v]) => (
          <div key={l} className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">{l}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
              {v}
              {(l === "Average" || l === "Highest") && v !== "—" ? <span className="text-sm font-normal text-slate-500"> / {data.test.totalMarks}</span> : null}
            </p>
          </div>
        ))}
      </div>

      {data.rows.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">No one has finished yet.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Rank</th>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">Correct / wrong / blank</th>
                <th className="px-4 py-3">Accuracy</th>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.attemptId} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-bold text-slate-900">{r.rank}</td>
                  <td className="px-4 py-3">
                    {r.student ? (
                      <Link to={`/admin/students/${r.student._id}`} className="font-medium text-slate-900 hover:text-indigo-700 hover:underline">
                        {r.student.name}
                      </Link>
                    ) : (
                      "Deleted account"
                    )}
                    <p className="text-xs text-slate-500">{r.student?.email}</p>
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    <b>{r.score}</b> / {r.maxScore} <span className="text-slate-500">({r.percentage}%)</span>
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    <span className="text-green-700">{r.correct}</span> / <span className="text-orange-700">{r.incorrect}</span> / {r.unanswered}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{r.accuracy}%</td>
                  <td className="px-4 py-3">{fmtDuration(r.timeTakenSec)}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {fmtDateTime(r.submittedAt)}
                    {r.autoSubmitted && <span className="ml-1 text-xs text-amber-700">(time ran out)</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  );
}
