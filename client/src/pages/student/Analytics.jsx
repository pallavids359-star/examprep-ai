import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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

// The analytics view. Used by the student's own Analytics page and, for any student,
// by the admin's student page (historyUrl = /admin/students/:id/history).
export function AnalyticsView({ examId, exam, historyUrl = "/progress/history", reviewLink = true, showHeader = true }) {
  const [tab, setTab] = useState("practice");
  const [data, setData] = useState({}); // tab -> tests
  const [open, setOpen] = useState(null);
  const navigate = useNavigate();
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
  const openTest = (tests || []).find((t) => t.attemptId === open) || null;
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

      {openTest && <SessionResult t={openTest} kind={tab} onBack={() => setOpen(null)} reviewLink={reviewLink} />}

      {tests && tests.length > 0 && !openTest && <SessionList tests={tests} kind={tab} onOpen={(attemptId) => (reviewLink ? navigate(`/result/${attemptId}`) : setOpen(attemptId))} />}

      {summary && !openTest && (
        <>
          <h2 className="mt-10 text-sm font-semibold uppercase tracking-wider text-slate-500">Overall</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
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

        </>
      )}
    </div>
  );
}

export default function Analytics() {
  const { examId, exam } = useExam();
  return <AnalyticsView examId={examId} exam={exam} />;
}

// ---------- Sessions: a numbered list, then one session's full result ----------
const fullDay = (d) => new Date(d).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
const timeOf = (d) => new Date(d).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });

