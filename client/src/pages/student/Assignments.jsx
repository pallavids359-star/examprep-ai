import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api, { getErrorMessage } from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import { Hero, ICONS, Stat } from "../../components/premium";
import { toast } from "../../components/Toaster";
import { fmtDateTime, fmtUntil } from "../../components/liveHelpers";
import { Pill, STATE } from "../../components/assignmentHelpers";
import { rowLink } from "../../components/uiHelpers";

// Student: assignments from my lecturers
export default function Assignments() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [list, setList] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    api
      .get("/assignments")
      .then((res) => setList(res.data.assignments))
      .catch((err) => setError(getErrorMessage(err)));
  }, []);

  const start = async (a) => {
    setBusy(a._id);
    try {
      const res = await api.post(`/assignments/${a._id}/start`);
      navigate(`/attempt/${res.data.attemptId}`);
    } catch (err) {
      toast(getErrorMessage(err), "error");
      setBusy("");
    }
  };

  const todo = (list || []).filter((a) => a.state === "open" || a.state === "in_progress");
  const done = (list || []).filter((a) => a.state === "submitted");
  const missed = (list || []).filter((a) => a.state === "missed" || a.state === "late");
  const avg = done.length ? Math.round(done.reduce((n, a) => n + (a.result.maxScore ? (a.result.score / a.result.maxScore) * 100 : 0), 0) / done.length) : null;

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 md:px-8 md:py-8">
      <Hero
        eyebrow={user?.college ? `${user.college}${user.section ? ` · Section ${user.section}` : ""}` : "From your lecturers"}
        title="Assignments"
        subtitle={todo.length ? `${todo.length} to finish. No timer — answer at your own pace before the due date.` : "No timer — answer at your own pace before the due date."}
      />

      {!user?.college && (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Your college isn't set, so assignments can't reach you. Ask your lecturer or admin to add your college and section.
        </div>
      )}

      {list && list.length > 0 && (
        <div className="mt-5 grid grid-cols-3 gap-3 md:gap-4">
          <Stat label="To do" value={todo.length} sub="before the due date" icon={ICONS.book} accent />
          <Stat label="Handed in" value={done.length} sub="assignments" icon={ICONS.check} />
          <Stat label="Average" value={avg === null ? "—" : `${avg}%`} sub="of the marks" icon={ICONS.target} />
        </div>
      )}

      {error && <div className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {!list && !error && (
        <div className="mt-6 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {[0, 1].map((i) => (
            <div key={i} className="gp-card h-36 animate-pulse bg-white/60" />
          ))}
        </div>
      )}
      {list && list.length === 0 && (
        <div className="gp-card mt-6 grid place-items-center px-6 py-14 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-amber-50 text-amber-700">
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={ICONS.sparkle} />
            </svg>
          </span>
          <h2 className="mt-4 text-xl font-bold text-slate-900">No assignments yet</h2>
          <p className="mt-1 max-w-md text-sm text-slate-500">When a lecturer gives your class an assignment, it shows up here.</p>
        </div>
      )}

      {todo.length > 0 && (
        <Group title="To do">
          {todo.map((a) => {
            const soon = new Date(a.dueAt) - Date.now() < 86400e3;
            return (
              <Row key={a._id} a={a}>
                <p className={`text-xs font-semibold ${soon ? "text-rose-700" : "text-amber-800"}`}>Due {fmtUntil(a.dueAt)}</p>
                <button onClick={() => start(a)} disabled={busy === a._id} className="gp-gold-btn mt-2 px-5 py-2.5 text-sm disabled:opacity-60">
                  {busy === a._id ? "Opening…" : a.state === "in_progress" ? "Continue →" : "Start →"}
                </button>
              </Row>
            );
          })}
        </Group>
      )}

      {done.length > 0 && (
        <Group title="Handed in">
          {done.map((a) => {
            const p = a.result.maxScore ? Math.round((a.result.score / a.result.maxScore) * 100) : 0;
            return (
              <Row key={a._id} a={a} to={`/result/${a.attemptId}`}>
                <p className="font-display text-2xl font-extrabold tabular-nums text-slate-900">
                  {a.result.score}
                  <span className="text-sm font-semibold text-slate-400">/{a.result.maxScore}</span>
                </p>
                <p className="text-xs text-slate-500">
                  <span className="text-emerald-700">{a.result.correct} ✓</span> · <span className="text-rose-700">{a.result.wrong} ✗</span> · {a.result.skipped} skipped · {p}%
                </p>
                <Link to={`/result/${a.attemptId}`} className="gp-ghost-btn mt-2 inline-block px-4 py-2 text-sm font-semibold">
                  See answers
                </Link>
              </Row>
            );
          })}
        </Group>
      )}

      {missed.length > 0 && (
        <Group title="Missed">
          {missed.map((a) => (
            <Row key={a._id} a={a}>
              <p className="text-xs text-slate-500">Was due {fmtDateTime(a.dueAt)}</p>
            </Row>
          ))}
        </Group>
      )}
    </div>
  );
}

function Group({ title, children }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      <div className="mt-3 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">{children}</div>
    </section>
  );
}

function Row({ a, to, children }) {
  const st = STATE[a.state] || STATE.open;
  const navigate = useNavigate();
  return (
    <div {...rowLink(navigate, to)} className={`gp-card flex items-start gap-4 p-5 ${to ? "cursor-pointer transition hover:-translate-y-0.5 hover:shadow-lg" : ""}`}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="gp-chip">{a.subject}</span>
          <Pill cls={st.cls}>{st.label}</Pill>
        </div>
        <p className="mt-2 text-lg font-bold leading-snug text-slate-900">{a.title}</p>
        <p className="mt-0.5 text-sm text-slate-500">
          {a.questions} questions{a.createdBy ? ` · ${a.createdBy}` : ""}
        </p>
        <p className="mt-0.5 text-xs text-slate-400">Due {fmtDateTime(a.dueAt)}</p>
      </div>
      <div className="shrink-0 text-right">{children}</div>
    </div>
  );
}
