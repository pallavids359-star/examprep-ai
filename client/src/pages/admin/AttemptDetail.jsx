import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api, { getErrorMessage } from "../../api/axios";
import AdminLayout from "../../components/AdminLayout";
import QuestionBody from "../../components/QuestionBody";
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
        <Link to={`/admin/students/${data.student._id}`} className="text-sm text-slate-500 hover:text-slate-900">
          ← {data.student.name}
        </Link>
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
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          {[
            ["all", "All", inSection.length],
            ["wrong", "Wrong", count("wrong")],
            ["correct", "Correct", count("correct")],
            ["blank", "Not answered", count("blank")],
          ].map(([k, l, n]) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k)}
              className={`border-b-2 pb-1 font-medium ${filter === k ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800"}`}
            >
              {l} <span className="text-slate-400">{n}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-4 text-sm">
          {sections.length > 1 && (
            <select value={section} onChange={(e) => setSection(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm" aria-label="Subject">
              <option value="all">All subjects</option>
              {sections.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          )}
          <label className="flex items-center gap-2 text-slate-600">
            <input type="checkbox" className="h-4 w-4 accent-slate-900" checked={showSolutions} onChange={(e) => setShowSolutions(e.target.checked)} />
            Solutions
          </label>
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
