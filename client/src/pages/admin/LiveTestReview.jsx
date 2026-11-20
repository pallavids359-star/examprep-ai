import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api, { getErrorMessage } from "../../api/axios";
import AdminLayout from "../../components/AdminLayout";
import { askConfirm } from "../../components/ConfirmDialog";
import { toast } from "../../components/Toaster";
import { PHASE, fmtDateTime, preview, toLocalInput } from "../../components/liveHelpers";

// Head lecturer: check every section, then publish
export default function LiveTestReview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [test, setTest] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [openKey, setOpenKey] = useState(null);
  const [newEnd, setNewEnd] = useState("");

  const load = useCallback(() => {
    api
      .get(`/admin/live-tests/${id}`)
      .then((res) => {
        setTest(res.data.test);
        setNewEnd(toLocalInput(res.data.test.endsAt));
      })
      .catch((err) => setError(getErrorMessage(err)));
  }, [id]);
  useEffect(load, [load]);

  const run = async (fn, okText) => {
    setBusy(true);
    try {
      await fn();
      if (okText) toast(okText);
      load();
    } catch (err) {
      toast(getErrorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    if (!(await askConfirm(`Publish "${test.title}"? Students will see it now and can start from ${fmtDateTime(test.startsAt)}. The questions can't change after this.`, { title: "Publish live test?", confirmText: "Publish", danger: false }))) return;
    run(() => api.post(`/admin/live-tests/${id}/publish`), "Published");
  };
  const unpublish = async () => {
    if (!(await askConfirm("Move this test back to draft? Students won't see it until you publish again.", { confirmText: "Back to draft", danger: false }))) return;
    run(() => api.post(`/admin/live-tests/${id}/unpublish`), "Back to draft");
  };
  const reopen = (key, name) => run(() => api.post(`/admin/live-tests/${id}/sections/${key}/reopen`), `${name} re-opened for the lecturer`);
  const extend = () => run(() => api.put(`/admin/live-tests/${id}`, { endsAt: new Date(newEnd).toISOString() }), "Closing time changed");
  const remove = async () => {
    if (!(await askConfirm("Delete this live test? If students already took it, their results are kept but the test is hidden."))) return;
    setBusy(true);
    try {
      await api.delete(`/admin/live-tests/${id}`);
      toast("Deleted");
      navigate("/admin/live-tests");
    } catch (err) {
      toast(getErrorMessage(err), "error");
      setBusy(false);
    }
  };

  if (error) {
    return (
      <AdminLayout title="Live test">
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      </AdminLayout>
    );
  }
  if (!test) {
    return (
      <AdminLayout title="Live test">
        <p className="text-sm text-slate-500">Loading...</p>
      </AdminLayout>
    );
  }

  const ph = PHASE[test.phase] || PHASE.draft;
  const isDraft = test.status === "draft";
  const allIn = test.sections.every((s) => s.submittedAt && s.picked === s.mcqCount + s.numericalCount);
  const total = test.sections.reduce((a, s) => a + s.mcqCount + s.numericalCount, 0);

  return (
    <AdminLayout
      title={test.title}
      actions={
        <div className="flex flex-wrap gap-2">
          {isDraft && (
            <Link to={`/admin/live-tests/${id}/edit`} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Edit details
            </Link>
          )}
          {!isDraft && (
            <Link to={`/admin/live-tests/${id}/results`} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Results
            </Link>
          )}
          {isDraft ? (
            <button type="button" disabled={!allIn || busy} onClick={publish} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
              {allIn ? "Publish" : "Publish (waiting for sections)"}
            </button>
          ) : test.phase === "scheduled" ? (
            <button type="button" disabled={busy} onClick={unpublish} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Back to draft
            </button>
          ) : null}
        </div>
      }
    >
      <Link to="/admin/live-tests" className="text-sm font-medium text-indigo-700 hover:underline">
        ← All live tests
      </Link>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-600">
        <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${ph.cls}`}>{ph.label}</span>
        <span>{test.exam?.code}</span>
        <span>
          {fmtDateTime(test.startsAt)} → {fmtDateTime(test.endsAt)}
        </span>
        <span>{test.durationMinutes} min</span>
        <span>
          {total} questions · +{test.exam?.markingScheme?.correct ?? 4} / {test.exam?.markingScheme?.incorrect ?? -1}
        </span>
        <span>Results {test.live?.showResults === "after_submit" ? "right after submitting" : "after the test closes"}</span>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {test.sections.map((s) => {
          const need = s.mcqCount + s.numericalCount;
          return (
            <section key={s.key} className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">{s.name}</h2>
                <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${s.submittedAt ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-800"}`}>
                  {s.submittedAt ? "Handed in" : "In progress"}
                </span>
              </div>
              <p className="text-sm text-slate-700">
                {s.lecturer?.name || "No lecturer"} · {s.picked} of {need}
              </p>
              <div className="h-2 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-indigo-600" style={{ width: `${need ? Math.round((s.picked / need) * 100) : 0}%` }} />
              </div>
              <p className="text-xs text-slate-500">
                {s.mcqCount} MCQ{s.numericalCount ? ` + ${s.numericalCount} numerical` : ""} ·{" "}
                {["easy", "medium", "hard"].map((d) => `${s.questions.filter((q) => q.difficulty === d).length} ${d}`).join(" · ")} · {s.questions.filter((q) => q.diagram).length} with diagrams
                {s.dueAt && !s.submittedAt ? ` · due ${fmtDateTime(s.dueAt)}` : ""}
              </p>
              <div className="mt-auto flex flex-wrap gap-4 pt-1 text-sm">
                <button type="button" onClick={() => setOpenKey(openKey === s.key ? null : s.key)} className="font-semibold text-indigo-700 hover:underline">
                  {openKey === s.key ? "Hide questions" : "See questions"}
                </button>
                {isDraft && (
                  <Link to={`/lecturer/tests/${id}/${s.key}`} className="font-semibold text-indigo-700 hover:underline">
                    Open picker
                  </Link>
                )}
                {isDraft && s.submittedAt && (
                  <button type="button" disabled={busy} onClick={() => reopen(s.key, s.name)} className="font-semibold text-slate-600 hover:underline">
                    Re-open
                  </button>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {openKey &&
        (() => {
          const s = test.sections.find((x) => x.key === openKey);
          return (
            <section className="mt-5 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="font-semibold text-slate-900">{s.name} questions</h2>
              <p className="text-xs text-slate-500">Open the picker to see each question in full with its answer and solution{isDraft ? ", or to swap questions" : ""}.</p>
              {s.questions.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">No questions picked yet.</p>
              ) : (
                <table className="mt-3 w-full min-w-[640px] text-sm">
                  <thead className="text-left text-xs uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="py-2 pr-3">Q</th>
                      <th className="py-2 pr-3">Question</th>
                      <th className="py-2 pr-3">Chapter · concept</th>
                      <th className="py-2 pr-3">Class</th>
                      <th className="py-2">Level</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.questions.map((q, i) => (
                      <tr key={q._id} className="border-t border-slate-100">
                        <td className="py-2 pr-3 font-semibold text-slate-500">{i + 1}</td>
                        <td className="py-2 pr-3 text-slate-800">
                          {preview(q.text)}
                          {q.type === "numerical" && <span className="ml-2 rounded bg-orange-50 px-1.5 text-xs text-orange-800">numerical</span>}
                          {q.diagram && <span className="ml-2 rounded bg-violet-50 px-1.5 text-xs text-violet-800">diagram</span>}
                        </td>
                        <td className="py-2 pr-3 text-slate-600">
                          {q.chapter} · {q.topic}
                        </td>
                        <td className="py-2 pr-3">{q.classLevel}</td>
                        <td className="py-2 capitalize">{q.difficulty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          );
        })()}

      {!isDraft && test.phase !== "closed" && (
        <section className="mt-5 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-5">
          <label className="text-sm font-medium text-slate-700">
            Closing time
            <input type="datetime-local" className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} />
          </label>
          <button type="button" disabled={busy || !newEnd} onClick={extend} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            Keep it open longer
          </button>
          <p className="text-xs text-slate-500">Once published, the closing time can only move later.</p>
        </section>
      )}

      <div className="mt-8 border-t border-slate-200 pt-4">
        <button type="button" disabled={busy} onClick={remove} className="text-sm font-medium text-red-600 hover:underline">
          Delete this live test
        </button>
      </div>
    </AdminLayout>
  );
}
