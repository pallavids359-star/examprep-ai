import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api, { getErrorMessage } from "../../api/axios";
import { useExam } from "../../context/ExamContext";
import { Bone } from "../../components/Skeleton";
import { Bar, Card, CardTitle, Chip, EmptyBlock, Icon, PageHeader, Pct, Segmented, StatTile } from "../../components/ui";
import { ICONS, cx, minutes, round1, shortDate, toneText, when } from "../../components/uiHelpers";

const SUBJECT_ORDER = ["physics", "chemistry", "biology", "mathematics", "maths"];
const rank = (name) => {
  const i = SUBJECT_ORDER.indexOf(String(name).toLowerCase());
  return i < 0 ? 99 : i;
};

// Score of the last tests as a small line chart (oldest on the left)
function Trend({ tests }) {
  const points = [...tests].slice(0, 12).reverse();
  if (points.length < 2) {
    return <p className="mt-6 text-sm text-slate-500">Take at least two tests to see your trend.</p>;
  }
  const W = 560, H = 190, L = 34, R = 12, T = 14, B = 26;
  const x = (i) => L + (i * (W - L - R)) / (points.length - 1);
  const y = (v) => T + (1 - Math.min(Math.max(v, 0), 100) / 100) * (H - T - B);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.percentage || 0)}`).join(" ");
  const area = `${line} L${x(points.length - 1)},${y(0)} L${x(0)},${y(0)} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 w-full" role="img" aria-label="Score trend">
      <defs>
        <linearGradient id="trendFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#b8862b" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#b8862b" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 50, 100].map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#e7dcc3" strokeDasharray={v ? "4 4" : ""} />
          <text x={L - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#7a6e5b">{v}</text>
        </g>
      ))}
      <path d={area} fill="url(#trendFill)" />
      <path d={line} fill="none" stroke="#17140f" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <g key={p.attemptId}>
          <circle cx={x(i)} cy={y(p.percentage || 0)} r="4.5" fill="#e5c372" stroke="#17140f" strokeWidth="2">
            <title>{`${p.title}, ${shortDate(p.date)}: ${round1(p.percentage)}%`}</title>
          </circle>
        </g>
      ))}
      <text x={L} y={H - 6} fontSize="11" fill="#7a6e5b">{shortDate(points[0].date)}</text>
      <text x={W - R} y={H - 6} fontSize="11" fill="#7a6e5b" textAnchor="end">{shortDate(points[points.length - 1].date)}</text>
    </svg>
  );
}

