import { useCallback, useEffect, useState } from "react";
import BackLink from "../../components/BackLink";
import { Link, useNavigate, useParams } from "react-router-dom";
import api, { getErrorMessage } from "../../api/axios";
import AdminLayout from "../../components/AdminLayout";
import LecturerOptions from "../../components/LecturerOptions";
import { askConfirm } from "../../components/ConfirmDialog";
import { toast } from "../../components/Toaster";
import { PHASE, fmtDateTime, fmtUntil, preview, toLocalInput } from "../../components/liveHelpers";
import { Countdown, Ring } from "../../components/premium";

const PICKER_LABEL = { auto: "Auto-picked", me: "Set by you (admin)", lecturer: "Lecturer picks" };

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
  const [returning, setReturning] = useState(null); // section key being sent back
  const [note, setNote] = useState("");
  const [lecturers, setLecturers] = useState([]);
  const [changing, setChanging] = useState(null); // section key whose lecturer is being changed
  const [newLecturer, setNewLecturer] = useState("");
  const [keepQs, setKeepQs] = useState(true);
  useEffect(() => {
    api
      .get("/admin/lecturers")
      .then((res) => setLecturers(res.data.lecturers.filter((l) => l.role === "lecturer" && l.status === "active")))
      .catch(() => {});
  }, []);

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
  const swapOne = (s, q, i) => run(() => api.post(`/lecturer/live-tests/${id}/sections/${s.key}/swap`, { questionId: q._id }), `${s.name}: question ${i + 1} swapped`);
  const removeOne = (s, q, i) =>
    run(() => api.put(`/lecturer/live-tests/${id}/sections/${s.key}`, { questionIds: s.questions.filter((x) => x._id !== q._id).map((x) => x._id) }), `${s.name}: question ${i + 1} removed`);
  const clearSection = async (s) => {
    if (!(await askConfirm(`Remove all ${s.questions.length} ${s.name} questions? The test goes back to "waiting for questions" until you fill it again.`, { title: "Clear this subject?", confirmText: "Remove all", danger: true }))) return;
    run(() => api.put(`/lecturer/live-tests/${id}/sections/${s.key}`, { questionIds: [] }), `${s.name}: all questions removed`);
  };
  const sendBack = (s) =>
    run(() => api.post(`/admin/live-tests/${id}/sections/${s.key}/reopen`, { note }), `${s.name} sent back to ${s.lecturer?.name || "the lecturer"}`).then(() => {
      setReturning(null);
      setNote("");
    });
  const openChange = (s) => {
    setChanging(changing === s.key ? null : s.key);
    setNewLecturer(s.picker === "lecturer" && s.lecturer ? s.lecturer._id : "");
    setKeepQs(true);
  };
  const changeLecturer = (s) => {
    const who = lecturers.find((l) => l._id === newLecturer);
    run(() => api.put(`/admin/live-tests/${id}/sections/${s.key}/lecturer`, { lecturerId: newLecturer, keepQuestions: keepQs }), `${s.name} is now with ${who?.name || "the new lecturer"}`).then(() => setChanging(null));
  };
  const accept = (s) => run(() => api.post(`/admin/live-tests/${id}/sections/${s.key}/accept`), `${s.name} marked as ready`);
  const extend = () => run(() => api.put(`/admin/live-tests/${id}`, { endsAt: new Date(newEnd).toISOString() }), "Closing time changed");

  if (error || !test) {
    return (
      <AdminLayout title="Live test">
        {error ? <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : <p className="text-sm text-slate-500">Loading...</p>}
      </AdminLayout>
    );
  }

  const ph = PHASE[test.phase] || PHASE.draft;
  const waiting = test.sections.filter((s) => !s.ready);
  const total = test.sections.reduce((a, s) => a + s.mcqCount + s.numericalCount, 0);

  // One clear sentence about where the test stands
  let banner;
  if (test.phase === "draft") {
    banner = {
      cls: "border-amber-200 bg-amber-50 text-amber-900",
      text: `Waiting for: ${waiting
        .map((s) => (s.full ? `${s.name} (${s.lecturer?.name || "lecturer"} has to send it)` : `${s.name} ${s.picked}/${s.mcqCount + s.numericalCount}`))
        .join(", ")}. The test goes live by itself once every subject is ready.`,
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
      <BackLink to="/admin/live-tests">All live tests</BackLink>

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
              {test.phase !== "archived" && (
                <Link to={`/admin/live-tests/${id}/edit`} className="rounded-xl border border-amber-200/30 px-4 py-2.5 text-sm font-semibold text-amber-100 hover:bg-white/10">
                  ✎ {test.editable ? "Edit date, time & subjects" : "Edit closing time"}
                </Link>
              )}
              {test.phase !== "draft" && (
                <Link to={`/admin/live-tests/${id}/results`} className="gp-gold-btn px-5 py-2.5 text-sm">
                  Leaderboard
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
              <Link to={`/lecturer/tests/${id}/${s.key}?view=paper`} className="flex items-center gap-4" title={`Open all ${s.name} questions`}>
                <Ring value={need ? (s.picked / need) * 100 : 0} size={64} tone={s.ready ? "green" : "gold"} label={s.ready ? "✓" : undefined} />
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-slate-900">{s.name}</h2>
                  <p className="text-sm text-slate-600">
                    {s.ready ? "Ready" : s.full ? "Picked, not sent yet" : `${s.picked} of ${need} picked`} · {PICKER_LABEL[s.picker] || "Lecturer picks"}
                    {s.picker === "lecturer" && s.lecturer ? `: ${s.lecturer.name}` : ""}
                  </p>
                  {s.picker === "lecturer" && (
                    <p className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${s.submittedAt ? "bg-green-50 text-green-700" : s.returnedAt ? "bg-orange-50 text-orange-800" : "bg-slate-100 text-slate-600"}`}>
                      {s.submittedAt ? `Sent ✓ ${fmtDateTime(s.submittedAt)}` : s.returnedAt ? "Sent back for changes" : "Not sent yet"}
                    </p>
                  )}
                </div>
              </Link>
              {s.missing > 0 && <p className="text-xs text-red-700">{s.missing} picked question(s) were deleted from the bank. Pick replacements.</p>}
              <p className="text-xs text-slate-500">
                {s.mcqCount} MCQ{s.numericalCount ? ` + ${s.numericalCount} numerical` : ""} · {s.questions.filter((q) => q.diagram).length} with diagrams ·{" "}
                {["easy", "medium", "hard"].map((d) => `${s.questions.filter((q) => q.difficulty === d).length} ${d}`).join(" · ")}
              </p>
              <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-1 text-sm">
                {s.picked === 0 && s.picker !== "lecturer" && test.editable && (
                  <Link to={`/lecturer/tests/${id}/${s.key}`} className="w-full rounded-xl bg-gradient-to-r from-amber-200 to-amber-400 px-4 py-2 text-center font-bold text-slate-900 hover:brightness-105">
                    Pick {s.name} questions →
                  </Link>
                )}
                {s.picked > 0 && (
                  <Link to={`/lecturer/tests/${id}/${s.key}?view=paper`} className="w-full rounded-xl bg-slate-900 px-4 py-2 text-center font-semibold text-amber-200 hover:bg-black">
                    Review all {s.picked} questions →
                  </Link>
                )}
                <button type="button" onClick={() => setOpenKey(openKey === s.key ? null : s.key)} className="font-semibold text-amber-800 hover:underline">
                  {openKey === s.key ? "Hide quick list" : "Quick list"}
                </button>
                {test.editable && (
                  <>
                    <Link to={`/lecturer/tests/${id}/${s.key}`} className="font-semibold text-amber-800 hover:underline">
                      {s.picked ? "Add questions" : "Pick questions"}
                    </Link>
                    {!s.full && (
                      <button type="button" disabled={busy} onClick={() => fill(s)} className="font-semibold text-amber-800 hover:underline disabled:opacity-50">
                        Auto-fill the rest
                      </button>
                    )}
                    <button type="button" disabled={busy} onClick={() => openChange(s)} className="font-semibold text-amber-800 hover:underline disabled:opacity-50">
                      {s.picker === "lecturer" ? "Change lecturer" : "Give to a lecturer"}
                    </button>
                    {s.picker === "lecturer" && s.submittedAt && (
                      <button type="button" disabled={busy} onClick={() => setReturning(returning === s.key ? null : s.key)} className="font-semibold text-orange-700 hover:underline disabled:opacity-50">
                        Send back to lecturer
                      </button>
                    )}
                    {s.picker === "lecturer" && !s.submittedAt && s.full && test.status === "draft" && (
                      <button type="button" disabled={busy} onClick={() => accept(s)} className="font-semibold text-green-700 hover:underline disabled:opacity-50">
                        Mark as ready
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
              {changing === s.key && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
                  <label className="block text-xs font-semibold text-slate-800">
                    Who should pick the {s.name} questions?
                    <select value={newLecturer} onChange={(e) => setNewLecturer(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm font-normal">
                      <LecturerOptions list={lecturers} sectionKey={s.key} showEmail />
                    </select>
                  </label>
                  {s.picked > 0 && (
                    <label className="mt-2 flex items-center gap-2 text-xs text-slate-700">
                      <input type="checkbox" className="h-4 w-4 accent-amber-600" checked={keepQs} onChange={(e) => setKeepQs(e.target.checked)} />
                      Keep the {s.picked} questions already picked (untick to start empty)
                    </label>
                  )}
                  <p className="mt-2 text-xs text-slate-500">
                    The new lecturer sees this subject right away and has to send it to you again. Name or email typed wrong?{" "}
                    <Link to="/admin/lecturers" className="font-semibold text-amber-800 hover:underline">
                      Edit lecturers
                    </Link>
                  </p>
                  <div className="mt-2 flex justify-end gap-2">
                    <button type="button" onClick={() => setChanging(null)} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-white">
                      Cancel
                    </button>
                    <button type="button" disabled={busy || !newLecturer} onClick={() => changeLecturer(s)} className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-amber-200 hover:bg-black disabled:opacity-50">
                      Save
                    </button>
                  </div>
                </div>
              )}
              {returning === s.key && (
                <div className="rounded-xl border border-orange-200 bg-orange-50/60 p-3">
                  <label className="block text-xs font-semibold text-orange-900">
                    What should {s.lecturer?.name || "the lecturer"} change? (optional)
                    <textarea
                      rows={2}
                      maxLength={500}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="e.g. Q4 and Q9 are too easy, add more diagram questions"
                      className="mt-1 w-full rounded-lg border border-orange-200 bg-white px-2 py-1.5 text-sm font-normal text-slate-800"
                    />
                  </label>
                  <div className="mt-2 flex justify-end gap-2">
                    <button type="button" onClick={() => setReturning(null)} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-white">
                      Cancel
                    </button>
                    <button type="button" disabled={busy} onClick={() => sendBack(s)} className="rounded-lg bg-orange-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50">
                      Send back
                    </button>
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </div>

      {openKey &&
        (() => {
          const s = test.sections.find((x) => x.key === openKey);
          return (
            <section className="gp-card mt-5 overflow-x-auto p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-bold text-slate-900">{s.name} questions</h2>
                {test.editable && (
                  <div className="flex gap-3 text-sm">
                    <Link to={`/lecturer/tests/${id}/${s.key}`} className="font-semibold text-amber-800 hover:underline">
                      Read full questions
                    </Link>
                    {s.questions.length > 0 && (
                      <button type="button" disabled={busy} onClick={() => clearSection(s)} className="font-semibold text-red-700 hover:underline disabled:opacity-50">
                        Remove all
                      </button>
                    )}
                  </div>
                )}
              </div>
              {s.questions.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">No questions yet.</p>
              ) : (
                <table className="mt-3 w-full min-w-[760px] text-sm">
                  <thead className="text-left text-xs uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="py-2 pr-3">Q</th>
                      <th className="py-2 pr-3">Question</th>
                      <th className="py-2 pr-3">Chapter · concept</th>
                      <th className="py-2 pr-3">Class</th>
                      <th className="py-2 pr-3">Level</th>
                      {test.editable && <th className="py-2 text-right">Change</th>}
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
                        <td className="py-2 pr-3 capitalize">{q.difficulty}</td>
                        {test.editable && (
                          <td className="whitespace-nowrap py-2 text-right">
                            <button type="button" disabled={busy} onClick={() => swapOne(s, q, i)} className="rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-semibold text-amber-200 hover:bg-black disabled:opacity-50" title="Replace with a similar question">
                              ⇄ Swap
                            </button>
                            <button type="button" disabled={busy} onClick={() => removeOne(s, q, i)} className="ml-1.5 rounded-lg border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">
                              Remove
                            </button>
                          </td>
                        )}
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

    </AdminLayout>
  );
}
