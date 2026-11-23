import { useEffect, useMemo, useState } from "react";
import BackLink from "../../components/BackLink";
import { Link, useParams } from "react-router-dom";
import api, { getErrorMessage } from "../../api/axios";
import QuestionBody from "../../components/QuestionBody";
import Scorecard, { downloadScorecard, scorecardRows } from "../../components/Scorecard";
import { useAuth } from "../../context/AuthContext";
import { fmtDateTime, fmtDuration, preview } from "../../components/liveHelpers";
import { Donut, ICONS, Ring, Stat } from "../../components/premium";

// Live test report: every number about the student's attempt, question by question
const STATUS = {
  correct: { label: "Correct", short: "✓ Correct", text: "text-green-700", bar: "bg-green-600", chip: "bg-green-50 text-green-800" },
  wrong: { label: "Wrong", short: "✗ Wrong", text: "text-orange-700", bar: "bg-orange-500", chip: "bg-orange-50 text-orange-800" },
  skipped: { label: "Seen, skipped", short: "– Skipped", text: "text-slate-600", bar: "bg-slate-400", chip: "bg-slate-100 text-slate-700" },
  not_visited: { label: "Never opened", short: "Never opened", text: "text-slate-500", bar: "bg-slate-200", chip: "bg-slate-50 text-slate-600" },
};
const FILTERS = [
  ["all", "All"],
  ["wrong", "Wrong"],
  ["skipped", "Skipped"],
  ["not_visited", "Never opened"],
  ["marked", "Marked for review"],
  ["correct", "Correct"],
];

const answerText = (q, mine) => {
  if (q.type === "numerical" || !(q.options || []).length) return mine ? (q.numericalValue ?? "–") : (q.correctNumericalValue ?? "–");
  const ids = mine ? q.selectedOptionIds || [] : q.correctOptionIds || [];
  return ids.length ? ids.join(", ") : "–";
};

