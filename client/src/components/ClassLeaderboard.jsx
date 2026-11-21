import { useState } from "react";
import { useNavigate } from "react-router-dom";

// Merit list in the style of a printed class leaderboard: title, one summary line,
// then Rank / Student / Score rows. Ranks run 1, 2, 3... down the list.
// Click a row to open that student's answers. "Print / Save as PDF" prints just this sheet.
export default function ClassLeaderboard({ test, rows, brand = "GenPrep", canOpen = true }) {
  const navigate = useNavigate();
  const [view, setView] = useState("board");
  const sorted = [...rows].sort((a, b) => b.score - a.score || (a.timeTakenSec || 0) - (b.timeTakenSec || 0));
  const max = test.totalMarks ?? sorted[0]?.maxScore ?? "—";
  const hasRoll = sorted.some((r) => r.student?.rollNo);

  const switcher = (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 print:hidden">
      <div className="flex gap-6">
        {[
          ["board", "Leaderboard", "M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0zM17 5h3v2a3 3 0 01-3 3M7 5H4v2a3 3 0 003 3"],
          ["list", "Merit list", "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"],
        ].map(([k, l, d]) => (
          <button
            key={k}
            type="button"
            onClick={() => setView(k)}
            className={`-mb-[13px] flex items-center gap-2 border-b-2 pb-3 text-sm font-semibold transition ${view === k ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800"}`}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={d} />
            </svg>
            {l}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => {
          setView("list");
          setTimeout(() => window.print(), 150);
        }}
        className="inline-flex items-center gap-2 rounded-lg bg-[#17140f] px-3.5 py-2 text-sm font-semibold text-[#e5c372] hover:bg-black"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
        </svg>
        Download PDF
      </button>
    </div>
  );

  if (view === "board") {
    return (
      <div>
        {switcher}
        <Board test={test} rows={sorted} onOpen={canOpen ? (r) => navigate(`/admin/attempts/${r.attemptId}`) : null} />
      </div>
    );
  }

  return (
    <div className="gp-print-sheet">
      {switcher}

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

// ---------- Game-style board: big top 3, everyone else in two columns ----------
const initials = (n = "") =>
  n
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("") || "?";
const ordinal = (n) => {
  const v = n % 100;
  return n + (["th", "st", "nd", "rd"][(v - 20) % 10] || ["th", "st", "nd", "rd"][v] || "th");
};

function Laurel({ flip = false, className = "" }) {
  // A small golden laurel branch made of leaves along a curve
  const leaves = Array.from({ length: 7 }, (_, i) => i);
  return (
    <svg viewBox="0 0 40 100" className={className} style={flip ? { transform: "scaleX(-1)" } : undefined} aria-hidden="true">
      <path d="M30 96 C 8 78, 6 40, 22 6" fill="none" stroke="#e9c46a" strokeWidth="2" />
      {leaves.map((i) => {
        const t = i / 6;
        const y = 92 - t * 82;
        const x = 30 - Math.sin(t * Math.PI * 0.95) * 20 + t * 4;
        return <ellipse key={i} cx={x - 6} cy={y} rx="7" ry="3.2" fill="#f2d27a" transform={`rotate(${-35 - t * 25} ${x - 6} ${y})`} />;
      })}
      {leaves.map((i) => {
        const t = i / 6;
        const y = 88 - t * 82;
        const x = 30 - Math.sin(t * Math.PI * 0.95) * 20 + t * 4;
        return <ellipse key={`r${i}`} cx={x + 5} cy={y} rx="7" ry="3.2" fill="#d9a93f" transform={`rotate(${25 + t * 20} ${x + 5} ${y})`} />;
      })}
    </svg>
  );
}

function Avatar({ name, size, ring }) {
  return (
    <span className="grid place-items-center rounded-full p-[3px] shadow-[0_10px_30px_-10px_rgba(0,0,0,0.6)]" style={{ width: size, height: size, background: ring }}>
      <span className="grid h-full w-full place-items-center rounded-full bg-gradient-to-br from-white to-amber-50 font-display font-extrabold text-slate-900" style={{ fontSize: size * 0.3 }}>
        {initials(name)}
      </span>
    </span>
  );
}

const GOLD = "linear-gradient(135deg,#fff1b8,#e9b949 45%,#b8862b)";
const SILVER = "linear-gradient(135deg,#ffffff,#c9d2de 50%,#8e9aab)";
const BRONZE = "linear-gradient(135deg,#ffe1c4,#e09452 50%,#a35a26)";

function Board({ test, rows, onOpen }) {
  const [first, second, third] = rows;
  const rest = rows.slice(3);
  const left = rest.filter((_, i) => i % 2 === 0);
  const right = rest.filter((_, i) => i % 2 === 1);

  return (
    <section
      className="relative overflow-hidden rounded-3xl px-5 pb-8 pt-8 text-white shadow-[0_30px_60px_-30px_rgba(15,23,42,0.8)] md:px-10"
      style={{
        background:
          "radial-gradient(circle at 50% 26%, rgba(229,195,114,0.30), transparent 45%), repeating-conic-gradient(from 0deg at 50% 30%, rgba(229,195,114,0.05) 0deg 6deg, transparent 6deg 12deg), linear-gradient(180deg,#221d15 0%,#17140f 100%)",
      }}
    >
      {/* sparkles */}
      {[
        [12, 18, 14],
        [86, 14, 12],
        [22, 42, 9],
        [78, 40, 10],
        [50, 6, 8],
        [93, 55, 7],
        [6, 60, 7],
      ].map(([x, y, s], i) => (
        <span key={i} className="pointer-events-none absolute text-amber-100/80" style={{ left: `${x}%`, top: `${y}%`, fontSize: s }}>
          ✦
        </span>
      ))}

      <div className="relative text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-amber-200/80">{test.exam ? `${test.exam} · ` : ""}Live test</p>
        <h2 className="mt-1 font-display text-3xl font-extrabold tracking-[0.12em] md:text-4xl">LEADERBOARD</h2>
        <p className="mt-1 truncate text-sm text-white/60">{test.title}</p>
      </div>

      {rows.length === 0 ? (
        <p className="relative py-16 text-center text-white/60">No one has finished yet. The board fills in as students submit.</p>
      ) : (
        <>
          {/* Podium */}
          <div className="relative mx-auto mt-8 grid max-w-3xl grid-cols-3 items-end gap-2">
            {[
              [second, 2, SILVER, 96, "mt-10"],
              [first, 1, GOLD, 140, ""],
              [third, 3, BRONZE, 96, "mt-10"],
            ].map(([r, place, ring, size, mt]) =>
              r ? (
                <button key={place} type="button" disabled={!onOpen} onClick={() => onOpen?.(r)} className={`group flex flex-col items-center disabled:cursor-default ${mt}`}>
                  <span className={`font-display font-extrabold ${place === 1 ? "text-3xl text-amber-200" : "text-xl text-white/80"}`}>
                    {place}
                    <sup className="text-[0.55em]">{["st", "nd", "rd"][place - 1]}</sup>
                  </span>
                  <span className="relative mt-1 flex items-center">
                    {place === 1 && <Laurel className="absolute -left-12 bottom-0 h-36 w-12" />}
                    <Avatar name={r.student?.name} size={size} ring={ring} />
                    {place === 1 && <Laurel flip className="absolute -right-12 bottom-0 h-36 w-12" />}
                    {place === 1 && <span className="absolute -right-4 -top-3 text-3xl drop-shadow">🏆</span>}
                  </span>
                  <span className={`mt-3 max-w-full truncate font-bold uppercase tracking-wide ${onOpen ? "group-hover:underline" : ""} ${place === 1 ? "text-lg" : "text-sm"}`}>{r.student?.name || "Deleted account"}</span>
                  {r.me && <span className="mt-1 rounded-full bg-amber-300 px-2 py-0.5 text-[10px] font-extrabold text-slate-900">YOU</span>}
                  <span className={`font-display font-extrabold tabular-nums ${place === 1 ? "text-3xl text-amber-200" : "text-xl text-white/90"}`}>{r.score}</span>
                  <span className="text-[11px] text-white/50">/ {r.maxScore}</span>
                </button>
              ) : (
                <span key={place} />
              )
            )}
          </div>

          {/* Everyone else */}
          {rest.length > 0 && (
            <div className="relative mx-auto mt-10 grid max-w-4xl gap-x-8 gap-y-2.5 md:grid-cols-2">
              {[left, right].map((col, c) => (
                <div key={c} className="space-y-2.5">
                  {col.map((r) => {
                    const place = rows.indexOf(r) + 1;
                    return (
                      <button
                        key={r.attemptId}
                        type="button"
                        disabled={!onOpen}
                        onClick={() => onOpen?.(r)}
                        className={`flex w-full items-center gap-3 rounded-full py-1.5 pl-1.5 pr-5 text-left transition disabled:cursor-default ${
                          r.me ? "bg-gradient-to-r from-amber-300/40 to-amber-200/10 ring-2 ring-amber-300" : "bg-gradient-to-r from-white/15 to-white/5 ring-1 ring-white/15 hover:from-white/25"
                        }`}
                      >
                        <span className="w-12 shrink-0 text-right font-display text-lg font-extrabold">
                          {place}
                          <sup className="text-[0.55em]">{ordinal(place).replace(String(place), "")}</sup>
                        </span>
                        <Avatar name={r.student?.name} size={34} ring="linear-gradient(135deg,#f7f3ea,#e5c372)" />
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold uppercase tracking-wide">
                          {r.student?.name || "Deleted account"}
                          {r.me && <span className="ml-2 rounded-full bg-amber-300 px-1.5 py-0.5 text-[10px] font-extrabold normal-case text-slate-900">You</span>}
                        </span>
                        <span className="font-display font-extrabold tabular-nums text-amber-200">{r.score}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
