import { useEffect, useState } from "react";
import api, { getErrorMessage } from "../../api/axios";
import AdminLayout from "../../components/AdminLayout";
import AdminTestResult from "../../components/AdminTestResult";
import { PHASE } from "../../components/liveHelpers";

const day = (d) => new Date(d).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

// Admin results: 1) exam  2) its live tests  3) one test: attendance and every student's rank
export default function Results() {
  const [tests, setTests] = useState(null);
  const [exam, setExam] = useState("");
  const [testId, setTestId] = useState(null);
  const [board, setBoard] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/admin/live-tests")
      .then((res) => {
        const list = res.data.tests.filter((t) => t.status !== "draft").sort((a, b) => new Date(b.startsAt) - new Date(a.startsAt));
        setTests(list);
        setExam((cur) => cur || list[0]?.exam || "NEET");
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

  const exams = [...new Set(["NEET", "JEE", "KCET", ...(tests || []).map((t) => t.exam)])];
  const list = (tests || []).filter((t) => t.exam === exam);

  return (
    <AdminLayout>
      <div className="mb-6 print:hidden">
        <h1 className="text-3xl font-extrabold text-slate-900">Results</h1>
        <p className="mt-1 text-sm text-slate-500">Choose an exam, then a live test, to see who wrote it and every student's rank.</p>
      </div>
      {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {!tests && !error && <p className="py-10 text-center text-sm text-slate-400">Loading...</p>}

      {tests && (
        <>
          {/* 1. Exam */}
          <div className="grid grid-cols-3 gap-3 print:hidden">
            {exams.map((code) => {
              const n = tests.filter((t) => t.exam === code).length;
              const on = code === exam;
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => {
                    setExam(code);
                    setTestId(null);
                  }}
                  className={`rounded-2xl px-5 py-4 text-left transition ${on ? "bg-[#17140f] text-white shadow-lg" : "bg-white ring-1 ring-[#e7dcc3] hover:ring-[#c9a24a]"}`}
                >
                  <p className={`font-display text-2xl font-extrabold ${on ? "text-[#e5c372]" : "text-slate-900"}`}>{code}</p>
                  <p className={`text-sm ${on ? "text-white/70" : "text-slate-500"}`}>
                    {n} live test{n === 1 ? "" : "s"}
                  </p>
                </button>
              );
            })}
          </div>

          {/* 2. Its live tests */}
          {!testId && (
            <>
              <h2 className="mt-8 text-sm font-semibold uppercase tracking-wider text-slate-500">{exam} live tests</h2>
              {list.length === 0 ? (
                <p className="mt-3 rounded-2xl bg-white px-6 py-10 text-center text-sm text-slate-500 ring-1 ring-[#e7dcc3]">No {exam} live tests yet.</p>
              ) : (
                <ul className="mt-3 divide-y divide-[#efe6d2] overflow-hidden rounded-2xl bg-white ring-1 ring-[#e7dcc3]">
                  {list.map((t, i) => {
                    const ph = PHASE[t.phase] || PHASE.closed;
                    return (
                      <li key={t._id}>
                        <button type="button" onClick={() => setTestId(t._id)} className="group flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-[#fbf8f1]">
                          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#f7f3ea] font-display text-lg font-extrabold text-[#b8862b]">{list.length - i}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold text-slate-900">{t.title}</span>
                            <span className="block text-sm text-slate-500">{day(t.startsAt)}</span>
                          </span>
                          <span className={`hidden rounded-full px-2.5 py-0.5 text-xs font-semibold sm:inline ${ph.cls}`}>{ph.label}</span>
                          <span className="w-28 text-right">
                            <span className="block font-display text-xl font-extrabold tabular-nums text-slate-900">{t.finished || 0}</span>
                            <span className="block text-xs text-slate-500">completed</span>
                          </span>
                          <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-900" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M9 18l6-6-6-6" />
                          </svg>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}

          {/* 3. One test */}
          {testId && (
            <div className="mt-6">
              <button type="button" onClick={() => setTestId(null)} className="group mb-4 inline-flex items-center gap-2.5 text-sm font-medium text-slate-600 hover:text-slate-900 print:hidden">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-white shadow-sm ring-1 ring-[#e7dcc3] transition group-hover:bg-[#17140f] group-hover:text-[#e5c372]">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                </span>
                All {exam} live tests
              </button>
              {board ? <AdminTestResult board={board} /> : <p className="py-10 text-center text-sm text-slate-400">Loading...</p>}
            </div>
          )}
        </>
      )}
    </AdminLayout>
  );
}
