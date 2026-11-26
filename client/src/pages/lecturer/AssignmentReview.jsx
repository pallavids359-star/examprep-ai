import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import api, { getErrorMessage } from "../../api/axios";
import LecturerLayout from "../../components/LecturerLayout";
import BackLink from "../../components/BackLink";
import AssignmentPicker from "../../components/AssignmentPicker";
import { useAuth } from "../../context/AuthContext";
import { ROW_CLICK, rowLink } from "../../components/uiHelpers";
import SwapDialog from "../../components/SwapDialog";
import PaperQuestionCard, { PaperToolbar } from "../../components/PaperQuestionCard";
import { askConfirm } from "../../components/ConfirmDialog";
import { toast } from "../../components/Toaster";
import { fmtDateTime, fmtDuration, fmtUntil, toLocalInput } from "../../components/liveHelpers";
import { CLASS_LABELS, FORMAT_SHORT, Pill, STATE, audienceText } from "../../components/assignmentHelpers";

const input = "w-full rounded-xl border border-[#e7dcc3] bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#c9a24a] focus:ring-4 focus:ring-[#e5c372]/30";

// Lecturer: check the questions, edit details, publish, and see who handed in
export default function AssignmentReview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("questions");
  const [busy, setBusy] = useState("");
  const [showSolutions, setShowSolutions] = useState(false);
  const [swapDialog, setSwapDialog] = useState(null);
  const [swapFormats, setSwapFormats] = useState([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [opts, setOpts] = useState(null);
  const shortages = location.state?.shortages || [];
  const [picking, setPicking] = useState(Boolean(location.state?.pick));

  const load = useCallback(() => {
    api
      .get(`/lecturer/assignments/${id}`)
      .then((res) => setData(res.data))
      .catch((err) => setError(getErrorMessage(err)));
  }, [id]);
  useEffect(load, [load]);

  const a = data?.assignment;
  const questions = data?.questions || [];
  const editable = a?.editable;

  const run = async (key, fn, ok) => {
    setBusy(key);
    try {
      await fn();
      if (ok) toast(ok);
    } catch (err) {
      toast(getErrorMessage(err), "error");
    } finally {
      setBusy("");
    }
  };

  // Swap from the pop-up: { choices } = GenPrep picks, { newQuestionId } = the lecturer picked
  const swapWith = async (q, body) => {
    setBusy(`swap-${q._id}`);
    try {
      const res = await api.post(`/lecturer/assignments/${id}/swap`, { questionId: q._id, ...body });
      setData((d) => {
        const qs = [...d.questions];
        qs[res.data.position] = res.data.question;
        return { ...d, questions: qs };
      });
      toast(`Question ${res.data.position + 1} swapped`);
      return true;
    } catch (err) {
      toast(getErrorMessage(err), "error");
      return false;
    } finally {
      setBusy("");
    }
  };

  const move = (i, dir) =>
    run("move", async () => {
      const qs = [...questions];
      [qs[i], qs[i + dir]] = [qs[i + dir], qs[i]];
      await api.put(`/lecturer/assignments/${id}`, { questionIds: qs.map((x) => x._id) });
      setData((d) => ({ ...d, questions: qs }));
    });

  const removeQ = (q) =>
    run(`rm-${q._id}`, async () => {
      const ids = questions.filter((x) => x._id !== q._id).map((x) => x._id);
      await api.put(`/lecturer/assignments/${id}`, { questionIds: ids });
      setData((d) => ({ ...d, questions: d.questions.filter((x) => x._id !== q._id), assignment: { ...d.assignment, questions: ids.length } }));
    }, "Removed");

  const publish = async () => {
    const ok = await askConfirm(`Publish to ${audienceText(a)}? Students can start right away.`, { confirmText: "Publish" });
    if (!ok) return;
    run("publish", async () => {
      await api.post(`/lecturer/assignments/${id}/publish`);
      load();
    }, "Published. Students can see it now.");
  };
  const unpublish = () =>
    run("unpublish", async () => {
      await api.post(`/lecturer/assignments/${id}/unpublish`);
      load();
    }, "Moved back to draft");
  const remove = async () => {
    const ok = await askConfirm("Delete this assignment? Any answers students gave are deleted too.", { confirmText: "Delete", danger: true });
    if (!ok) return;
    run("delete", async () => {
      await api.delete(`/lecturer/assignments/${id}`);
      navigate("/lecturer/assignments");
    }, "Deleted");
  };

  const startEdit = () => {
    setForm({ title: a.title, instructions: a.instructions || "", college: a.college, sections: a.sections || [], dueAt: toLocalInput(a.dueAt) });
    setEditing(true);
    if (!opts) api.get("/lecturer/assignments/options").then((r) => setOpts(r.data)).catch(() => {});
  };
  const saveEdit = () =>
    run("save", async () => {
      await api.put(`/lecturer/assignments/${id}`, { ...form, dueAt: new Date(form.dueAt).toISOString() });
      setEditing(false);
      load();
    }, "Saved");

  if (error) {
    return (
      <LecturerLayout>
        <main className="mx-auto max-w-[1600px] px-4 py-8 md:px-8">
          <BackLink to="/lecturer/assignments">Assignments</BackLink>
          <div className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        </main>
      </LecturerLayout>
    );
  }
  if (!a) {
    return (
      <LecturerLayout>
        <main className="mx-auto max-w-[1600px] space-y-4 px-4 py-8 md:px-8">
          <div className="gp-card h-40 animate-pulse bg-white/60" />
          <div className="gp-card h-64 animate-pulse bg-white/60" />
        </main>
      </LecturerLayout>
    );
  }

  const past = new Date(a.dueAt) < new Date();
  const st = a.status === "draft" ? STATE.draft : STATE.published;
  const levels = ["easy", "medium", "hard"].map((l) => [l, questions.filter((q) => q.difficulty === l).length]);
  const s = a.settings || {};
  const diffText = s.difficulty?.mode === "custom" ? `${s.difficulty.easy}% easy · ${s.difficulty.medium}% medium · ${s.difficulty.hard}% hard` : s.difficulty?.mode === "any" ? "Any difficulty" : "Equal difficulty";

  return (
    <LecturerLayout>
      <main className="mx-auto max-w-[1600px] px-4 pb-16 pt-6 md:px-8 md:pt-8">
        <BackLink to="/lecturer/assignments">Assignments</BackLink>

        {/* Header */}
        <section className="gp-hero mt-4 p-6 md:p-8">
          <div className="relative flex flex-wrap items-start justify-between gap-5">
            <div className="min-w-0 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-bold text-amber-100 ring-1 ring-amber-200/30">{a.exam}</span>
                <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-bold text-amber-100 ring-1 ring-amber-200/30">{a.subject}</span>
                <Pill cls={st.cls}>{st.label}</Pill>
              </div>
              <h1 className="mt-3 text-2xl font-extrabold text-white md:text-3xl">{a.title}</h1>
              <p className="gp-muted mt-1.5 text-sm">
                {audienceText(a)} · Due {fmtDateTime(a.dueAt)} {!past && <span className="text-amber-200">({fmtUntil(a.dueAt)})</span>}
              </p>
              <p className="gp-muted mt-1 text-xs">
                {CLASS_LABELS[s.classLevel] || ""} · {diffText}
                {s.formats?.length ? ` · ${s.formats.map((f) => FORMAT_SHORT[f] || f).join(", ")}` : " · All question types"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {a.status === "draft" ? (
                <button onClick={publish} disabled={busy === "publish" || !questions.length} className="gp-gold-btn px-5 py-2.5 text-sm disabled:opacity-60">
                  {busy === "publish" ? "Publishing…" : "Publish →"}
                </button>
              ) : (
                editable && (
                  <button onClick={unpublish} disabled={busy === "unpublish"} className="rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-white/20 hover:bg-white/15">
                    Take back
                  </button>
                )
              )}
              <button onClick={startEdit} className="rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-white/20 hover:bg-white/15">
                Edit details
              </button>
              <button onClick={remove} className="rounded-xl px-3 py-2.5 text-sm font-semibold text-rose-200 hover:bg-rose-500/10">
                Delete
              </button>
            </div>
          </div>
          <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl bg-white/5 p-3 ring-1 ring-amber-200/20">
              <p className="text-[11px] font-bold uppercase tracking-widest text-amber-200/70">Questions</p>
              <p className="font-display text-2xl font-extrabold text-white">{questions.length}</p>
            </div>
            {levels.map(([l, n]) => (
              <div key={l} className="rounded-2xl bg-white/5 p-3 ring-1 ring-amber-200/20">
                <p className="text-[11px] font-bold uppercase tracking-widest text-amber-200/70">{l}</p>
                <p className="font-display text-2xl font-extrabold text-white">{n}</p>
              </div>
            ))}
          </div>
        </section>

        {shortages.length > 0 && a.status === "draft" && (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <b>Not enough questions matched in:</b> {shortages.map((x) => `${x.chapter} (${x.got}/${x.wanted})`).join(", ")}. Try more chapters, any difficulty or more question types.
          </div>
        )}
        {!editable && <div className="mt-4 rounded-2xl border border-[#e7dcc3] bg-[#fffdf8] px-4 py-3 text-sm text-slate-600">Students have started, so the questions are locked. You can still change the title, instructions and due date.</div>}

        {/* Edit details */}
        {editing && form && (
          <section className="gp-card mt-4 p-5 md:p-6">
            <h2 className="text-lg font-bold text-slate-900">Edit details</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="gp-label">Title</span>
                <input className={`${input} mt-1.5`} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </label>
              <label className="block">
                <span className="gp-label">Due date</span>
                <input type="datetime-local" className={`${input} mt-1.5`} value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} />
              </label>
              <label className="block">
                <span className="gp-label">College</span>
                <select className={`${input} mt-1.5`} value={form.college} onChange={(e) => setForm({ ...form, college: e.target.value })}>
                  {[...new Set([form.college, ...(opts?.colleges || [])])].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <div>
                <span className="gp-label">Sections</span>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  <button type="button" onClick={() => setForm({ ...form, sections: [] })} className={`rounded-xl border px-3 py-2 text-sm font-bold ${!form.sections.length ? "border-[#17140f] bg-[#17140f] text-[#e5c372]" : "border-[#e7dcc3] bg-white text-slate-700"}`}>
                    All
                  </button>
                  {["A", "B", "C", "D"].map((x) => {
                    const on = form.sections.includes(x);
                    return (
                      <button
                        key={x}
                        type="button"
                        onClick={() => setForm({ ...form, sections: on ? form.sections.filter((y) => y !== x) : [...form.sections, x] })}
                        className={`h-10 w-11 rounded-xl border text-sm font-bold ${on ? "border-[#17140f] bg-[#17140f] text-[#e5c372]" : "border-[#e7dcc3] bg-white text-slate-700"}`}
                      >
                        {x}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <label className="mt-4 block">
              <span className="gp-label">Instructions</span>
              <textarea className={`${input} mt-1.5 min-h-[80px]`} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} />
            </label>
            <div className="mt-4 flex gap-2">
              <button onClick={saveEdit} disabled={busy === "save"} className="gp-gold-btn px-5 py-2.5 text-sm">
                {busy === "save" ? "Saving…" : "Save"}
              </button>
              <button onClick={() => setEditing(false)} className="gp-ghost-btn px-4 py-2.5 text-sm font-semibold">
                Cancel
              </button>
            </div>
          </section>
        )}

        {/* Tabs */}
        <div className="mt-6 inline-flex rounded-full bg-white p-1 ring-1 ring-[#e7dcc3]" role="tablist">
          {[
            ["questions", `Questions (${questions.length})`],
            ["submissions", `Submissions (${a.submitted})`],
          ].map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${tab === k ? "bg-[#17140f] text-[#e5c372]" : "text-slate-600 hover:text-slate-900"}`}>
              {l}
            </button>
          ))}
        </div>

        {tab === "questions" && editable && !picking && (
          <button onClick={() => setPicking(true)} className="gp-gold-btn ml-3 px-4 py-2 text-sm">
            + Add questions
          </button>
        )}
        {tab === "questions" && editable && picking && <AssignmentPicker id={id} count={questions.length} selected={questions} onChange={load} onClose={() => setPicking(false)} />}

        {tab === "questions" ? (
          <div className="mt-4 space-y-3">
            {!questions.length && !picking && (
              <div className="gp-card grid place-items-center px-6 py-12 text-center">
                <p className="text-lg font-bold text-slate-900">No questions yet</p>
                <p className="mt-1 text-sm text-slate-500">Choose them from the question bank.</p>
                {editable && (
                  <button onClick={() => setPicking(true)} className="gp-gold-btn mt-4 px-5 py-2.5 text-sm">
                    + Add questions
                  </button>
                )}
              </div>
            )}
            
            {!(picking && editable) && questions.length > 0 && <PaperToolbar showSolutions={showSolutions} setShowSolutions={setShowSolutions} />}
            {!(picking && editable) &&
              questions.map((q, i) => (
                <PaperQuestionCard
                  key={q._id}
                  q={q}
                  number={i + 1}
                  solutionOpen={showSolutions}
                  editable={editable}
                  busy={busy === `swap-${q._id}` || busy === `rm-${q._id}`}
                  disabled={busy === "move"}
                  onUp={i > 0 ? () => move(i, -1) : null}
                  onDown={i < questions.length - 1 ? () => move(i, 1) : null}
                  onSwap={() => setSwapDialog(q)}
                  onRemove={() => removeQ(q)}
                />
              ))}
            {swapDialog && (
              <SwapDialog
                q={swapDialog}
                number={questions.findIndex((x) => x._id === swapDialog._id) + 1}
                subjectName={a.subject}
                loadChapters={() => api.get(`/lecturer/assignments/${id}/browse`, { params: { allChapters: 1 } }).then((r) => {
                  setSwapFormats(r.data.formats || []);
                  return r.data.chapters;
                })}
                formats={swapFormats}
                inPaper={new Set(questions.map((x) => String(x._id)))}
                loadCandidates={(c, pg) =>
                  api
                    .get(`/lecturer/assignments/${id}/browse`, {
                      params: { allChapters: 1, classLevel: c.classLevel || undefined, chapterId: c.chapterId || undefined, topicId: c.topicId || undefined, difficulty: c.difficulty || undefined, format: c.format || undefined, page: pg },
                    })
                    .then((r) => r.data)
                }
                onAuto={(c) => swapWith(swapDialog, { choices: c })}
                onPick={(n) => swapWith(swapDialog, { newQuestionId: n._id })}
                onClose={() => setSwapDialog(null)}
              />
            )}
            {a.status === "draft" && questions.length > 0 && (
              <div className="gp-card flex flex-wrap items-center justify-between gap-3 p-5">
                <p className="text-sm text-slate-600">
                  Happy with these <b>{questions.length}</b> questions?
                </p>
                <button onClick={publish} disabled={busy === "publish"} className="gp-gold-btn px-5 py-2.5 text-sm">
                  Publish to {a.college}
                  {a.sections?.length ? ` · ${a.sections.join(", ")}` : ""} →
                </button>
              </div>
            )}
          </div>
        ) : (
          <Submissions id={id} published={a.status === "published"} />
        )}
      </main>
    </LecturerLayout>
  );
}

function Submissions({ id, published }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const navigate = useNavigate();
  const { user } = useAuth();
  const canOpen = user?.role === "admin"; // the head lecturer can open each student's answers
  useEffect(() => {
    api
      .get(`/lecturer/assignments/${id}/submissions`)
      .then((res) => setData(res.data))
      .catch((err) => setError(getErrorMessage(err)));
  }, [id]);

  if (error) return <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>;
  if (!data) return <div className="gp-card mt-4 h-48 animate-pulse bg-white/60" />;
  const { stats, rows } = data;
  const shown = filter === "all" ? rows : rows.filter((r) => r.status === filter);
  const pct = stats.total ? Math.round((stats.submitted / stats.total) * 100) : 0;

  return (
    <div className="mt-4 space-y-4">
      {!published && <p className="rounded-2xl border border-[#e7dcc3] bg-[#fffdf8] px-4 py-3 text-sm text-slate-600">This is still a draft. Students see it once you publish.</p>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["all", "Students", stats.total, "text-slate-900"],
          ["submitted", "Handed in", stats.submitted, "text-emerald-700"],
          ["in_progress", "Started", stats.inProgress, "text-indigo-700"],
          ["not_started", "Not started", stats.notStarted, "text-rose-700"],
        ].map(([k, l, v, c]) => (
          <button key={k} onClick={() => setFilter(k)} className={`gp-card p-4 text-left transition ${filter === k ? "ring-2 ring-[#c9a24a]" : "hover:ring-1 hover:ring-[#e7dcc3]"}`}>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{l}</p>
            <p className={`mt-1 font-display text-3xl font-extrabold tabular-nums ${c}`}>{v}</p>
          </button>
        ))}
      </div>
      <div className="gp-card p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-slate-700">Handed in</span>
          <span className="font-display font-bold text-slate-900">{pct}%</span>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#f3ecdc]">
          <div className="h-full rounded-full bg-gradient-to-r from-[#e5c372] to-[#b8862b]" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="gp-card overflow-hidden">
        {!shown.length ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">{rows.length ? "No students here." : "No students in this college and section yet. Students set their college and section when they sign up."}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="bg-[#17140f] text-left text-xs uppercase tracking-wider text-[#e5c372]">
                  <th className="px-4 py-3">Student</th>
                  <th className="px-3 py-3">Sec</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3 text-right">Score</th>
                  <th className="px-3 py-3 text-center">✓ / ✗ / –</th>
                  <th className="px-3 py-3 text-right">Time</th>
                  <th className="px-4 py-3 text-right">Handed in</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r, i) => {
                  const st = STATE[r.status] || STATE.not_started;
                  return (
                    <tr
                      key={r.student._id}
                      {...(canOpen && r.attemptId && r.score != null ? { ...rowLink(navigate, `/admin/attempts/${r.attemptId}`), title: "Open this student's answers" } : {})}
                      className={`${i % 2 ? "bg-[#fffdf8]" : "bg-white"} ${canOpen && r.attemptId && r.score != null ? ROW_CLICK : ""}`}
                    >
                      <td className="px-4 py-2.5">
                        <p className="font-semibold text-slate-900">{r.student.name}</p>
                        <p className="text-xs text-slate-500">{r.student.email}</p>
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-slate-700">{r.student.section || "—"}</td>
                      <td className="px-3 py-2.5">
                        <Pill cls={st.cls}>{st.label}</Pill>
                      </td>
                      <td className="px-3 py-2.5 text-right font-display font-bold tabular-nums text-slate-900">{r.score === null ? "—" : `${r.score}/${r.maxScore}`}</td>
                      <td className="px-3 py-2.5 text-center tabular-nums">
                        {r.status === "submitted" ? (
                          <>
                            <span className="text-emerald-700">{r.correct}</span> / <span className="text-rose-700">{r.wrong}</span> / <span className="text-slate-500">{r.skipped}</span>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right text-slate-600">{r.timeTakenSec ? fmtDuration(r.timeTakenSec) : "—"}</td>
                      <td className="px-4 py-2.5 text-right text-slate-600">{r.submittedAt ? fmtDateTime(r.submittedAt) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