// Marks of one test, split by subject and by chapter
function TestDetail({ test, reviewLink = true }) {
  const facts = [
    ["Correct", test.correct, "text-emerald-700"],
    ["Wrong", test.incorrect, "text-red-700"],
    ["Skipped", test.unanswered, "text-slate-600"],
    ["Accuracy", `${round1(test.accuracy)}%`, "text-slate-900"],
    ["Time", minutes(test.timeTakenSec), "text-slate-900"],
  ];
  return (
    <div className="border-t border-slate-200 bg-slate-50/60 px-4 pb-5 pt-4 md:px-6">
      <dl className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {facts.map(([k, v, c]) => (
          <div key={k} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-center">
            <dt className="text-[11px] font-medium text-slate-500">{k}</dt>
            <dd className={cx("font-bold tabular-nums", c)}>{v}</dd>
          </div>
        ))}
      </dl>

      {test.subjects.length > 0 && (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[460px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="py-2 pr-3 font-medium">Subject</th>
                <th className="py-2 pr-3 text-right font-medium">Marks</th>
                <th className="py-2 pr-3 text-right font-medium">Correct</th>
                <th className="py-2 pr-3 text-right font-medium">Wrong</th>
                <th className="py-2 pr-3 text-right font-medium">Skipped</th>
                <th className="py-2 text-right font-medium">Accuracy</th>
              </tr>
            </thead>
            <tbody>
              {test.subjects.map((s) => (
                <tr key={s.name} className="border-b border-slate-100 last:border-0">
                  <td className="py-2.5 pr-3 font-medium text-slate-800">{s.name}</td>
                  <td className="py-2.5 pr-3 text-right font-semibold tabular-nums text-slate-900">{s.score}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-emerald-700">{s.correct}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-red-700">{s.incorrect}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-slate-500">{s.unanswered}</td>
                  <td className="py-2.5 text-right"><Pct value={s.accuracy} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {test.chapters.length > 0 && (
        <>
          <h4 className="mt-5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Chapters</h4>
          <ul className="mt-2 grid gap-x-8 gap-y-3 md:grid-cols-2">
            {test.chapters.map((c) => (
              <li key={c.subject + c.name}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate text-slate-800" title={c.name}>
                    {c.name}
                    <span className="ml-1.5 text-xs text-slate-400">{c.subject}</span>
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-slate-500">
                    {c.correct}/{c.attempted} <b className={toneText(c.accuracy)}>{round1(c.accuracy)}%</b>
                  </span>
                </div>
                <Bar value={c.accuracy} className="mt-1.5" />
              </li>
            ))}
          </ul>
        </>
      )}

      {reviewLink && (
        <Link to={`/result/${test.attemptId}`} className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-700 hover:underline">
        Review every question <Icon d={ICONS.arrow} className="h-4 w-4" />
      </Link>
      )}
    </div>
  );
}

// The analytics view. Used by the student's own Analytics page and, for any student,
// by the admin's student page (historyUrl = /admin/students/:id/history).
export function AnalyticsView({ examId, exam, historyUrl = "/progress/history", reviewLink = true, showHeader = true }) {
  const [tab, setTab] = useState("practice");
  const [data, setData] = useState({}); // tab -> tests
  const [open, setOpen] = useState(null);
  const [subject, setSubject] = useState("all");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!examId) return;
    setData({});
    setOpen(null);
    setSubject("all");
    ["practice", "mock"].forEach((mode) =>
      api
        .get(historyUrl, { params: { examId, mode } })
        .then((res) => setData((d) => ({ ...d, [mode]: res.data.tests })))
        .catch((err) => setError(getErrorMessage(err)))
    );
  }, [examId, historyUrl]);

  const allTests = data[tab];

  const subjectNames = useMemo(() => {
    const names = [...new Set((allTests || []).flatMap((t) => t.subjects.map((s) => s.name)))];
    return names.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  }, [allTests]);

  // With a subject chosen, every test shows only that subject's marks
  const tests = useMemo(() => {
    if (!allTests || subject === "all") return allTests;
    return allTests
      .map((t) => {
        const s = t.subjects.find((x) => x.name === subject);
        if (!s) return null;
        const questions = t.correct + t.incorrect + t.unanswered || 1;
        const maxScore = Math.round((t.maxScore * s.total) / questions);
        return {
          ...t,
          score: s.score,
          maxScore,
          percentage: maxScore ? (s.score / maxScore) * 100 : 0,
          correct: s.correct,
          incorrect: s.incorrect,
          unanswered: s.unanswered,
          accuracy: s.accuracy,
          subjects: [s],
          chapters: t.chapters.filter((c) => c.subject === subject),
        };
      })
      .filter(Boolean);
  }, [allTests, subject]);

  const summary = useMemo(() => {
    if (!tests || tests.length === 0) return null;
    const attempted = tests.reduce((a, t) => a + t.correct + t.incorrect, 0);
    const correct = tests.reduce((a, t) => a + t.correct, 0);
    const avg = tests.reduce((a, t) => a + (t.percentage || 0), 0) / tests.length;
    const best = Math.max(...tests.map((t) => t.percentage || 0));
    const time = tests.reduce((a, t) => a + (t.timeTakenSec || 0), 0);
    const bySubject = new Map();
    tests.forEach((t) =>
      t.subjects.forEach((s) => {
        const x = bySubject.get(s.name) || { name: s.name, correct: 0, attempted: 0 };
        x.correct += s.correct;
        x.attempted += s.correct + s.incorrect;
        bySubject.set(s.name, x);
      })
    );
    const subjects = [...bySubject.values()]
      .sort((a, b) => rank(a.name) - rank(b.name))
      .map((s) => ({ ...s, accuracy: s.attempted ? (s.correct / s.attempted) * 100 : 0 }));
    // Weakest chapters across these tests
    const byChapter = new Map();
    tests.forEach((t) =>
      t.chapters.forEach((c) => {
        const k = c.subject + "|" + c.name;
        const x = byChapter.get(k) || { name: c.name, subject: c.subject, correct: 0, attempted: 0 };
        x.correct += c.correct;
        x.attempted += c.attempted;
        byChapter.set(k, x);
      })
    );
    const weakest = [...byChapter.values()]
      .filter((c) => c.attempted >= 3)
      .map((c) => ({ ...c, accuracy: (c.correct / c.attempted) * 100 }))
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 5);
    return { attempted, correct, avg, best, time, accuracy: attempted ? (correct / attempted) * 100 : 0, subjects, weakest };
  }, [tests]);

  const kind = tab === "mock" ? "mock tests" : "practice tests";
  const changeTab = (v) => {
    setTab(v);
    setOpen(null);
    setSubject("all");
  };

  return (
    <div className={showHeader ? "mx-auto max-w-6xl px-4 py-6 md:py-8" : ""}>
      {showHeader && (
        <PageHeader eyebrow={`${exam?.code || ""} performance`} title="Analytics" subtitle="Every test you finished, with marks by subject and chapter." />
      )}

      <div className={showHeader ? "mt-6 max-w-xl" : "max-w-xl"}>
        <Segmented
          label="Kind of test"
          value={tab}
          onChange={changeTab}
          options={[
            { value: "practice", label: "Practice", hint: data.practice ? `${data.practice.length} tests` : "Loading..." },
            { value: "mock", label: "Mock tests", hint: data.mock ? `${data.mock.length} tests` : "Loading..." },
          ]}
        />
      </div>

      {subjectNames.length > 1 && (
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Subject">
          {["all", ...subjectNames].map((n) => (
            <Chip key={n} active={subject === n} onClick={() => { setSubject(n); setOpen(null); }}>
              {n === "all" ? "All subjects" : n}
            </Chip>
          ))}
        </div>
      )}

      {error && <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {!tests && !error && (
        <div className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[0, 1, 2, 3].map((i) => <Bone key={i} className="h-24" />)}</div>
          <Bone className="h-56" />
        </div>
      )}

      {tests && tests.length === 0 && (
        <div className="mt-6">
          <EmptyBlock
            title={`No ${kind} ${subject === "all" ? "yet" : `with ${subject} yet`}`}
            text="Finish one and your marks, accuracy and weak chapters will appear here."
            actionLabel={tab === "mock" ? "Take a mock test" : "Start practice"}
            actionTo={tab === "mock" ? "/mock-tests" : "/practice"}
          />
        </div>
      )}

      {summary && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatTile label="Tests taken" value={tests.length} sub={`${minutes(summary.time)} spent`} />
            <StatTile label="Average score" value={`${round1(summary.avg)}%`} sub={`Best ${round1(summary.best)}%`} />
            <StatTile label="Accuracy" value={`${round1(summary.accuracy)}%`} sub="correct of attempted" accent={toneText(summary.accuracy)} />
            <StatTile label="Questions answered" value={summary.attempted} sub={`${summary.correct} correct`} />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-5">
            <Card className="p-5 lg:col-span-3">
              <CardTitle hint="Score % of your recent tests">Score trend</CardTitle>
              <Trend tests={tests} />
            </Card>
            <Card className="p-5 lg:col-span-2">
              {subject === "all" && summary.subjects.length > 1 ? (
                <>
                  <CardTitle hint="Correct out of attempted">Accuracy by subject</CardTitle>
                  <div className="mt-4 space-y-4">
                    {summary.subjects.map((s) => (
                      <div key={s.name}>
                        <div className="flex justify-between text-sm">
                          <span className="font-medium text-slate-800">{s.name}</span>
                          <span className="tabular-nums text-slate-500">{s.correct}/{s.attempted} <b className={toneText(s.accuracy)}>{round1(s.accuracy)}%</b></span>
                        </div>
                        <Bar value={s.accuracy} className="mt-1.5" />
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <CardTitle hint="Lowest accuracy first">Chapters to work on</CardTitle>
                  {summary.weakest.length === 0 ? (
                    <p className="mt-4 text-sm text-slate-500">Answer a few more questions per chapter to see this.</p>
                  ) : (
                    <ul className="mt-4 space-y-3">
                      {summary.weakest.map((c) => (
                        <li key={c.subject + c.name}>
                          <div className="flex items-baseline justify-between gap-3 text-sm">
                            <span className="min-w-0 truncate text-slate-800" title={c.name}>{c.name}</span>
                            <b className={cx("shrink-0 text-xs tabular-nums", toneText(c.accuracy))}>{round1(c.accuracy)}%</b>
                          </div>
                          <Bar value={c.accuracy} className="mt-1.5" />
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </Card>
          </div>

          <Card className="mt-4 overflow-hidden">
            <div className="px-5 pt-5">
              <CardTitle hint="Tap a test to see marks by subject and chapter">
                {tab === "mock" ? "Mock test history" : "Practice history"}
                {subject !== "all" ? ` · ${subject}` : ""}
              </CardTitle>
            </div>
            <div className="mt-3 hidden grid-cols-[1fr_110px_90px_24px] gap-3 border-y border-slate-200 bg-slate-50/70 px-5 py-2 text-xs font-medium text-slate-500 sm:grid">
              <span>Test</span>
              <span className="text-right">Marks</span>
              <span className="text-right">Score</span>
              <span />
            </div>
            <ul className="divide-y divide-slate-200 border-t border-slate-200 sm:border-t-0">
              {tests.map((t) => {
                const isOpen = open === t.attemptId;
                return (
                  <li key={t.attemptId}>
                    <button
                      type="button"
                      onClick={() => setOpen(isOpen ? null : t.attemptId)}
                      aria-expanded={isOpen}
                      className={cx("grid w-full grid-cols-[1fr_auto_auto_20px] items-center gap-3 px-5 py-3.5 text-left transition sm:grid-cols-[1fr_110px_90px_24px]", isOpen ? "bg-indigo-50/60" : "hover:bg-slate-50")}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-slate-900">{t.title}</span>
                        <span className="block text-xs text-slate-500">
                          {t.mode !== "practice" && t.mode !== "mock" ? `${t.kind} · ` : ""}
                          {when(t.date)}
                        </span>
                      </span>
                      <span className="text-right text-sm font-semibold tabular-nums text-slate-900">{t.score}/{t.maxScore}</span>
                      <span className="text-right"><Pct value={t.percentage} /></span>
                      <Icon d={ICONS.chevron} className={cx("h-5 w-5 text-slate-400 transition", isOpen && "rotate-180")} />
                    </button>
                    {isOpen && <TestDetail test={t} reviewLink={reviewLink} />}
                  </li>
                );
              })}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}

export default function Analytics() {
  const { examId, exam } = useExam();
  return <AnalyticsView examId={examId} exam={exam} />;
}
