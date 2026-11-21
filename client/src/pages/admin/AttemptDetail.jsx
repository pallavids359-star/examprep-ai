import { useEffect, useMemo, useState } from "react";
import BackLink from "../../components/BackLink";
import { Link, useParams } from "react-router-dom";
import api, { getErrorMessage } from "../../api/axios";
import AdminLayout from "../../components/AdminLayout";
import QuestionBody from "../../components/QuestionBody";
import Scorecard, { downloadScorecard, scorecardRows } from "../../components/Scorecard";
import { fmtDateTime, fmtDuration } from "../../components/liveHelpers";

const STATUS = {
  correct: { label: "Correct", dot: "bg-green-600", text: "text-green-700" },
  wrong: { label: "Wrong", dot: "bg-orange-500", text: "text-orange-700" },
  skipped: { label: "Not answered", dot: "bg-slate-400", text: "text-slate-500" },
  not_visited: { label: "Never opened", dot: "bg-slate-300", text: "text-slate-400" },
  answered: { label: "Answered", dot: "bg-amber-500", text: "text-amber-700" },
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

  if (error || !data) {
    return (
      <AdminLayout title="Answers">
        {error ? <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : <p className="text-sm text-slate-500">Loading...</p>}
      </AdminLayout>
    );
  }

  const s = data.summary;
  const inSection = data.questions.filter((q) => section === "all" || q.section === section);
  const shown = inSection.filter((q) => filter === "all" || q.status === filter || (filter === "blank" && (q.status === "skipped" || q.status === "not_visited")));
  const count = (st) => inSection.filter((q) => (st === "blank" ? q.status === "skipped" || q.status === "not_visited" : q.status === st)).length;

  return (
    <AdminLayout>
      {data.student && (
        <BackLink to={`/admin/students/${data.student._id}`}>{data.student.name}</BackLink>
      )}

      {/* Header */}
      <div className="mt-3 flex flex-wrap items-end justify-between gap-6 border-b border-slate-200 pb-6">
        <div className="min-w-0">
          <p className="text-sm text-slate-500">
            {data.modeLabel} · {data.exam}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">{data.title}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {data.student?.name} · {fmtDateTime(data.startedAt)}
            {data.status === "auto_submitted" ? " · time ran out" : data.status === "in_progress" ? " · still writing" : ""}
          </p>
        </div>
        <button type="button" onClick={downloadScorecard} className="order-last inline-flex items-center gap-2 rounded-lg bg-[#17140f] px-3.5 py-2 text-sm font-semibold text-[#e5c372] hover:bg-black print:hidden">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
          </svg>
          Download scorecard
        </button>
        <dl className="flex gap-8">
          {s.score !== null && <Fig label="Score" value={`${s.score}`} sub={`/ ${s.maxScore}`} />}
          {data.rank && <Fig label="Rank" value={`${data.rank.rank}`} sub={`of ${data.rank.total}`} />}
          <Fig label="Correct" value={s.correct} tone="text-green-700" />
          <Fig label="Wrong" value={s.wrong} tone="text-orange-700" />
          <Fig label="Time" value={fmtDuration(s.timeTakenSec)} />
        </dl>
      </div>

      {/* Subjects */}
      {sections.length > 1 && (
        <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="px-4 py-2.5 font-medium">Subject</th>
                <th className="px-4 py-2.5 font-medium">Correct</th>
                <th className="px-4 py-2.5 font-medium">Wrong</th>
                <th className="px-4 py-2.5 font-medium">Not answered</th>
                <th className="px-4 py-2.5 font-medium">Marks</th>
              </tr>
            </thead>
            <tbody>
              {sections.map((name) => {
                const list = data.questions.filter((q) => q.section === name);
                const c = list.filter((q) => q.status === "correct").length;
                const w = list.filter((q) => q.status === "wrong").length;
                return (
                  <tr key={name} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-2.5 font-medium text-slate-900">{name}</td>
                    <td className="px-4 py-2.5 tabular-nums">{c}</td>
                    <td className="px-4 py-2.5 tabular-nums">{w}</td>
                    <td className="px-4 py-2.5 tabular-nums">{list.length - c - w}</td>
                    <td className="px-4 py-2.5 tabular-nums">{list.reduce((a, q) => a + (q.marksAwarded || 0), 0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Filters */}
      <div className="sticky top-0 z-10 mt-8 rounded-2xl bg-white/95 p-2 shadow-[0_8px_24px_-16px_rgba(70,48,10,0.45)] ring-1 ring-[#e7dcc3] backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Status */}
          <div className="flex flex-wrap gap-1">
            {[
              ["all", "All", inSection.length, "bg-slate-400"],
              ["wrong", "Wrong", count("wrong"), "bg-orange-500"],
              ["correct", "Correct", count("correct"), "bg-green-600"],
              ["blank", "Not answered", count("blank"), "bg-slate-300"],
            ].map(([k, l, n, dot]) => {
              const on = filter === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setFilter(k)}
                  className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition ${on ? "bg-[#17140f] text-white" : "text-slate-600 hover:bg-[#f7f3ea]"}`}
                >
                  {k !== "all" && <span className={`h-2 w-2 rounded-full ${dot}`} />}
                  {l}
                  <span className={`rounded-md px-1.5 text-xs font-semibold tabular-nums ${on ? "bg-white/15 text-[#e5c372]" : "bg-[#f1e9d6] text-slate-700"}`}>{n}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Subject */}
            {sections.length > 1 && (
              <div className="flex rounded-xl bg-[#f7f3ea] p-1 ring-1 ring-[#e7dcc3]" role="radiogroup" aria-label="Subject">
                {["all", ...sections].map((n) => (
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
            <span className="hidden h-6 w-px bg-[#e7dcc3] sm:block" />
            {/* Solutions */}
            <button type="button" role="switch" aria-checked={showSolutions} onClick={() => setShowSolutions((v) => !v)} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-sm font-medium text-slate-700 hover:bg-[#f7f3ea]">
              <span className={`relative h-5 w-9 rounded-full transition ${showSolutions ? "bg-[#c9a24a]" : "bg-slate-300"}`}>
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${showSolutions ? "left-[18px]" : "left-0.5"}`} />
              </span>
              Solutions
            </button>
          </div>
        </div>
      </div>

      {/* Questions */}
      <div className="mt-4 space-y-3">
        {shown.length === 0 && <p className="py-10 text-center text-sm text-slate-400">No questions here.</p>}
        {shown.map((q) => {
          const st = STATUS[q.status] || STATUS.not_visited;
          return (
            <article key={q.number} className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                <span className="font-semibold text-slate-900">Q{q.number}</span>
                <span className={`flex items-center gap-1.5 font-medium ${st.text}`}>
                  <span className={`h-2 w-2 rounded-full ${st.dot}`} />
                  {st.label}
                </span>
                <span>
                  {q.section} · {q.chapter}
                  {q.topic ? ` · ${q.topic}` : ""}
                </span>
                <span className="ml-auto tabular-nums">
                  {fmtDuration(q.timeSpentSec)} · {q.marksAwarded > 0 ? `+${q.marksAwarded}` : q.marksAwarded} marks
                </span>
              </div>
              <QuestionBody key={`${q.number}-${showSolutions}`} q={q} chosen={q.selectedOptionIds} numericalValue={q.numericalValue} solutionOpen={showSolutions} who="Student's" compact />
            </article>
          );
        })}
      </div>
      <Scorecard
        title={data.title}
        exam={data.exam}
        date={data.submittedAt || data.startedAt}
        name={data.student?.name}
        idLabel={data.student?.rollNo ? "Roll number" : "Email"}
        idValue={data.student?.rollNo || data.student?.email}
        rank={data.rank?.rank}
        totalCandidates={data.rank?.total}
        score={s.score ?? 0}
        maxScore={s.maxScore ?? 0}
        rows={scorecardRows(data.questions)}
      />
    </AdminLayout>
  );
}

function Fig({ label, value, sub, tone = "text-slate-900" }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={`mt-0.5 text-2xl font-bold tabular-nums ${tone}`}>
        {value}
        {sub && <span className="ml-1 text-sm font-normal text-slate-400">{sub}</span>}
      </dd>
    </div>
  );
}
