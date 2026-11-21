import { useEffect, useState } from "react";
import api, { getErrorMessage } from "../../api/axios";
import AdminLayout from "../../components/AdminLayout";
import ClassLeaderboard from "../../components/ClassLeaderboard";

// Admin: pick a live test, see every student's rank
export default function Results() {
  const [tests, setTests] = useState(null);
  const [testId, setTestId] = useState("");
  const [exam, setExam] = useState("");
  const [board, setBoard] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/admin/live-tests")
      .then((res) => {
        const list = res.data.tests.filter((t) => t.status !== "draft").sort((a, b) => new Date(b.startsAt) - new Date(a.startsAt));
        setTests(list);
        const start = list.find((t) => t.finished > 0) || list[0];
        setExam((cur) => cur || start?.exam || "NEET");
        setTestId((cur) => cur || start?._id || "");
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
    <AdminLayout>
      <div className="mb-6 print:hidden">
        <h1 className="text-3xl font-extrabold text-slate-900">Results</h1>
        <p className="mt-1 text-sm text-slate-500">Pick a live test to see every student's rank.</p>
      </div>
      {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {tests && tests.length === 0 && <p className="py-16 text-center text-sm text-slate-400">No live tests yet.</p>}

      {tests && tests.length > 0 && (
        <>
          {/* Choose the exam */}
          <div className="mb-5 grid grid-cols-3 gap-3 print:hidden">
            {[...new Set(["NEET", "JEE", "KCET", ...tests.map((t) => t.exam)])].map((code) => {
              const list = tests.filter((t) => t.exam === code);
              const on = code === exam;
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => {
                    setExam(code);
                    setTestId((list.find((t) => t.finished > 0) || list[0])?._id || "");
                  }}
                  className={`rounded-2xl p-4 text-left transition ${on ? "bg-[#17140f] text-white shadow-lg" : "bg-white ring-1 ring-[#e7dcc3] hover:ring-[#c9a24a]"}`}
                >
                  <p className={`font-display text-2xl font-extrabold ${on ? "text-[#e5c372]" : "text-slate-900"}`}>{code}</p>
                  <p className={`text-sm ${on ? "text-white/70" : "text-slate-500"}`}>
                    {list.length} live test{list.length === 1 ? "" : "s"}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Choose a test */}
          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 print:hidden">
            {tests.filter((t) => t.exam === exam).length === 0 && <p className="py-4 text-sm text-slate-500">No {exam} live tests yet.</p>}
            {tests.filter((t) => t.exam === exam).map((t) => {
              const on = t._id === testId;
              return (
                <button
                  key={t._id}
                  type="button"
                  onClick={() => setTestId(t._id)}
                  className={`w-60 shrink-0 rounded-2xl p-4 text-left transition ${
                    on ? "bg-slate-900 text-white shadow-lg ring-2 ring-amber-300" : "bg-white text-slate-800 ring-1 ring-slate-200 hover:ring-amber-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${on ? "bg-amber-300 text-slate-900" : "bg-slate-100 text-slate-600"}`}>{t.exam}</span>
                    <span className={`text-xs ${on ? "text-amber-100/70" : "text-slate-400"}`}>{new Date(t.startsAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                  </div>
                  <p className="mt-2.5 truncate font-semibold">{t.title}</p>
                  <p className={`mt-0.5 text-sm ${on ? "text-amber-200" : "text-slate-500"}`}>
                    {t.finished} student{t.finished === 1 ? "" : "s"} finished
                  </p>
                </button>
              );
            })}
          </div>

          <div className="mt-6">
            {!tests.some((t) => t.exam === exam && t._id === testId) ? null : board ? (
              <ClassLeaderboard test={board.test} rows={board.rows} />
            ) : (
              <p className="py-10 text-center text-sm text-slate-400">Loading...</p>
            )}
          </div>
        </>
      )}
    </AdminLayout>
  );
}
