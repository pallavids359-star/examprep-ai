import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { getErrorMessage } from "../../api/axios";
import AdminLayout from "../../components/AdminLayout";
import QuestionBody from "../../components/QuestionBody";
import { askConfirm } from "../../components/ConfirmDialog";
import { toast } from "../../components/Toaster";
import { FLAG_REASON_LABEL } from "../../components/ReportQuestion";

const TABS = [
  ["open", "To check"],
  ["accepted", "Full marks given"],
  ["rejected", "No mistake"],
];
const fmt = (d) => (d ? new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "");
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

// Admin: questions students reported as wrong while writing a test
export default function ReportedQuestions() {
  const [status, setStatus] = useState("open");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    setData(null);
    api
      .get("/admin/question-reports", { params: { status } })
      .then((res) => setData(res.data.questions))
      .catch((err) => setError(getErrorMessage(err)));
  }, [status, reload]);

  const accept = async (g) => {
    const n = g.affectedStudents ?? 0;
    const ok = await askConfirm(
      `${plural(n, "student")} got this question. All of them will get full marks for it, whatever they answered, and their results and ranks will be updated. This cannot be undone.`,
      { title: "Give full marks for this question?", confirmLabel: "Give full marks", danger: false }
    );
    if (!ok) return;
    setBusy(g.questionId);
    try {
      const res = await api.post(`/admin/question-reports/${g.questionId}/accept`);
      toast(`${res.data.message}. Edit the question so new students get the corrected version.`);
      setReload((r) => r + 1);
      window.dispatchEvent(new Event("gp-reports-changed"));
    } catch (err) {
      toast(getErrorMessage(err), "error");
    } finally {
      setBusy("");
    }
  };

  const reject = async (g) => {
    const ok = await askConfirm("The question is correct. Marks stay the same.", { title: "No mistake in this question?", confirmLabel: "Yes, no mistake", danger: false });
    if (!ok) return;
    setBusy(g.questionId);
    try {
      await api.post(`/admin/question-reports/${g.questionId}/reject`);
      toast("Marked as no mistake");
      setReload((r) => r + 1);
      window.dispatchEvent(new Event("gp-reports-changed"));
    } catch (err) {
      toast(getErrorMessage(err), "error");
    } finally {
      setBusy("");
    }
  };

  return (
    <AdminLayout>
      <section className="gp-hero mt-2 p-6 md:p-8">
        <div className="relative max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-200/80">Question bank</p>
          <h1 className="mt-2 text-3xl font-extrabold text-white md:text-4xl">Reported questions</h1>
          <p className="gp-muted mt-2 text-[15px]">
            Students flagged these questions as wrong while writing a test. If a question really is wrong, give full marks: everyone who got it gets full marks for it.
          </p>
        </div>
      </section>

      <div className="mt-5 flex flex-wrap gap-2">
        {TABS.map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setStatus(k)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold ring-1 transition ${status === k ? "bg-[#17140f] text-[#e5c372] ring-[#17140f]" : "bg-white text-slate-700 ring-[#e7dcc3] hover:ring-[#c9a24a]"}`}
          >
            {label}
            {k === status && data ? <span className="ml-2 opacity-70">{data.length}</span> : null}
          </button>
        ))}
      </div>

      {status === "accepted" && data?.some((g) => !g.fixed) && (
        <div className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
          <b>{plural(data.filter((g) => !g.fixed).length, "question")} not fixed yet</b>
        </div>
      )}
      {error && <div className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {!data && !error && <p className="mt-6 text-slate-500">Loading...</p>}
      {data && !data.length && (
        <div className="gp-card mt-5 p-10 text-center text-slate-500">
          {status === "open" ? "No reported questions to check. 🎉" : "Nothing here yet."}
        </div>
      )}

      <div className="mt-5 space-y-5">
        {data?.map((g) => {
          const q = g.question;
          return (
            <article key={g.questionId} className="gp-card overflow-hidden">
              <header className="flex flex-wrap items-center gap-2 border-b border-[#f1e9d7] px-5 py-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 ring-1 ring-rose-200">
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M4 22V4M4 4h13l-2 4 2 4H4" /></svg>
                  {plural(g.reports.length, "report")}
                </span>
                <span className="text-sm text-slate-600">
                  {[q?.subjectId?.name, q?.chapterId?.name].filter(Boolean).join(" · ")}
                  {q?.difficulty ? ` · ${q.difficulty}` : ""}
                </span>
                {g.fixed ? (
                  <span title={`Saved in the question editor after it was reported`} className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">
                    ✓ Fixed · {fmt(g.fixed.at)}{g.fixed.by ? ` by ${g.fixed.by}` : ""}{g.fixed.supabase ? " · also in Supabase" : ""}
                  </span>
                ) : status !== "rejected" ? (
                  <span title="Nobody has edited this question since it was reported" className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800 ring-1 ring-amber-200">
                    Not fixed yet
                  </span>
                ) : null}
                <span className="flex flex-wrap gap-1.5 sm:ml-auto">
                  {Object.entries(g.reasons).map(([r, n]) => (
                    <span key={r} className="rounded-full bg-[#fbf6ea] px-2.5 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-[#e7dcc3]">
                      {FLAG_REASON_LABEL[r] || r}
                      {n > 1 ? ` ×${n}` : ""}
                    </span>
                  ))}
                </span>
              </header>

              <div className="grid gap-0 lg:grid-cols-5">
                <div className="p-5 lg:col-span-3">
                  {q ? <QuestionBody q={q} compact solutionOpen={false} /> : <p className="text-slate-500">This question was deleted.</p>}
                </div>
                <div className="border-t border-[#f1e9d7] bg-[#fdfbf6] p-5 lg:col-span-2 lg:border-l lg:border-t-0">
                  <p className="gp-label mb-2">What students said</p>
                  <ul className="max-h-72 space-y-2.5 overflow-y-auto pr-1">
                    {g.reports.map((r) => (
                      <li key={r._id} className="rounded-xl bg-white p-3 text-sm ring-1 ring-[#efe6d2]">
                        <p className="flex flex-wrap items-baseline justify-between gap-x-2">
                          <b className="text-slate-900">{r.student.name}</b>
                          <span className="text-xs text-slate-400">{fmt(r.at)}</span>
                        </p>
                        <p className="text-xs text-slate-500">
                          {[r.student.college, r.student.section && `Section ${r.student.section}`, r.where].filter(Boolean).join(" · ")}
                        </p>
                        <p className="mt-1 font-medium text-rose-700">{FLAG_REASON_LABEL[r.reason] || r.reason}</p>
                        {r.note && <p className="mt-0.5 text-slate-700">“{r.note}”</p>}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <footer className="flex flex-wrap items-center gap-2 border-t border-[#f1e9d7] px-5 py-3">
                {status === "open" ? (
                  <>
                    <button
                      type="button"
                      disabled={busy === g.questionId}
                      onClick={() => accept(g)}
                      className="rounded-xl bg-[#17140f] px-4 py-2 text-sm font-semibold text-[#e5c372] hover:bg-black disabled:opacity-50"
                    >
                      ✓ Give full marks{g.affectedStudents != null ? ` (${plural(g.affectedStudents, "student")})` : ""}
                    </button>
                    <button
                      type="button"
                      disabled={busy === g.questionId}
                      onClick={() => reject(g)}
                      className="rounded-xl border border-[#e7dcc3] bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-[#c9a24a] disabled:opacity-50"
                    >
                      No mistake
                    </button>
                  </>
                ) : (
                  <span className={`text-sm font-medium ${status === "accepted" ? "text-amber-800" : "text-slate-600"}`}>
                    {status === "accepted" ? "Full marks given" : "Checked: no mistake"}
                    {g.reviewedBy ? ` by ${g.reviewedBy}` : ""}
                    {g.reviewedAt ? ` · ${fmt(g.reviewedAt)}` : ""}
                  </span>
                )}
                {q && (
                  <Link to={`/admin/questions/${g.questionId}?back=/admin/reported`} className="ml-auto text-sm font-semibold text-[#9a7a2c] hover:underline">
                    Edit question →
                  </Link>
                )}
              </footer>
            </article>
          );
        })}
      </div>
    </AdminLayout>
  );
}
