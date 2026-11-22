import { useNavigate } from "react-router-dom";

// Merit list in the style of a printed class leaderboard: title, one summary line,
// then Rank / Student / Score rows. Ranks run 1, 2, 3... down the list.
// Click a row to open that student's answers. "Print / Save as PDF" prints just this sheet.
const ARIAL = { fontFamily: "Arial, Helvetica, sans-serif" };

export default function ClassLeaderboard({ test, rows, brand = "GenPrep", canOpen = true }) {
  const navigate = useNavigate();
  const sorted = [...rows].sort((a, b) => b.score - a.score || (a.timeTakenSec || 0) - (b.timeTakenSec || 0));
  const max = test.totalMarks ?? sorted[0]?.maxScore ?? "—";
  const hasRoll = sorted.some((r) => r.student?.rollNo);
  // One column per subject (Physics, Chemistry, Biology / Mathematics...) in the paper's order
  const subjects = [...new Set(sorted.flatMap((r) => (r.subjects || []).map((x) => x.name)))];
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

      <div className="gp-sheet rounded-xl p-6 shadow-sm ring-1 ring-slate-200 md:p-10 print:p-0 print:shadow-none print:ring-0" style={ARIAL}>
        <h1 className="text-[22px] font-bold uppercase text-[#0f172a]" style={ARIAL}>
          {brand} · {test.title}
        </h1>
        <p className="mt-1 text-[13px] text-slate-500">
          {test.exam ? `${test.exam} · ` : ""}Consolidated merit ranking | {sorted.length} candidate{sorted.length === 1 ? "" : "s"} | Maximum score: {max}
        </p>

        {sorted.length === 0 ? (
          <p className="py-14 text-center text-sm text-slate-400">No one has finished this test yet.</p>
        ) : (
          <table className="mt-5 w-full border-collapse text-[14px]" style={ARIAL}>
            <thead>
              <tr className="bg-[#0f172a] text-[13px] font-bold uppercase text-white">
                <th className="w-[8%] border-r border-[#334155] px-2 py-3 text-center">Rank</th>
                {hasRoll && <th className="w-[12%] border-r border-[#334155] px-2 py-3 text-center">Roll no</th>}
                <th className="border-r border-[#334155] px-3 py-3 text-center">Student name</th>
                {subjects.map((n) => (
                  <th key={n} className="w-[12%] border-r border-[#334155] px-2 py-3 text-center leading-tight">
                    {n}
                  </th>
                ))}
                <th className="w-[9%] px-2 py-3 text-center">Total</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => (
                <tr
                  key={r.attemptId}
                  onClick={canOpen ? () => navigate(`/admin/attempts/${r.attemptId}`) : undefined}
                  title={canOpen ? "Open this student's answers" : undefined}
                  className={`${canOpen ? "cursor-pointer hover:bg-amber-50" : ""} ${i % 2 === 0 ? "gp-row-a" : "gp-row-b"} print:cursor-auto`}
                >
                  <td className="px-2 py-2.5 text-center font-bold text-[#475569]">#{i + 1}</td>
                  {hasRoll && <td className="px-2 py-2.5 text-center font-bold text-[#475569]">{r.student?.rollNo || "—"}</td>}
                  <td className="px-3 py-2.5 font-bold uppercase text-[#475569]">{r.student?.name || "Deleted account"}</td>
                  {subjects.map((n) => (
                    <td key={n} className="px-2 py-2.5 text-center font-bold text-[#475569]">
                      {r.subjects?.find((x) => x.name === n)?.marks ?? "—"}
                    </td>
                  ))}
                  <td className="gp-total px-2 py-2.5 text-center font-bold text-[#0f172a]">{r.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="mt-8 flex justify-between border-t border-slate-200 pt-3 text-xs text-slate-400" style={ARIAL}>
          <span>
            {brand} · {test.exam || ""}
          </span>
          <span>{new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
        </div>
      </div>
    </div>
  );
}