function SessionList({ tests, kind, onOpen }) {
  const label = kind === "mock" ? "mock test" : "practice session";
  return (
    <section className="mt-6">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
        {tests.length} {label}
        {tests.length === 1 ? "" : "s"}
      </h2>
      <ul className="mt-3 divide-y divide-[#efe6d2] overflow-hidden rounded-2xl bg-white ring-1 ring-[#e7dcc3]">
        {tests.map((t, i) => (
          <li key={t.attemptId}>
            <button type="button" onClick={() => onOpen(t.attemptId)} className="group flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-[#fbf8f1]">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#f7f3ea] font-display text-lg font-extrabold text-[#b8862b]">{tests.length - i}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-slate-900">{t.title}</span>
                <span className="block text-sm text-slate-500">
                  {fullDay(t.date)} · {timeOf(t.date)}
                </span>
              </span>
              <span className="hidden gap-4 text-center text-xs text-slate-500 sm:flex">
                <span>
                  <b className="block text-base text-green-700">{t.correct}</b>correct
                </span>
                <span>
                  <b className="block text-base text-orange-700">{t.incorrect}</b>wrong
                </span>
                <span>
                  <b className="block text-base text-slate-500">{t.unanswered}</b>skipped
                </span>
              </span>
              <span className="w-24 text-right font-display text-lg font-extrabold tabular-nums text-slate-900">
                {t.score}
                <span className="text-xs font-medium text-slate-400"> / {t.maxScore}</span>
              </span>
              <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-900" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SessionResult({ t, kind, onBack, reviewLink }) {
  const attempted = t.correct + t.incorrect;
  const total = attempted + t.unanswered;
  const pctOf = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  return (
    <section className="mt-6">
      <button type="button" onClick={onBack} className="group inline-flex items-center gap-2.5 text-sm font-medium text-slate-600 hover:text-slate-900">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-white shadow-sm ring-1 ring-[#e7dcc3] transition group-hover:bg-[#17140f] group-hover:text-[#e5c372]">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </span>
        All {kind === "mock" ? "mock tests" : "practice sessions"}
      </button>

      <div className="mt-4 overflow-hidden rounded-3xl bg-[#17140f] text-white">
        <div className="flex flex-wrap items-center justify-between gap-6 p-6 md:p-8">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#e5c372]/80">
              {kind === "mock" ? "Mock test" : "Practice"} · {fullDay(t.date)}
            </p>
            <h2 className="mt-1 text-2xl font-extrabold md:text-3xl">{t.title}</h2>
            <p className="mt-2 text-sm text-white/60">{minutes(t.timeTakenSec)} taken · {total} questions</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wider text-white/50">Score</p>
            <p className="font-display text-4xl font-extrabold tabular-nums text-[#e5c372]">
              {t.score}
              <span className="text-lg text-white/40"> / {t.maxScore}</span>
            </p>
            <p className="text-sm text-white/60">{round1(t.percentage)}%</p>
          </div>
        </div>
        <div className="grid grid-cols-2 border-t border-white/10 sm:grid-cols-5">
          {[
            ["Attempted", attempted, "text-white"],
            ["Correct", t.correct, "text-green-400"],
            ["Wrong", t.incorrect, "text-orange-400"],
            ["Skipped", t.unanswered, "text-white/80"],
            ["Accuracy", `${round1(t.accuracy)}%`, "text-[#e5c372]"],
          ].map(([l, v, c], i) => (
            <div key={l} className={`px-6 py-4 ${i ? "sm:border-l sm:border-white/10" : ""}`}>
              <p className="text-xs text-white/50">{l}</p>
              <p className={`mt-0.5 font-display text-2xl font-extrabold tabular-nums ${c}`}>{v}</p>
            </div>
          ))}
        </div>
      </div>

      {t.subjects.length > 0 && (
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {t.subjects.map((s) => {
            const n = s.correct + s.incorrect + s.unanswered;
            return (
              <div key={s.name} className="rounded-2xl bg-white p-5 ring-1 ring-[#e7dcc3]">
                <div className="flex items-baseline justify-between">
                  <p className="text-lg font-bold text-slate-900">{s.name}</p>
                  <p className="font-display text-xl font-extrabold tabular-nums text-slate-900">
                    {s.score}
                    <span className="text-xs font-medium text-slate-400"> marks</span>
                  </p>
                </div>
                <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-[#f1e9d6]">
                  <div className="bg-green-600" style={{ width: `${pctOf(s.correct, n)}%` }} />
                  <div className="bg-orange-500" style={{ width: `${pctOf(s.incorrect, n)}%` }} />
                </div>
                <dl className="mt-4 grid grid-cols-4 gap-2 text-center">
                  {[
                    ["Correct", s.correct, "text-green-700"],
                    ["Wrong", s.incorrect, "text-orange-700"],
                    ["Skipped", s.unanswered, "text-slate-500"],
                    ["Accuracy", `${round1(s.accuracy)}%`, "text-slate-900"],
                  ].map(([l, v, c]) => (
                    <div key={l}>
                      <dd className={`font-display text-xl font-extrabold tabular-nums ${c}`}>{v}</dd>
                      <dt className="text-[11px] text-slate-500">{l}</dt>
                    </div>
                  ))}
                </dl>
              </div>
            );
          })}
        </div>
      )}

      {t.chapters.length > 0 && (
        <div className="mt-5 rounded-2xl bg-white p-5 ring-1 ring-[#e7dcc3]">
          <h3 className="font-bold text-slate-900">Chapters</h3>
          <ul className="mt-3 grid gap-x-8 gap-y-3 md:grid-cols-2">
            {t.chapters.map((c) => (
              <li key={c.subject + c.name}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate text-slate-800" title={c.name}>
                    {c.name}
                    <span className="ml-1.5 text-xs text-slate-400">{c.subject}</span>
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-slate-500">
                    {c.correct}/{c.attempted} correct · <b className={toneText(c.accuracy)}>{round1(c.accuracy)}%</b>
                  </span>
                </div>
                <Bar value={c.accuracy} className="mt-1.5" />
              </li>
            ))}
          </ul>
        </div>
      )}

      {reviewLink && (
        <div className="mt-5 flex justify-end">
          <Link to={`/result/${t.attemptId}`} className="inline-flex items-center gap-2 rounded-xl bg-[#c9a24a] px-5 py-3 text-sm font-bold text-[#17140f] hover:bg-[#d4ae55]">
            See every question & answer →
          </Link>
        </div>
      )}
    </section>
  );
}
