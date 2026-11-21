import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fmtDuration } from "./liveHelpers";

const day = (d) => new Date(d).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

// Live test results in three steps:
//   1. choose the exam (NEET / JEE / KCET)
//   2. choose one of its live tests (name and date)
//   3. see that test's result: rank, marks, and Physics / Chemistry / Biology one by one
export default function LiveResultsBrowser({ data, reportLink, empty = "No live tests taken yet." }) {
  const firstWithTests = data.exams.find((e) => e.tests > 0)?.exam || data.exams[0]?.exam;
  const [exam, setExam] = useState(firstWithTests);
  const [openId, setOpenId] = useState(null);
  useEffect(() => setExam((cur) => cur || firstWithTests), [firstWithTests]);

  const tests = data.tests.filter((t) => t.exam === exam);
  const open = tests.find((t) => String(t.attemptId) === String(openId));

  return (
    <div>
      {/* 1. Exam */}
      <div className="grid grid-cols-3 gap-3">
        {data.exams.map((e) => {
          const on = e.exam === exam;
          return (
            <button
              key={e.exam}
              type="button"
              onClick={() => {
                setExam(e.exam);
                setOpenId(null);
              }}
              className={`rounded-2xl px-5 py-4 text-left transition ${on ? "bg-[#17140f] text-white shadow-lg" : "bg-white ring-1 ring-[#e7dcc3] hover:ring-[#c9a24a]"}`}
            >
              <p className={`font-display text-2xl font-extrabold ${on ? "text-[#e5c372]" : "text-slate-900"}`}>{e.exam}</p>
              <p className={`text-sm ${on ? "text-white/70" : "text-slate-500"}`}>
                {e.tests} live test{e.tests === 1 ? "" : "s"}
              </p>
            </button>
          );
        })}
      </div>

      {/* 2. Live tests of that exam */}
      {!open && (
        <>
          <h2 className="mt-8 text-sm font-semibold uppercase tracking-wider text-slate-500">{exam} live tests</h2>
          {tests.length === 0 ? (
            <p className="mt-3 rounded-2xl bg-white px-6 py-10 text-center text-sm text-slate-500 ring-1 ring-[#e7dcc3]">{empty}</p>
          ) : (
            <ul className="mt-3 divide-y divide-[#efe6d2] overflow-hidden rounded-2xl bg-white ring-1 ring-[#e7dcc3]">
              {tests.map((t, i) => (
                <li key={t.attemptId}>
                  <button type="button" onClick={() => setOpenId(t.attemptId)} className="group flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-[#fbf8f1]">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#f7f3ea] font-display text-lg font-extrabold text-[#b8862b]">{tests.length - i}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-slate-900">{t.title}</span>
                      <span className="block text-sm text-slate-500">{day(t.date)}</span>
                    </span>
                    {t.resultsReady ? (
                      <span className="hidden text-right sm:block">
                        <span className="block font-semibold tabular-nums text-slate-900">
                          {t.score} / {t.maxScore}
                        </span>
                        {t.rank && <span className="block text-xs text-slate-500">Rank {t.rank} of {t.totalCandidates}</span>}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500">Result after it closes</span>
                    )}
                    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-900" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {/* 3. One test's result */}
      {open && <TestResult t={open} onBack={() => setOpenId(null)} reportLink={reportLink} />}
    </div>
  );
}

function TestResult({ t, onBack, reportLink }) {
  return (
    <section className="mt-6">
      <button type="button" onClick={onBack} className="group inline-flex items-center gap-2.5 text-sm font-medium text-slate-600 hover:text-slate-900">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-white shadow-sm ring-1 ring-[#e7dcc3] transition group-hover:bg-[#17140f] group-hover:text-[#e5c372]">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </span>
        All {t.exam} live tests
      </button>

      {/* Header */}
      <div className="mt-4 overflow-hidden rounded-3xl bg-[#17140f] text-white">
        <div className="flex flex-wrap items-center justify-between gap-6 p-6 md:p-8">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#e5c372]/80">
              {t.exam} · {day(t.date)}
            </p>
            <h2 className="mt-1 text-2xl font-extrabold md:text-3xl">{t.title}</h2>
            {t.resultsReady && (
              <p className="mt-2 text-sm text-white/60">
                {fmtDuration(t.timeTakenSec)} taken
                {t.autoSubmitted ? " · submitted when time ran out" : ""}
              </p>
            )}
          </div>
          {t.resultsReady && (
            <div className="flex items-center gap-8">
              <div className="text-right">
                <p className="text-xs uppercase tracking-wider text-white/50">Score</p>
                <p className="font-display text-4xl font-extrabold tabular-nums text-[#e5c372]">
                  {t.score}
                  <span className="text-lg text-white/40"> / {t.maxScore}</span>
                </p>
              </div>
              {t.rank && (
                <div className="rounded-2xl bg-[#e5c372] px-5 py-3 text-center text-[#17140f]">
                  <p className="text-[11px] font-bold uppercase tracking-wider">Rank</p>
                  <p className="font-display text-3xl font-extrabold leading-none">{t.rank}</p>
                  <p className="mt-1 text-[11px] font-semibold">of {t.totalCandidates}</p>
                </div>
              )}
            </div>
          )}
        </div>
        {t.resultsReady && (
          <div className="grid grid-cols-2 border-t border-white/10 sm:grid-cols-4">
            {[
              ["Correct", t.correct, "text-green-400"],
              ["Wrong", t.wrong, "text-orange-400"],
              ["Skipped", t.skipped, "text-white/80"],
              ["Accuracy", `${pct(t.correct, t.correct + t.wrong)}%`, "text-[#e5c372]"],
            ].map(([l, v, c], i) => (
              <div key={l} className={`px-6 py-4 ${i ? "border-l border-white/10" : ""}`}>
                <p className="text-xs text-white/50">{l}</p>
                <p className={`mt-0.5 font-display text-2xl font-extrabold tabular-nums ${c}`}>{v}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {!t.resultsReady ? (
        <p className="mt-4 rounded-2xl bg-white px-6 py-8 text-center text-sm text-slate-500 ring-1 ring-[#e7dcc3]">Submitted ✓ The result comes out when the test closes.</p>
      ) : (
        <>
          {/* Subjects */}
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {(t.subjects || []).map((s) => (
              <div key={s.name} className="rounded-2xl bg-white p-5 ring-1 ring-[#e7dcc3]">
                <div className="flex items-baseline justify-between">
                  <p className="text-lg font-bold text-slate-900">{s.name}</p>
                  <p className={`font-display text-xl font-extrabold tabular-nums ${s.marks < 0 ? "text-orange-700" : "text-slate-900"}`}>
                    {s.marks > 0 ? "+" : ""}
                    {s.marks}
                    <span className="text-xs font-medium text-slate-400"> marks</span>
                  </p>
                </div>
                {/* correct / wrong / skipped bar */}
                <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-[#f1e9d6]">
                  <div className="bg-green-600" style={{ width: `${pct(s.correct, s.total)}%` }} />
                  <div className="bg-orange-500" style={{ width: `${pct(s.wrong, s.total)}%` }} />
                </div>
                <dl className="mt-4 grid grid-cols-4 gap-2 text-center">
                  {[
                    ["Correct", s.correct, "text-green-700"],
                    ["Wrong", s.wrong, "text-orange-700"],
                    ["Skipped", s.skipped, "text-slate-500"],
                    ["Accuracy", `${pct(s.correct, s.correct + s.wrong)}%`, "text-slate-900"],
                  ].map(([l, v, c]) => (
                    <div key={l}>
                      <dd className={`font-display text-xl font-extrabold tabular-nums ${c}`}>{v}</dd>
                      <dt className="text-[11px] text-slate-500">{l}</dt>
                    </div>
                  ))}
                </dl>
                <p className="mt-3 border-t border-[#efe6d2] pt-3 text-xs text-slate-500">
                  {s.total} questions · {fmtDuration(s.timeSec)} spent
                </p>
              </div>
            ))}
          </div>

          <div className="mt-5 flex justify-end">
            <Link to={reportLink(t)} className="inline-flex items-center gap-2 rounded-xl bg-[#c9a24a] px-5 py-3 text-sm font-bold text-[#17140f] hover:bg-[#d4ae55]">
              See every question & answer →
            </Link>
          </div>
        </>
      )}
    </section>
  );
}
