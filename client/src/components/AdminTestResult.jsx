import { useState } from "react";
import { Link } from "react-router-dom";
import ClassLeaderboard from "./ClassLeaderboard";
import { useReportPrinter } from "./ReportPrinter";
import { PHASE, fmtDateTime, fmtDuration } from "./liveHelpers";

const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const ordinal = (n) => {
  const v = n % 100;
  return n + (["th", "st", "nd", "rd"][(v - 20) % 10] || ["th", "st", "nd", "rd"][v] || "th");
};
const MEDAL = { 1: "🥇", 2: "🥈", 3: "🥉" };

// One live test's result for the admin: who wrote it, then every student by rank.
// Click a student to open their result right there.
export default function AdminTestResult({ board }) {
  const { test, stats, rows } = board;
  const ph = PHASE[test.phase] || PHASE.closed || { label: test.phase, cls: "" };
  const completed = (stats.submitted ?? 0) + (stats.autoSubmitted ?? 0) || stats.finished;

  return (
    <div>
      {/* Header */}
      <section className="overflow-hidden rounded-3xl bg-[#17140f] text-white">
        <div className="flex flex-wrap items-start justify-between gap-4 p-6 md:p-8">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#e5c372]/80">
              {test.exam}
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold normal-case tracking-normal ${ph.cls}`}>{ph.label}</span>
            </p>
            <h2 className="mt-1 text-2xl font-extrabold md:text-3xl">{test.title}</h2>
            <p className="mt-1 text-sm text-white/60">
              {fmtDateTime(test.startsAt)} → {fmtDateTime(test.endsAt)}
            </p>
          </div>
          {rows.length > 0 && (
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-xl bg-[#c9a24a] px-4 py-2.5 text-sm font-bold text-[#17140f] hover:bg-[#d4ae55] print:hidden"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
              </svg>
              Download PDF
            </button>
          )}
        </div>

        {/* Attendance */}
        <div className="grid grid-cols-2 border-t border-white/10 sm:grid-cols-5">
          {[
            ["Attended", stats.started ?? completed + (stats.inProgress || 0), "text-white"],
            ["Completed", completed, "text-green-400"],
            ["Time ran out", stats.autoSubmitted ?? 0, "text-orange-300"],
            ["Writing now", stats.inProgress ?? 0, "text-sky-300"],
            ["Not completed", stats.notCompleted ?? 0, "text-red-300"],
          ].map(([l, v, c], i) => (
            <div key={l} className={`px-6 py-4 ${i ? "sm:border-l sm:border-white/10" : ""}`}>
              <p className="text-xs text-white/50">{l}</p>
              <p className={`mt-0.5 font-display text-2xl font-extrabold tabular-nums ${c}`}>{v}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Marks */}
      {rows.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-[#e7dcc3] ring-1 ring-[#e7dcc3] sm:grid-cols-4">
          {[
            ["Highest", `${stats.highest} / ${test.totalMarks}`],
            ["Average", `${stats.average} / ${test.totalMarks}`],
            ["Lowest", `${stats.lowest ?? "—"} / ${test.totalMarks}`],
            ["Average time", fmtDuration(stats.avgTimeSec || 0)],
          ].map(([l, v]) => (
            <div key={l} className="bg-white px-5 py-4">
              <p className="text-xs text-slate-500">{l}</p>
              <p className="mt-0.5 text-lg font-bold tabular-nums text-slate-900">{v}</p>
            </div>
          ))}
        </div>
      )}

      {/* Who is still writing / didn't finish */}
      {(board.writingNow?.length > 0 || board.notCompleted?.length > 0) && (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {[
            ["Writing now", board.writingNow, "bg-sky-500"],
            ["Started but not completed", board.notCompleted, "bg-red-500"],
          ]
            .filter(([, l]) => l?.length)
            .map(([title, list, dot]) => (
              <div key={title} className="rounded-2xl bg-white p-5 ring-1 ring-[#e7dcc3]">
                <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <span className={`h-2 w-2 rounded-full ${dot}`} />
                  {title} · {list.length}
                </p>
                <ul className="mt-2 space-y-1 text-sm text-slate-600">
                  {list.map((p) => (
                    <li key={String(p._id)} className="flex justify-between gap-3">
                      <span className="truncate">{p.name}</span>
                      <span className="shrink-0 text-xs text-slate-400">started {fmtDateTime(p.startedAt)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
        </div>
      )}

      {/* Ranks */}
      <h3 className="mt-8 text-lg font-bold text-slate-900">
        Ranks <span className="text-sm font-normal text-slate-500">· {rows.length} student{rows.length === 1 ? "" : "s"} completed</span>
      </h3>
      {rows.length === 0 ? (
        <p className="mt-3 rounded-2xl bg-white px-6 py-10 text-center text-sm text-slate-500 ring-1 ring-[#e7dcc3]">No one has completed this test yet.</p>
      ) : (
        <RankList rows={rows} />
      )}

      {/* What "Download PDF" prints */}
      <div className="hidden print:block">
        <ClassLeaderboard test={test} rows={rows} />
      </div>
    </div>
  );
}

// The ranked list of students (also used for assignment results, so both look the same).
// rows: { attemptId, student, score, maxScore, correct, incorrect, unanswered, timeTakenSec, submittedAt, subjects? }
export function RankList({ rows }) {
  const [openId, setOpenId] = useState(null);
  return (
    <ul className="mt-3 space-y-2">
          {[...rows]
            .sort((a, b) => b.score - a.score || (a.timeTakenSec || 0) - (b.timeTakenSec || 0))
            .map((r, i) => {
              const place = i + 1;
              const open = openId === String(r.attemptId);
              return (
                <li key={r.attemptId} className={`overflow-hidden rounded-2xl bg-white ring-1 transition ${open ? "ring-2 ring-[#c9a24a]" : "ring-[#e7dcc3]"}`}>
                  <button type="button" onClick={() => setOpenId(open ? null : String(r.attemptId))} className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-[#fbf8f1]">
                    <span
                      className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl font-display text-sm font-extrabold ${
                        place <= 3 ? "bg-[#17140f] text-[#e5c372]" : "bg-[#f7f3ea] text-slate-700"
                      }`}
                    >
                      {MEDAL[place] || ordinal(place)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-slate-900">{r.student?.name || "Deleted account"}</span>
                      <span className="block truncate text-xs text-slate-500">
                        {ordinal(place)} · {r.student?.email}
                      </span>
                    </span>
                    <span className="hidden gap-4 text-center text-xs sm:flex">
                      <span>
                        <b className="block text-base text-green-700">{r.correct}</b>correct
                      </span>
                      <span>
                        <b className="block text-base text-orange-700">{r.incorrect}</b>wrong
                      </span>
                      <span>
                        <b className="block text-base text-slate-500">{r.unanswered}</b>skipped
                      </span>
                    </span>
                    <span className="w-24 shrink-0 text-right font-display text-lg font-extrabold tabular-nums text-slate-900">
                      {r.score}
                      <span className="text-xs font-medium text-slate-400"> / {r.maxScore}</span>
                    </span>
                    <svg viewBox="0 0 24 24" className={`h-5 w-5 shrink-0 text-slate-400 transition ${open ? "rotate-90" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </button>
                  {open && <StudentResult r={r} place={place} total={rows.length} />}
                </li>
              );
            })}
        </ul>
  );
}

function StudentResult({ r, place, total }) {
  const printer = useReportPrinter();
  const attempted = r.correct + r.incorrect;
  return (
    <div className="border-t border-[#efe6d2] bg-[#fbf8f1] px-5 py-5">
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8">
        {[
          ["Rank", `${place} / ${total}`, "text-[#b8862b]"],
          ["Score", `${r.score}/${r.maxScore}`, "text-slate-900"],
          ["Attempted", attempted, "text-slate-900"],
          ["Correct", r.correct, "text-green-700"],
          ["Incorrect", r.incorrect, "text-orange-700"],
          ["Skipped", r.unanswered, "text-slate-500"],
          ["Accuracy", `${pct(r.correct, attempted)}%`, "text-slate-900"],
          ["Time", fmtDuration(r.timeTakenSec || 0), "text-slate-900"],
        ].map(([l, v, c]) => (
          <div key={l}>
            <dt className="text-xs text-slate-500">{l}</dt>
            <dd className={`mt-0.5 font-display text-xl font-extrabold tabular-nums ${c}`}>{v}</dd>
          </div>
        ))}
      </dl>

      {r.subjects?.length > 0 && (
        <div className="mt-5 overflow-x-auto rounded-xl bg-white ring-1 ring-[#e7dcc3]">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-[#efe6d2] text-left text-xs text-slate-500">
                <th className="px-4 py-2.5 font-medium">Subject</th>
                <th className="px-4 py-2.5 font-medium">Correct</th>
                <th className="px-4 py-2.5 font-medium">Incorrect</th>
                <th className="px-4 py-2.5 font-medium">Skipped</th>
                <th className="px-4 py-2.5 font-medium">Marks</th>
                <th className="px-4 py-2.5 font-medium">Time</th>
                <th className="w-40 px-4 py-2.5 font-medium" />
              </tr>
            </thead>
            <tbody>
              {r.subjects.map((s) => (
                <tr key={s.name} className="border-b border-[#f4eee0] last:border-0">
                  <td className="px-4 py-2.5 font-semibold text-slate-900">{s.name}</td>
                  <td className="px-4 py-2.5 tabular-nums text-green-700">{s.correct}</td>
                  <td className="px-4 py-2.5 tabular-nums text-orange-700">{s.wrong}</td>
                  <td className="px-4 py-2.5 tabular-nums text-slate-500">{s.skipped}</td>
                  <td className="px-4 py-2.5 font-semibold tabular-nums text-slate-900">{s.marks}</td>
                  <td className="px-4 py-2.5 tabular-nums text-slate-600">{fmtDuration(s.timeSec)}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex h-2 overflow-hidden rounded-full bg-[#f1e9d6]">
                      <div className="bg-green-600" style={{ width: `${pct(s.correct, s.total)}%` }} />
                      <div className="bg-orange-500" style={{ width: `${pct(s.wrong, s.total)}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          Submitted {fmtDateTime(r.submittedAt)}
          {r.autoSubmitted ? " · time ran out" : ""}
        </p>
        <span className="flex flex-wrap gap-2">
          <button type="button" onClick={() => printer.printReports([r.attemptId], "one", `${r.student?.name || "Student"}_report`)} disabled={Boolean(printer.busy)} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-[#8a6420] ring-1 ring-[#e7dcc3] hover:bg-white disabled:opacity-50">
            ⤓ {printer.busy ? "Preparing…" : "Download report"}
          </button>
          <Link to={`/admin/attempts/${r.attemptId}`} className="inline-flex items-center gap-2 rounded-xl bg-[#17140f] px-4 py-2 text-sm font-semibold text-[#e5c372] hover:bg-black">
            See every question & answer →
          </Link>
        </span>
        {printer.node}
      </div>
    </div>
  );
}
