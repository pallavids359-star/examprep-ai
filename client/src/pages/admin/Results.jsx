import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { getErrorMessage } from "../../api/axios";
import AdminLayout from "../../components/AdminLayout";
import { fmtDateTime } from "../../components/liveHelpers";

const MEDAL = ["🥇", "🥈", "🥉"];

// Admin: pick a live test, see every student's rank
export default function Results() {
  const [tests, setTests] = useState(null);
  const [testId, setTestId] = useState("");
  const [board, setBoard] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/admin/live-tests")
      .then((res) => {
        const list = res.data.tests.filter((t) => t.status !== "draft").sort((a, b) => new Date(b.startsAt) - new Date(a.startsAt));
        setTests(list);
        setTestId((cur) => cur || (list.find((t) => t.finished > 0) || list[0])?._id || "");
      })
      .catch((err) => setError(getErrorMessage(err)));
  }, []);

  useEffect(() => {
    if (!testId) return;
    setBoard(null);
    api
      .get(`/admin/live-tests/${testId}/results`)
      .then((res) => setBoard(res.data))
      .catch((err) => setError(getErrorMessage(err)));
  }, [testId]);

  return (
    <AdminLayout title="Results">
      {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {tests && tests.length === 0 && <p className="py-16 text-center text-sm text-slate-400">No live tests yet.</p>}

      {tests && tests.length > 0 && (
        <>
          <label className="block max-w-md">
            <span className="text-sm font-medium text-slate-700">Live test</span>
            <select value={testId} onChange={(e) => setTestId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
              {tests.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.title} · {t.exam} · {t.finished} finished
                </option>
              ))}
            </select>
          </label>

          {board && (
            <p className="mt-3 text-sm text-slate-500">
              {fmtDateTime(board.test.startsAt)} → {fmtDateTime(board.test.endsAt)} · {board.stats.finished} finished
              {board.stats.average !== null ? ` · average ${board.stats.average} / ${board.test.totalMarks}` : ""}
            </p>
          )}

          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="w-20 px-4 py-2.5 font-medium">Rank</th>
                  <th className="px-4 py-2.5 font-medium">Student</th>
                  <th className="px-4 py-2.5 font-medium">Score</th>
                  <th className="px-4 py-2.5 font-medium">Correct</th>
                  <th className="px-4 py-2.5 font-medium">Wrong</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {!board && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      Loading...
                    </td>
                  </tr>
                )}
                {board && board.rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      No one has finished this test yet.
                    </td>
                  </tr>
                )}
                {board?.rows.map((r) => (
                  <tr key={r.attemptId} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3 font-semibold tabular-nums text-slate-900">
                      {r.rank <= 3 ? `${MEDAL[r.rank - 1]} ` : ""}
                      {r.rank}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{r.student?.name || "Deleted account"}</p>
                      <p className="text-xs text-slate-500">{r.student?.email}</p>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-900">
                      {r.score} <span className="text-slate-400">/ {r.maxScore}</span>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{r.correct}</td>
                    <td className="px-4 py-3 tabular-nums">{r.incorrect}</td>
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
