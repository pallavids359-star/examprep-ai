import { useNavigate } from "react-router-dom";

// Merit list in the style of a printed class leaderboard: title, one summary line,
// then Rank / Student / Score rows. Ranks run 1, 2, 3... down the list.
// Click a row to open that student's answers. "Print / Save as PDF" prints just this sheet.
export default function ClassLeaderboard({ test, rows, brand = "GenPrep", canOpen = true }) {
  const navigate = useNavigate();
  const sorted = [...rows].sort((a, b) => b.score - a.score || (a.timeTakenSec || 0) - (b.timeTakenSec || 0));
  const max = test.totalMarks ?? sorted[0]?.maxScore ?? "—";
  const hasRoll = sorted.some((r) => r.student?.rollNo);
  const toolbar = (
    <div className="mb-4 flex justify-end print:hidden">
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center gap-2 rounded-lg bg-[#17140f] px-3.5 py-2 text-sm font-semibold text-[#e5c372] hover:bg-black"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
        </svg>
        Download PDF
      </button>
    </div>
  );

  return (
    <div className="gp-print-sheet">
      {toolbar}

      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200 md:p-10 print:p-0 print:shadow-none print:ring-0">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{brand}</p>
        <h1 className="mt-2 text-2xl font-extrabold uppercase tracking-tight text-slate-900 md:text-3xl">
          {test.title}
          {test.exam ? ` · ${test.exam}` : ""} leaderboard
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Consolidated merit ranking | {sorted.length} candidate{sorted.length === 1 ? "" : "s"} | Maximum score: {max}
        </p>
        <div className="mt-5 h-[3px] bg-slate-900" />

        {sorted.length === 0 ? (
          <p className="py-14 text-center text-sm text-slate-400">No one has finished this test yet.</p>
        ) : (
          <table className="mt-5 w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#0f172a] text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-300">
                <th className="w-20 px-4 py-2.5 text-center">Rank</th>
                {hasRoll && <th className="w-36 px-4 py-2.5 text-center">Roll no.</th>}
                <th className="px-4 py-2.5">Student name</th>
                <th className="w-28 px-4 py-2.5 text-right">Score</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => (
                <tr
                  key={r.attemptId}
                  onClick={canOpen ? () => navigate(`/admin/attempts/${r.attemptId}`) : undefined}
                  title={canOpen ? "Open this student's answers" : undefined}
                  className={`${canOpen ? "cursor-pointer hover:bg-amber-50" : ""} ${r.me ? "!bg-amber-100 font-semibold" : "odd:bg-white even:bg-slate-50/70"} print:cursor-auto`}
                >
                  <td className="border border-slate-200 px-4 py-2.5 text-center font-bold tabular-nums text-slate-900">{i + 1}</td>
                  {hasRoll && <td className="border border-slate-200 px-4 py-2.5 text-center tabular-nums tracking-wider text-slate-500">{r.student?.rollNo || "—"}</td>}
                  <td className="border border-slate-200 px-4 py-2.5 uppercase text-slate-800">
                    {r.student?.name || "Deleted account"}
                    {r.me && <span className="ml-2 rounded bg-slate-900 px-1.5 py-0.5 text-[10px] font-bold normal-case text-amber-200">You</span>}
                  </td>
                  <td className="border border-slate-200 px-4 py-2.5 text-right font-bold tabular-nums text-slate-900">{r.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="mt-8 flex justify-between border-t border-slate-200 pt-3 text-xs text-slate-400">
          <span>
            {brand} · {test.exam || ""}
          </span>
          <span>{new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
        </div>
      </div>
    </div>
  );
}
