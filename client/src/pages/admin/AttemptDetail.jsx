import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api, { getErrorMessage } from "../../api/axios";
import AdminLayout from "../../components/AdminLayout";
import QuestionBody from "../../components/QuestionBody";
import { fmtDateTime, fmtDuration } from "../../components/liveHelpers";
import { Donut, ICONS, Ring, Stat } from "../../components/premium";

const STATUS = {
  correct: { label: "Correct", color: "#1f8a4c", cls: "bg-green-50 text-green-800 ring-green-200" },
  wrong: { label: "Wrong", color: "#e07a1f", cls: "bg-orange-50 text-orange-800 ring-orange-200" },
  skipped: { label: "Seen, not answered", color: "#a8987a", cls: "bg-slate-100 text-slate-700 ring-slate-200" },
  not_visited: { label: "Never opened", color: "#e7dcc3", cls: "bg-slate-50 text-slate-500 ring-slate-200" },
  answered: { label: "Answered (still writing)", color: "#d2a446", cls: "bg-amber-50 text-amber-800 ring-amber-200" },
};

// Admin: one student's attempt, question by question
export default function AttemptDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [section, setSection] = useState("all");
  const [showSolutions, setShowSolutions] = useState(false);

  useEffect(() => {
    api
      .get(`/admin/attempts/${id}`)
      .then((res) => setData(res.data))
      .catch((err) => setError(getErrorMessage(err)));
  }, [id]);

  const sections = useMemo(() => [...new Set((data?.questions || []).map((q) => q.section).filter(Boolean))], [data]);
  const shown = (data?.questions || []).filter(
    (q) => (section === "all" || q.section === section) && (filter === "all" || (filter === "marked" ? q.markedForReview : q.status === filter))
  );

  if (error || !data) {
    return (
      <AdminLayout title="Answers">
        {error ? <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : <div className="gp-card h-64 animate-pulse bg-white/60" />}
      </AdminLayout>
    );
  }

  const s = data.summary;
  const total = data.questions.length;
  const answered = s.correct + s.wrong;

  return (
    <AdminLayout>
      <nav className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
        {data.student && (
          <Link to={`/admin/students/${data.student._id}`} className="font-semibold text-amber-800 hover:underline">
            {data.student.name}
          </Link>
        )}
        <span>/</span>
        <span className="font-semibold text-slate-800">{data.title}</span>
      </nav>

      <section className="gp-hero mt-3 p-6 md:p-8">
        <div className="relative flex flex-wrap items-center justify-between gap-8">
          <div className="min-w-0 max-w-xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-bold text-amber-200">{data.exam}</span>
              <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-semibold text-amber-100/90">{data.modeLabel}</span>
              {data.status === "in_progress" && <span className="rounded-full bg-green-400/15 px-2.5 py-0.5 text-xs font-semibold text-green-300">Still writing</span>}
              {data.status === "auto_submitted" && <span className="rounded-full bg-orange-400/15 px-2.5 py-0.5 text-xs font-semibold text-orange-300">Time ran out</span>}
            </div>
            <h1 className="mt-2 text-2xl font-extrabold text-white md:text-3xl">{data.student?.name || "Deleted account"}</h1>
            <p className="gp-muted text-sm">{data.student?.email}</p>
            <p className="gp-muted mt-1 text-sm">
              {data.title} · {fmtDateTime(data.startedAt)}
              {data.submittedAt ? ` → ${fmtDateTime(data.submittedAt)}` : ""}
            </p>
            <div className="mt-6 flex flex-wrap items-end gap-8">
              {s.score !== null && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-amber-200/70">Score</p>
                  <p className="font-display text-4xl font-extrabold">
                    <span className="gp-gold-text">{s.score}</span>
                    <span className="text-xl text-amber-100/60"> / {s.maxScore}</span>
                  </p>
                </div>
              )}
              {data.rank && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-amber-200/70">Rank</p>
                  <p className="font-display text-4xl font-extrabold text-white">
                    #{data.rank.rank}
                    <span className="text-xl text-amber-100/60"> of {data.rank.total}</span>
                  </p>
                </div>
              )}
            </div>
          </div>
          <Ring value={s.percentage || 0} size={150} stroke={12} dark label={`${s.percentage ?? 0}%`} sub="of total marks" />
        </div>
      </section>

      <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Correct" value={s.correct} sub={`of ${total} questions`} icon={ICONS.check} accent />
        <Stat label="Wrong" value={s.wrong} sub={`accuracy ${s.accuracy ?? (answered ? Math.round((s.correct / answered) * 100) : 0)}%`} icon={ICONS.target} />
        <Stat label="Not answered" value={s.skipped + s.notVisited} sub={`${s.notVisited} never opened`} icon={ICONS.book} />
        <Stat label="Time used" value={fmtDuration(s.timeTakenSec)} sub={`${s.marked} marked for review`} icon={ICONS.clock} />
      </div>

      <section className="gp-card mt-5 flex flex-wrap items-center gap-8 p-6">
        <Donut
          size={160}
          center={total}
          centerSub="questions"
          parts={["correct", "wrong", "skipped", "not_visited"].map((k) => ({ label: STATUS[k].label, value: data.questions.filter((q) => q.status === k).length, color: STATUS[k].color }))}
        />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-slate-900">By subject</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {sections.map((name) => {
              const list = data.questions.filter((q) => q.section === name);
              const c = list.filter((q) => q.status === "correct").length;
              const w = list.filter((q) => q.status === "wrong").length;
              return (
                <button key={name} type="button" onClick={() => setSection(section === name ? "all" : name)} className={`gp-tile p-3 text-left`} aria-pressed={section === name}>
                  <p className="font-bold text-slate-900">{name}</p>
                  <p className="text-sm text-slate-600">
                    <span className="text-green-700">{c} right</span> · <span className="text-orange-700">{w} wrong</span> · {list.length - c - w} blank
                  </p>
                  <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="bg-green-600" style={{ width: `${(c / list.length) * 100}%` }} />
                    <div className="bg-orange-500" style={{ width: `${(w / list.length) * 100}%` }} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Question by question */}
      <section className="mt-6">
        <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center justify-between gap-3 bg-[#f7f2e8]/90 px-1 py-3 backdrop-blur">
          <div className="flex flex-wrap gap-1.5">
            {[
              ["all", "All", total],
              ["wrong", "Wrong", s.wrong],
              ["correct", "Correct", s.correct],
              ["skipped", "Not answered", s.skipped],
              ["not_visited", "Never opened", s.notVisited],
              ["marked", "Marked", s.marked],
            ].map(([k, l, n]) => (
              <button
                key={k}
                type="button"
                onClick={() => setFilter(k)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${filter === k ? "bg-slate-900 text-amber-200" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:ring-amber-300"}`}
              >
                {l} <span className="opacity-60">{n}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            {section !== "all" && (
              <button type="button" onClick={() => setSection("all")} className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
                {section} ✕
              </button>
            )}
            <button type="button" onClick={() => setShowSolutions((v) => !v)} className="text-sm font-semibold text-amber-800 hover:underline">
              {showSolutions ? "Hide solutions" : "Show solutions"}
            </button>
          </div>
        </div>

        {shown.length === 0 && <p className="gp-card mt-3 p-8 text-center text-sm text-slate-500">No questions here.</p>}
        <div className="mt-2 space-y-4">
          {shown.map((q) => {
            const st = STATUS[q.status] || STATUS.not_visited;
            return (
              <article key={q.number} className="gp-card overflow-hidden">
                <div className="flex flex-wrap items-center gap-2 border-b border-amber-100 bg-amber-50/50 px-5 py-2.5 text-xs">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-slate-900 text-xs font-extrabold text-amber-200">{q.number}</span>
                  <span className={`rounded-full px-2.5 py-0.5 font-semibold ring-1 ${st.cls}`}>{st.label}</span>
                  {q.markedForReview && <span className="rounded-full bg-violet-50 px-2.5 py-0.5 font-semibold text-violet-800 ring-1 ring-violet-200">Marked</span>}
                  <span className="font-semibold text-slate-700">{q.section}</span>
                  <span className="text-slate-500">
                    · {q.chapter}
                    {q.topic ? ` · ${q.topic}` : ""}
                  </span>
                  <span className="ml-auto flex items-center gap-3 text-slate-500">
                    <span>⏱ {fmtDuration(q.timeSpentSec)}</span>
                    <span className={`font-bold ${q.marksAwarded > 0 ? "text-green-700" : q.marksAwarded < 0 ? "text-orange-700" : "text-slate-500"}`}>
                      {q.marksAwarded > 0 ? `+${q.marksAwarded}` : q.marksAwarded}
                    </span>
                  </span>
                </div>
                <div className="p-5">
                  <QuestionBody
                    key={`${q.number}-${showSolutions}`}
                    q={q}
                    chosen={q.selectedOptionIds}
                    numericalValue={q.numericalValue}
                    solutionOpen={showSolutions}
                    who="Student's"
                    compact
                  />
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </AdminLayout>
  );
}
