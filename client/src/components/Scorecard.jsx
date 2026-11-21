// Official-looking scorecard for one live test attempt, printed as a PDF (one A4 page).
// Hidden on screen; "Download scorecard" prints only this sheet.

const GRADES = [
  [90, "A+", "Outstanding"],
  [75, "A", "Excellent"],
  [60, "B", "Very good"],
  [45, "C", "Good"],
  [30, "D", "Fair"],
  [-Infinity, "E", "Needs work"],
];
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

// Subject rows from the question list (each question has section, status, marksAwarded)
export const scorecardRows = (questions) => {
  const order = [];
  const map = new Map();
  for (const q of questions) {
    const name = q.section || "Other";
    if (!map.has(name)) {
      order.push(name);
      map.set(name, { subject: name, correct: 0, plus: 0, wrong: 0, minus: 0, skipped: 0, total: 0 });
    }
    const r = map.get(name);
    r.total += 1;
    if (q.status === "correct") {
      r.correct += 1;
      r.plus += q.marksAwarded || 0;
    } else if (q.status === "wrong") {
      r.wrong += 1;
      r.minus += q.marksAwarded || 0;
    } else r.skipped += 1;
  }
  return order.map((n) => map.get(n));
};

export function downloadScorecard() {
  document.body.classList.add("gp-printing-card");
  const done = () => {
    document.body.classList.remove("gp-printing-card");
    window.removeEventListener("afterprint", done);
  };
  window.addEventListener("afterprint", done);
  setTimeout(() => window.print(), 50);
}

export default function Scorecard({ brand = "GenPrep", title, exam, date, name, idLabel = "Email", idValue, rank, totalCandidates, score, maxScore, rows }) {
  const tot = rows.reduce(
    (a, r) => ({ correct: a.correct + r.correct, plus: a.plus + r.plus, wrong: a.wrong + r.wrong, minus: a.minus + r.minus, skipped: a.skipped + r.skipped, total: a.total + r.total }),
    { correct: 0, plus: 0, wrong: 0, minus: 0, skipped: 0, total: 0 }
  );
  const marksPct = pct(score, maxScore);
  const [, grade, gradeText] = GRADES.find(([min]) => marksPct >= min);
  const when = date ? new Date(date).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "";
  const label = rows.length && rows.every((r) => /^(physics|chemistry|mathematics|maths)$/i.test(r.subject)) ? " (PCM)" : "";

  return (
    <div className="gp-print-card hidden bg-white text-[#0f172a] print:block" style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
      {/* Header */}
      <div className="bg-[#0f172a] px-10 pb-4 pt-7 text-white">
        <p className="text-[26px] font-bold uppercase tracking-wide text-[#d4a72c]" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
          {brand}
        </p>
        <p className="mt-1 text-[19px] font-bold uppercase">Official candidate scorecard &amp; diagnostic report</p>
        <div className="mt-1 flex justify-between text-[13px] text-slate-300">
          <span>EXAM: {title}</span>
          <span>Date: {when}</span>
        </div>
      </div>
      <div className="h-[6px] bg-[#d4a72c]" />

      <div className="px-10 py-6">
        {/* Candidate */}
        <div className="grid grid-cols-2 gap-y-3 rounded-xl border border-slate-200 bg-[#f5f8fb] px-6 py-5 text-[14px]">
          <Field k="Candidate name" v={(name || "").toUpperCase()} />
          <Field k="Exam type" v={exam || "—"} />
          <Field k={idLabel} v={idValue || "—"} />
          <Field k="Class rank" v={rank ? `${rank}${totalCandidates ? ` / ${totalCandidates}` : ""}` : "—"} gold={!rank} />
        </div>

        {/* Cards */}
        <div className="mt-4 grid grid-cols-4 gap-4">
          <Card bar="#0f172a" t="Total score" v={`${score} / ${maxScore}`} s={`${marksPct}% Marks`} />
          <Card bar="#3b82f6" t="Performance" v={grade} vc="#3b82f6" s={gradeText} />
          <Card bar="#10b981" t="Correct answers" v={tot.correct} vc="#10b981" s={`Accuracy: ${pct(tot.correct, tot.total)}%`} />
          <Card bar="#ef4444" t="Incorrect / skip" v={`${tot.wrong} / ${tot.skipped}`} vc="#ef4444" s={`${tot.wrong} Wrong • ${tot.skipped} Skipped`} />
        </div>

        {/* Subjects */}
        <p className="mt-5 text-[16px] font-bold uppercase">Subject-wise performance breakdown{label}</p>
        <table className="mt-2 w-full border-collapse text-[12.5px]">
          <thead>
            <tr className="bg-[#0f172a] text-[#d4a72c]">
              {["Subject", "Correct (+)", "Incorrect (-)", "Skipped", "Total Qs", "Subject Marks", "Accuracy"].map((h, i) => (
                <th key={h} className={`px-3 py-2 font-bold ${i === 0 ? "text-left" : "text-center"}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.subject} className={i % 2 ? "bg-white" : "bg-[#f3f4f6]"}>
                <td className="px-3 py-2 font-bold text-slate-600">{r.subject}</td>
                <td className="px-3 py-2 text-center font-bold text-[#10b981]">
                  {r.correct} (+{r.plus})
                </td>
                <td className="px-3 py-2 text-center font-bold text-[#ef4444]">
                  {r.wrong} ({r.minus})
                </td>
                <td className="px-3 py-2 text-center text-slate-500">{r.skipped}</td>
                <td className="px-3 py-2 text-center text-slate-600">{r.total}</td>
                <td className="px-3 py-2 text-center font-bold">
                  {r.plus + r.minus >= 0 ? "+" : ""}
                  {r.plus + r.minus} Marks
                </td>
                <td className="px-3 py-2 text-center font-bold text-slate-600">{pct(r.correct, r.correct + r.wrong)}%</td>
              </tr>
            ))}
            <tr className="bg-[#eef2f7] font-bold">
              <td className="px-3 py-2">OVERALL TOTAL</td>
              <td className="px-3 py-2 text-center text-[#10b981]">
                {tot.correct} (+{tot.plus})
              </td>
              <td className="px-3 py-2 text-center text-[#ef4444]">
                {tot.wrong} ({tot.minus})
              </td>
              <td className="px-3 py-2 text-center text-slate-600">{tot.skipped}</td>
              <td className="px-3 py-2 text-center">{tot.total}</td>
              <td className="px-3 py-2 text-center">
                {score} / {maxScore} Marks
              </td>
              <td className="px-3 py-2 text-center">{marksPct}%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Field({ k, v, gold }) {
  return (
    <div className="flex gap-6">
      <span className="w-44 font-bold uppercase text-slate-600">{k}:</span>
      <span className={`text-[16px] font-bold ${gold ? "text-[#d4a72c]" : "text-[#0f172a]"}`}>{v}</span>
    </div>
  );
}

function Card({ bar, t, v, vc = "#0f172a", s }) {
  return (
    <div className="overflow-hidden rounded-b-lg border border-t-0 border-slate-200 text-center">
      <div className="h-[6px]" style={{ background: bar }} />
      <p className="mt-3 text-[12px] font-bold uppercase text-slate-500">{t}</p>
      <p className="mt-1 text-[22px] font-bold" style={{ color: vc }}>
        {v}
      </p>
      <p className="mb-3 text-[11px] text-slate-500">{s}</p>
    </div>
  );
}