// Also used by the admin to see one student's report: pass studentId (and the page's own back link).
export default function LiveReport({ testId, studentId, backTo, backLabel } = {}) {
  const params = useParams();
  const id = testId || params.id;
  const admin = Boolean(studentId);
  const { user: me } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [section, setSection] = useState("all");
  const [chartSection, setChartSection] = useState(null);
  const [openNo, setOpenNo] = useState(null);

  useEffect(() => {
    api
      .get(admin ? `/admin/live-tests/${id}/report/${studentId}` : `/live-tests/${id}/report`)
      .then((res) => {
        setData(res.data);
        if (res.data.sections?.length) setChartSection(res.data.sections[0].name);
      })
      .catch((err) => setError(getErrorMessage(err)));
  }, [id, admin, studentId]);

  const questions = useMemo(() => data?.questions || [], [data]);
  const shown = useMemo(
    () =>
      questions.filter(
        (q) => (section === "all" || q.section === section) && (filter === "all" || (filter === "marked" ? q.markedForReview : q.status === filter))
      ),
    [questions, filter, section]
  );
  const chartQs = questions.filter((q) => q.section === chartSection);
  const maxTime = Math.max(1, ...chartQs.map((q) => q.timeSpentSec));
  const longest = chartQs.reduce((a, q) => (!a || q.timeSpentSec > a.timeSpentSec ? q : a), null);

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        <BackLink to={backTo || "/live-tests"}>{backLabel || "Live tests"}</BackLink>
      </div>
    );
  }
  if (!data) return <p className="px-4 py-10 text-center text-sm text-slate-500">Loading your report...</p>;

  const t = data.test;
  const back = (
    <BackLink to={backTo || "/live-tests"}>{backLabel || "Live tests"}</BackLink>
  );

  if (data.state === "in_progress") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        {back}
        <h1 className="mt-3 text-2xl font-bold text-slate-900">{t.title}</h1>
        <p className="mt-2 text-slate-600">You are still writing this test.</p>
        <Link to={`/attempt/${data.attemptId}`} className="mt-4 inline-block rounded-lg bg-indigo-600 px-5 py-2.5 font-semibold text-white">
          Continue the test
        </Link>
      </div>
    );
  }
  if (data.state === "waiting") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        {back}
        <h1 className="mt-3 text-2xl font-bold text-slate-900">{t.title}</h1>
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-6">
          <p className="text-lg font-semibold text-slate-900">Your answers are submitted ✓</p>
          <p className="mt-1 text-slate-600">
            Results and ranks come out when the test closes, on <b>{fmtDateTime(data.resultsAt)}</b>, so that everyone is ranked together.
          </p>
        </div>
      </div>
    );
  }
  if (data.state === "missed") {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        {back}
        <h1 className="mt-3 text-2xl font-bold text-slate-900">{t.title}</h1>
        <p className="mt-1 text-slate-600">You didn't take this test. Here are its questions with answers and solutions.</p>
        <div className="mt-6 space-y-4">
          {data.paper.map((q) => (
            <article key={q.number} className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="mb-2 text-sm font-semibold text-slate-500">
                Q{q.number} · {q.section} · {q.chapter}
              </p>
              <QuestionBody q={q} solutionOpen={false} compact />
            </article>
          ))}
        </div>
      </div>
    );
  }

  // ---------- Full report ----------
  const s = data.summary;
  const r = data.rank;
  const answeredCount = s.correct + s.wrong;
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {back}
        <button type="button" onClick={downloadScorecard} className="gp-gold-btn inline-flex items-center gap-2 px-5 py-2.5 text-sm print:hidden">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
          </svg>
          Download result
        </button>
      </div>

      {/* Score hero */}
      <section className="gp-hero mt-4 p-6 md:p-8">
        <div className="relative flex flex-wrap items-center justify-between gap-8">
          <div className="min-w-0 max-w-xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-200/80">{admin && data.student ? `${data.student.name} · live test report` : "Live test report"}</p>
            <h1 className="mt-2 text-2xl font-extrabold text-white md:text-3xl">{t.title}</h1>
            <p className="gp-muted mt-2 text-sm">
              Taken {fmtDateTime(data.startedAt)} – {fmtDateTime(data.submittedAt)}
              {data.autoSubmitted ? " · submitted automatically when time ran out" : ""}
            </p>
            <div className="mt-6 flex flex-wrap items-end gap-8">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-amber-200/70">Score</p>
                <p className="font-display text-5xl font-extrabold">
                  <span className="gp-gold-text">{s.score}</span>
                  <span className="text-2xl text-amber-100/60"> / {s.maxScore}</span>
                </p>
              </div>
              {r && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-amber-200/70">Rank</p>
                  <p className="font-display text-5xl font-extrabold text-white">
                    #{r.rank}
                    <span className="text-2xl text-amber-100/60"> of {r.totalCandidates}</span>
                  </p>
                </div>
              )}
            </div>
            {r && <p className="mt-3 text-sm text-amber-100/80">{admin ? "Did" : "You did"} better than {r.percentile}% of everyone who took it.</p>}
            <div className="mt-5 flex flex-wrap gap-2">
              {admin && (
                <Link to={`/admin/live-tests/${t._id}/results`} className="gp-gold-btn inline-block px-5 py-2.5 text-sm">
                  See the leaderboard →
                </Link>
              )}
            </div>
          </div>
          <Ring value={s.percentage || 0} size={170} stroke={14} dark label={`${s.percentage ?? 0}%`} sub="of total marks" />
        </div>
      </section>

      <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Accuracy" value={`${s.accuracy ?? 0}%`} sub={`${s.correct} right of ${answeredCount} answered`} icon={ICONS.target} />
        <Stat label="Time used" value={fmtDuration(s.timeTakenSec)} sub={`≈ ${fmtDuration(questions.length ? s.timeTakenSec / questions.length : 0)} per question`} icon={ICONS.clock} />
        <Stat label="Lost to wrong answers" value={s.negativeMarks || 0} sub={`${s.wrong} wrong answer${s.wrong === 1 ? "" : "s"}`} icon={ICONS.bolt} />
        <Stat label="Marked for review" value={s.marked} sub={`${s.markedAnswered} of them answered`} icon={ICONS.book} />
      </div>

      {/* Every question at a glance */}
      <section className="gp-card mt-5 flex flex-wrap items-center gap-8 p-6">
        <Donut
          size={170}
          center={questions.length}
          centerSub="questions"
          parts={[
            { label: "Correct", value: s.correct, color: "#1f8a4c" },
            { label: "Wrong", value: s.wrong, color: "#e07a1f" },
            { label: "Seen but skipped", value: s.skipped, color: "#a8987a" },
            { label: "Never opened", value: s.notVisited, color: "#e7dcc3" },
          ]}
        />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-slate-900">Every question at a glance</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {[
              ["Correct", s.correct, "#1f8a4c", "correct"],
              ["Wrong", s.wrong, "#e07a1f", "wrong"],
              ["Seen but skipped", s.skipped, "#a8987a", "skipped"],
              ["Never opened", s.notVisited, "#e7dcc3", "not_visited"],
            ].map(([l, n, c, k]) => (
              <li key={l}>
                <button
                  type="button"
                  onClick={() => {
                    setFilter(k);
                    setSection("all");
                    document.getElementById("qbq")?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="flex w-full items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-left hover:border-amber-300"
                >
                  <span className="h-3 w-3 rounded-full" style={{ background: c }} />
                  <span className="flex-1 text-sm text-slate-700">{l}</span>
                  <span className="font-display text-xl font-extrabold tabular-nums text-slate-900">{n}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Subjects */}
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.sections.map((x) => (
          <div key={x.name} className="gp-card flex items-center gap-4 p-5">
            <Ring value={x.maxScore ? Math.max(0, (x.score / x.maxScore) * 100) : 0} size={72} />
            <div className="min-w-0">
              <p className="font-bold text-slate-900">{x.name}</p>
              <p className="text-sm text-slate-600">
                {x.score} / {x.maxScore} · <span className="text-green-700">{x.correct}✓</span> <span className="text-orange-700">{x.wrong}✗</span> · {fmtDuration(x.timeSec)}
              </p>
              {x.weakestChapter && <p className="mt-0.5 truncate text-xs text-slate-500">Work on: {x.weakestChapter.name}</p>}
            </div>
          </div>
        ))}
      </div>

      {/* By section */}
      <section className="mt-5 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">By subject</h2>
        <table className="mt-3 w-full min-w-[680px] text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="py-2 pr-3">Subject</th>
              <th className="py-2 pr-3">Marks</th>
              <th className="py-2 pr-3">Correct</th>
              <th className="py-2 pr-3">Wrong</th>
              <th className="py-2 pr-3">Skipped</th>
              <th className="py-2 pr-3">Time</th>
              <th className="py-2">Weakest chapter</th>
            </tr>
          </thead>
          <tbody>
            {data.sections.map((x) => (
              <tr key={x.name} className="border-t border-slate-100">
                <td className="py-2.5 pr-3 font-semibold text-slate-900">{x.name}</td>
                <td className="py-2.5 pr-3 tabular-nums">
                  {x.score} / {x.maxScore}
                </td>
                <td className="py-2.5 pr-3 tabular-nums text-green-700">{x.correct}</td>
                <td className="py-2.5 pr-3 tabular-nums text-orange-700">{x.wrong}</td>
                <td className="py-2.5 pr-3 tabular-nums">{x.skipped + x.notVisited}</td>
                <td className="py-2.5 pr-3">{fmtDuration(x.timeSec)}</td>
                <td className="py-2.5 text-slate-700">{x.weakestChapter ? `${x.weakestChapter.name} (${x.weakestChapter.correct} of ${x.weakestChapter.total})` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Time on each question */}
      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-slate-900">Time on each question</h2>
          <div className="flex flex-wrap gap-1.5">
            {data.sections.map((x) => (
              <button
                key={x.name}
                type="button"
                onClick={() => setChartSection(x.name)}
                className={`rounded-full border px-3 py-1 text-sm font-medium ${chartSection === x.name ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-slate-300 text-slate-700"}`}
              >
                {x.name}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-600">
          {["correct", "wrong", "skipped", "not_visited"].map((k) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className={`inline-block h-2.5 w-2.5 rounded-sm ${STATUS[k].bar}`} />
              {STATUS[k].label}
            </span>
          ))}
        </div>
        <div className="mt-4 overflow-x-auto">
          <div className="flex h-44 min-w-[480px] items-end gap-1 border-b border-slate-200" role="img" aria-label={`Seconds spent on each ${chartSection} question`}>
            {chartQs.map((q) => (
              <button
                key={q.number}
                type="button"
                title={`Q${q.number}: ${fmtDuration(q.timeSpentSec)} · ${STATUS[q.status].label}`}
                onClick={() => {
                  setFilter("all");
                  setSection("all");
                  setOpenNo(q.number);
                  setTimeout(() => document.getElementById(`lq-${q.number}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
                }}
                className={`flex-1 rounded-t ${STATUS[q.status].bar} hover:opacity-80`}
                style={{ height: `${Math.max(3, Math.round((q.timeSpentSec / maxTime) * 100))}%` }}
              >
                <span className="sr-only">Question {q.number}</span>
              </button>
            ))}
          </div>
          <div className="flex min-w-[480px] gap-1 pt-1 text-[10px] text-slate-500">
            {chartQs.map((q) => (
              <span key={q.number} className="flex-1 text-center">
                {q.number}
              </span>
            ))}
          </div>
        </div>
        {longest && (
          <p className="mt-2 text-sm text-slate-600">
            Longest: Q{longest.number} ({fmtDuration(longest.timeSpentSec)}, {STATUS[longest.status].label.toLowerCase()}). Click a bar to open that question.
          </p>
        )}
      </section>

      {/* Question by question */}
      <section id="qbq" className="mt-6 scroll-mt-6 overflow-hidden rounded-2xl bg-white ring-1 ring-[#e7dcc3]">
        {/* Title and filters */}
        <div className="border-b border-[#efe6d2] px-5 pb-4 pt-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Question by question</h2>
              <p className="text-sm text-slate-500">Tap a question to see it with your answer, the right answer and the solution.</p>
            </div>
            {data.sections.length > 1 && (
              <div className="flex rounded-xl bg-[#f7f3ea] p-1 ring-1 ring-[#e7dcc3]" role="radiogroup" aria-label="Subject">
                {["all", ...data.sections.map((x) => x.name)].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={section === n}
                    onClick={() => setSection(n)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${section === n ? "bg-white text-slate-900 shadow-sm ring-1 ring-[#e7dcc3]" : "text-slate-500 hover:text-slate-900"}`}
                  >
                    {n === "all" ? "All" : n}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {FILTERS.map(([k, l]) => {
              const n = k === "all" ? questions.length : k === "marked" ? questions.filter((q) => q.markedForReview).length : questions.filter((q) => q.status === k).length;
              const on = filter === k;
              const dot = { correct: "bg-green-600", wrong: "bg-orange-500", skipped: "bg-slate-400", not_visited: "bg-slate-300", marked: "bg-violet-500" }[k];
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setFilter(k)}
                  className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-medium transition ${on ? "bg-[#17140f] text-white" : "bg-[#fbf8f1] text-slate-600 ring-1 ring-[#efe6d2] hover:ring-[#c9a24a]"}`}
                >
                  {dot && <span className={`h-2 w-2 rounded-full ${dot}`} />}
                  {l}
                  <span className={`rounded-md px-1.5 text-xs font-semibold tabular-nums ${on ? "bg-white/15 text-[#e5c372]" : "bg-[#f1e9d6] text-slate-700"}`}>{n}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="bg-[#fbf8f1] text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="w-16 px-5 py-3">Q</th>
                <th className="py-3 pr-3">Chapter · concept</th>
                <th className="py-3 pr-3">Result</th>
                <th className="py-3 pr-3">You → Correct</th>
                <th className="py-3 pr-3">Your time</th>
                <th className="py-3 pr-3">Batch got it right</th>
                <th className="py-3 pr-3 text-right">Marks</th>
                <th className="w-10 py-3 pr-5" />
              </tr>
            </thead>
            <tbody>
              {shown.map((q) => {
                const st = STATUS[q.status];
                const isOpen = openNo === q.number;
                const mine = answerText(q, true);
                const right = answerText(q, false);
                const numBg = { correct: "bg-green-600 text-white", wrong: "bg-orange-500 text-white", skipped: "bg-slate-200 text-slate-700", not_visited: "bg-slate-100 text-slate-400" }[q.status];
                return (
                  <FragmentRow key={q.number}>
                    <tr
                      id={`lq-${q.number}`}
                      onClick={() => setOpenNo(isOpen ? null : q.number)}
                      className={`cursor-pointer border-t border-[#f4eee0] transition hover:bg-[#fbf8f1] ${isOpen ? "bg-[#fbf8f1]" : ""}`}
                    >
                      <td className="px-5 py-3">
                        <button type="button" aria-expanded={isOpen} className={`grid h-8 w-8 place-items-center rounded-lg text-xs font-bold tabular-nums ${numBg}`}>
                          {q.number}
                        </button>
                      </td>
                      <td className="py-3 pr-3">
                        <p className="font-medium text-slate-900">{q.chapter}</p>
                        <p className="text-xs text-slate-500">
                          {q.section}
                          {q.topic && q.topic !== q.chapter ? ` · ${q.topic}` : ""}
                        </p>
                      </td>
                      <td className="py-3 pr-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.chip}`}>{st.label}</span>
                        {q.markedForReview && <span className="ml-1.5 rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-800">Marked</span>}
                      </td>
                      <td className="py-3 pr-3">
                        <span className="inline-flex items-center gap-1.5 tabular-nums">
                          <span className={`grid h-7 min-w-7 place-items-center rounded-full px-1.5 text-xs font-bold ${q.status === "correct" ? "bg-green-50 text-green-800 ring-1 ring-green-200" : q.status === "wrong" ? "bg-orange-50 text-orange-800 ring-1 ring-orange-200" : "bg-slate-50 text-slate-400 ring-1 ring-slate-200"}`}>
                            {mine === "–" || mine === "" ? "–" : mine}
                          </span>
                          <span className="text-slate-300">→</span>
                          <span className="grid h-7 min-w-7 place-items-center rounded-full bg-[#17140f] px-1.5 text-xs font-bold text-[#e5c372]">{right}</span>
                        </span>
                      </td>
                      <td className="py-3 pr-3 tabular-nums">
                        <p className="font-medium text-slate-900">{fmtDuration(q.timeSpentSec)}</p>
                        {q.batch && <p className="text-xs text-slate-400">avg {fmtDuration(q.batch.avgTimeSec)}</p>}
                      </td>
                      <td className="py-3 pr-3">
                        {q.batch?.correctPct != null ? (
                          <span className="flex items-center gap-2">
                            <span className="h-1.5 w-16 overflow-hidden rounded-full bg-[#f1e9d6]">
                              <span className="block h-full rounded-full bg-[#c9a24a]" style={{ width: `${q.batch.correctPct}%` }} />
                            </span>
                            <span className="text-xs tabular-nums text-slate-600">{q.batch.correctPct}%</span>
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className={`py-3 pr-3 text-right font-display font-extrabold tabular-nums ${q.marksAwarded > 0 ? "text-green-700" : q.marksAwarded < 0 ? "text-orange-700" : "text-slate-400"}`}>
                        {q.marksAwarded > 0 ? `+${q.marksAwarded}` : q.marksAwarded}
                      </td>
                      <td className="py-3 pr-5 text-slate-400">
                        <svg viewBox="0 0 24 24" className={`h-4 w-4 transition ${isOpen ? "rotate-90 text-slate-900" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M9 18l6-6-6-6" />
                        </svg>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={8} className="border-t border-[#f4eee0] bg-[#fbf8f1] px-5 py-4">
                          <div className="rounded-xl bg-white p-5 ring-1 ring-[#e7dcc3]">
                            <p className="mb-3 text-sm text-slate-600">
                              <b className="text-slate-900">Q{q.number}</b> · {preview(q.chapter, 60)} · {q.topic} · you {fmtDuration(q.timeSpentSec)}
                              {q.batch ? `, batch average ${fmtDuration(q.batch.avgTimeSec)}, ${q.batch.correctPct}% got it right` : ""}
                            </p>
                            <QuestionBody q={q} chosen={q.selectedOptionIds || []} numericalValue={q.numericalValue} solutionOpen />
                            <div className="mt-4 flex gap-2">
                              {[-1, 1].map((d) => {
                                const idx = shown.findIndex((x) => x.number === q.number) + d;
                                const target = shown[idx];
                                return (
                                  <button
                                    key={d}
                                    type="button"
                                    disabled={!target}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenNo(target.number);
                                      setTimeout(() => document.getElementById(`lq-${target.number}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
                                    }}
                                    className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-[#e7dcc3] hover:bg-[#17140f] hover:text-[#e5c372] disabled:opacity-40"
                                  >
                                    {d < 0 ? "‹ Previous" : "Next ›"}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </FragmentRow>
                );
              })}
            </tbody>
          </table>
          {shown.length === 0 && <p className="py-10 text-center text-sm text-slate-500">No questions in this view.</p>}
        </div>
      </section>

      <Scorecard
        title={t.title}
        exam={t.exam}
        date={data.submittedAt || data.startedAt}
        name={(admin ? data.student : me)?.name}
        idLabel={(admin ? data.student : me)?.rollNo ? "Roll number" : "Email"}
        idValue={(admin ? data.student : me)?.rollNo || (admin ? data.student : me)?.email}
        rank={r?.rank}
        totalCandidates={r?.totalCandidates}
        score={s.score ?? 0}
        maxScore={s.maxScore ?? 0}
        rows={scorecardRows(questions)}
      />
    </div>
  );
}

const FragmentRow = ({ children }) => <>{children}</>;

function Tile({ label, value, unit, sub }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
        {value} {unit && <span className="text-base font-normal text-slate-500">{unit}</span>}
      </p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

function Count({ n, label, cls }) {
  return (
    <div className={`rounded-xl p-3 ${cls}`}>
      <p className="text-2xl font-bold tabular-nums">{n}</p>
      <p className="text-xs">{label}</p>
    </div>
  );
}
