import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api, { getErrorMessage } from "../../api/axios";
import AdminLayout from "../../components/AdminLayout";
import { askConfirm } from "../../components/ConfirmDialog";
import { toast } from "../../components/Toaster";
import { PHASE, fmtDateTime, fmtUntil, preview, toLocalInput } from "../../components/liveHelpers";
import { Countdown, Ring } from "../../components/premium";

const PICKER_LABEL = { auto: "Auto-picked", me: "You pick", lecturer: "Lecturer picks" };

// Head lecturer: one page to see where the test stands. No publish button:
// the test goes live by itself once every subject has its questions.
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
      const res = await fn();
      if (res?.data?.shortMcq || res?.data?.shortNumerical) toast(`Not enough questions in the bank: ${res.data.shortMcq} MCQ and ${res.data.shortNumerical} numerical short`, "error");
      else if (okText) toast(okText);
      load();
    } catch (err) {
      toast(getErrorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  };

  const reAuto = async (s) => {
    if (!(await askConfirm(`Replace all ${s.name} questions with a new automatic pick?`, { confirmText: "Pick again", danger: false }))) return;
    run(() => api.post(`/lecturer/live-tests/${id}/sections/${s.key}/autopick`, { replace: true }), `${s.name}: new questions picked`);
  };
  const fill = (s) => run(() => api.post(`/lecturer/live-tests/${id}/sections/${s.key}/autopick`, {}), `${s.name}: the rest was filled automatically`);
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

  if (error || !test) {
    return (
      <AdminLayout title="Live test">
        {error ? <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : <p className="text-sm text-slate-500">Loading...</p>}
      </AdminLayout>
    );
  }

  const ph = PHASE[test.phase] || PHASE.draft;
  const waiting = test.sections.filter((s) => !s.full);
  const total = test.sections.reduce((a, s) => a + s.mcqCount + s.numericalCount, 0);

  // One clear sentence about where the test stands
  let banner;
  if (test.phase === "draft") {
    banner = {
      cls: "border-amber-200 bg-amber-50 text-amber-900",
      text: `Waiting for questions: ${waiting.map((s) => `${s.name} ${s.picked}/${s.mcqCount + s.numericalCount}`).join(", ")}. The test goes live by itself once every subject is full.`,
    };
  } else if (test.phase === "scheduled") {
    banner = { cls: "border-green-200 bg-green-50 text-green-900", text: `Ready ✓ Students can see it now, and it opens ${fmtUntil(test.startsAt)} (${fmtDateTime(test.startsAt)}). You can still change questions until then.` };
  } else if (test.phase === "open") {
    banner = { cls: "border-green-200 bg-green-50 text-green-900", text: `Open now until ${fmtDateTime(test.endsAt)}. Questions are locked.` };
  } else {
    banner = { cls: "border-slate-200 bg-slate-50 text-slate-800", text: `Closed on ${fmtDateTime(test.endsAt)}. Results are out.` };
  }

  const picked = test.sections.reduce((a, s) => a + Math.min(s.picked, s.mcqCount + s.numericalCount), 0);

  return (
    <AdminLayout>
      <Link to="/admin/live-tests" className="text-sm font-semibold text-amber-800 hover:underline">
        ← All live tests
      </Link>

      <section className="gp-hero mt-3 p-6 md:p-8">
        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <div className="min-w-0 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-bold text-amber-200">{test.exam?.code}</span>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${ph.cls}`}>
                {test.phase === "open" && <span className="gp-live-dot" />}
                {test.phase === "draft" ? "Waiting for questions" : ph.label}
              </span>
            </div>
            <h1 className="mt-3 text-2xl font-extrabold text-white md:text-3xl">{test.title}</h1>
            <p className="gp-muted mt-2 text-sm">
              {fmtDateTime(test.startsAt)} → {fmtDateTime(test.endsAt)} · {test.durationMinutes} min · {total} questions
            </p>
            {(test.phase === "scheduled" || test.phase === "open") && (
              <div className="mt-5">
                <p className="mb-2 text-xs font-bold uppercase tracking-widest text-amber-200/70">{test.phase === "open" ? "Closes in" : "Opens in"}</p>
                <Countdown to={test.phase === "open" ? test.endsAt : test.startsAt} onDone={load} />
              </div>
            )}
            <div className="mt-5 flex flex-wrap gap-2">
              {test.editable && (
                <Link to={`/admin/live-tests/${id}/edit`} className="rounded-xl border border-amber-200/30 px-4 py-2.5 text-sm font-semibold text-amber-100 hover:bg-white/10">
                  Edit time & subjects
                </Link>
              )}
              {test.phase !== "draft" && (
                <Link to={`/admin/live-tests/${id}/results`} className="gp-gold-btn px-5 py-2.5 text-sm">
                  See results
                </Link>
              )}
            </div>
          </div>
          <Ring value={total ? (picked / total) * 100 : 0} size={150} stroke={12} dark label={`${picked}/${total}`} sub="questions ready" />
        </div>
      </section>

      <p className={`mt-5 rounded-2xl border px-5 py-4 text-sm ${banner.cls}`}>{banner.text}</p>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {test.sections.map((s) => {
          const need = s.mcqCount + s.numericalCount;
          return (
            <section key={s.key} className="gp-card gp-card-hover flex flex-col gap-3 p-5">
              <div className="flex items-center gap-4">
                <Ring value={need ? (s.picked / need) * 100 : 0} size={64} tone={s.full ? "green" : "gold"} label={s.full ? "✓" : undefined} />
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-slate-900">{s.name}</h2>
                  <p className="text-sm text-slate-600">
                    {s.full ? "Ready" : `${s.picked} of ${need} picked`} · {PICKER_LABEL[s.picker] || "Lecturer picks"}
                    {s.picker === "lecturer" && s.lecturer ? `: ${s.lecturer.name}` : ""}
                  </p>
                </div>
              </div>
              {s.missing > 0 && <p className="text-xs text-red-700">{s.missing} picked question(s) were deleted from the bank. Pick replacements.</p>}
              <p className="text-xs text-slate-500">
                {s.mcqCount} MCQ{s.numericalCount ? ` + ${s.numericalCount} numerical` : ""} · {s.questions.filter((q) => q.diagram).length} with diagrams ·{" "}
                {["easy", "medium", "hard"].map((d) => `${s.questions.filter((q) => q.difficulty === d).length} ${d}`).join(" · ")}
              </p>
              <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-1 text-sm">
                <button type="button" onClick={() => setOpenKey(openKey === s.key ? null : s.key)} className="font-semibold text-amber-800 hover:underline">
                  {openKey === s.key ? "Hide list" : "See list"}
                </button>
                {test.editable && (
                  <>
                    <Link to={`/lecturer/tests/${id}/${s.key}`} className="font-semibold text-amber-800 hover:underline">
                      {s.picker === "me" && !s.full ? "Pick questions" : "Change questions"}
                    </Link>
                    {!s.full && (
                      <button type="button" disabled={busy} onClick={() => fill(s)} className="font-semibold text-amber-800 hover:underline disabled:opacity-50">
                        Auto-fill the rest
                      </button>
                    )}
                    {s.full && s.picker === "auto" && (
                      <button type="button" disabled={busy} onClick={() => reAuto(s)} className="font-semibold text-slate-600 hover:underline disabled:opacity-50">
                        Pick again
                      </button>
                    )}
                  </>
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
            <section className="gp-card mt-5 overflow-x-auto p-5">
              <h2 className="font-semibold text-slate-900">{s.name} questions</h2>
              {s.questions.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">No questions yet.</p>
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

      {test.phase !== "draft" && test.phase !== "closed" && (
        <section className="gp-card mt-5 flex flex-wrap items-end gap-3 p-5">
          <label className="text-sm font-medium text-slate-700">
            Keep it open until
            <input type="datetime-local" className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} />
          </label>
          <button type="button" disabled={busy || !newEnd} onClick={extend} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            Save closing time
          </button>
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
