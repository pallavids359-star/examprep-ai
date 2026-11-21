import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fmtDuration } from "./liveHelpers";

const day = (d) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

// Live test results: pick NEET / JEE / KCET, see the totals, then every live test with its report.
// reportLink(test) says where "View report" goes (student report or admin answers page).
export default function LiveResultsBrowser({ data, reportLink, empty = "No live tests taken yet." }) {
  const exams = data.exams.filter((e) => e.tests > 0).length ? data.exams : data.exams;
  const firstWithTests = data.exams.find((e) => e.tests > 0)?.exam || data.exams[0]?.exam;
  const [exam, setExam] = useState(firstWithTests);
  useEffect(() => setExam((cur) => cur || firstWithTests), [firstWithTests]);

  const sum = data.exams.find((e) => e.exam === exam);
  const tests = data.tests.filter((t) => t.exam === exam);

  return (
    <div>
      {/* Exams */}
      <div className="grid grid-cols-3 gap-3">
        {exams.map((e) => {
          const on = e.exam === exam;
          return (
            <button
              key={e.exam}
              type="button"
              onClick={() => setExam(e.exam)}
              className={`rounded-2xl p-4 text-left transition ${on ? "bg-[#17140f] text-white shadow-lg" : "bg-white ring-1 ring-[#e7dcc3] hover:ring-[#c9a24a]"}`}
            >
              <p className={`font-display text-2xl font-extrabold ${on ? "text-[#e5c372]" : "text-slate-900"}`}>{e.exam}</p>
              <p className={`text-sm ${on ? "text-white/70" : "text-slate-500"}`}>
                {e.tests} live test{e.tests === 1 ? "" : "s"}
              </p>
            </button>
          );
        })}
      </div>

      {/* Totals for this exam */}
      {sum && sum.tests > 0 && (
        <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-[#e7dcc3] ring-1 ring-[#e7dcc3] sm:grid-cols-5">
          {[
            ["Tests", sum.tests, "text-slate-900"],
            ["Correct", sum.correct, "text-green-700"],
            ["Wrong", sum.wrong, "text-orange-700"],
            ["Skipped", sum.skipped, "text-slate-600"],
            ["Best rank", sum.bestRank ? `#${sum.bestRank}` : "—", "text-[#b8862b]"],
          ].map(([l, v, c]) => (
            <div key={l} className="bg-white px-5 py-4">
              <p className="text-xs font-medium text-slate-500">{l}</p>
              <p className={`mt-1 font-display text-2xl font-extrabold tabular-nums ${c}`}>{v}</p>
            </div>
          ))}
        </div>
      )}

      {/* Live tests */}
      <h2 className="mt-8 text-lg font-bold text-slate-900">{exam} live tests</h2>
      {tests.length === 0 ? (
        <p className="mt-3 rounded-2xl bg-white px-6 py-10 text-center text-sm text-slate-500 ring-1 ring-[#e7dcc3]">{empty}</p>
      ) : (
        <div className="mt-3 space-y-3">
          {tests.map((t) => (
            <div key={t.attemptId} className="rounded-2xl bg-white p-5 ring-1 ring-[#e7dcc3]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-lg font-bold text-slate-900">{t.title}</p>
                  <p className="text-sm text-slate-500">
                    {day(t.date)}
                    {t.autoSubmitted ? " · submitted when time ran out" : ""}
                  </p>
                </div>
                {t.resultsReady && t.rank && (
                  <div className="rounded-xl bg-[#17140f] px-4 py-2 text-center">
                    <p className="font-display text-2xl font-extrabold leading-none text-[#e5c372]">#{t.rank}</p>
                    <p className="mt-1 text-[11px] text-white/70">of {t.totalCandidates}</p>
                  </div>
                )}
              </div>

              {t.resultsReady ? (
                <>
                  <dl className="mt-4 grid grid-cols-3 gap-4 border-t border-[#efe6d2] pt-4 sm:grid-cols-6">
                    {[
                      ["Score", `${t.score}/${t.maxScore}`, "text-slate-900"],
                      ["Correct", t.correct, "text-green-700"],
                      ["Wrong", t.wrong, "text-orange-700"],
                      ["Skipped", t.skipped, "text-slate-600"],
                      ["Time", fmtDuration(t.timeTakenSec), "text-slate-900"],
                      ["Per question", fmtDuration(t.questions ? t.timeTakenSec / t.questions : 0), "text-slate-900"],
                    ].map(([l, v, c]) => (
                      <div key={l}>
                        <dt className="text-xs text-slate-500">{l}</dt>
                        <dd className={`mt-0.5 text-lg font-bold tabular-nums ${c}`}>{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="mt-4 flex justify-end">
                    <Link to={reportLink(t)} className="rounded-xl bg-[#17140f] px-4 py-2 text-sm font-semibold text-[#e5c372] hover:bg-black">
                      View report →
                    </Link>
                  </div>
                </>
              ) : (
                <p className="mt-3 text-sm text-slate-500">Submitted ✓ Results come out when the test closes.</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
