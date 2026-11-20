import { useEffect, useState } from "react";
import api, { getErrorMessage } from "../../api/axios";
import AdminLayout from "../../components/AdminLayout";
import ClassLeaderboard from "../../components/ClassLeaderboard";

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
          <label className="block max-w-md print:hidden">
            <span className="text-sm font-medium text-slate-700">Live test</span>
            <select value={testId} onChange={(e) => setTestId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
              {tests.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.title} · {t.exam} · {t.finished} finished
                </option>
              ))}
            </select>
          </label>

          <div className="mt-6">
            {board ? <ClassLeaderboard test={board.test} rows={board.rows} /> : <p className="py-10 text-center text-sm text-slate-400">Loading...</p>}
          </div>
        </>
      )}
    </AdminLayout>
  );
}
