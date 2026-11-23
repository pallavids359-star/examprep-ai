// Question types with an optional "how many" for each.
//   options: the types offered     chosen / onChosen: ticked types
//   counts / onCounts: { type: "3" }  total: questions in all (to show what is left)
const LABELS = {
  single_correct: "Single correct answer",
  assertion_reason: "Assertion and reason",
  statement_based: "Statement based questions",
  match_following: "Match the following",
  multi_correct: "Multiple correct answer",
  numerical: "Numerical",
};
const JEE_ONLY = ["multi_correct", "numerical"];

export const typedTotal = (chosen, counts) => chosen.reduce((a, f) => a + (Number(counts[f]) || 0), 0);
// Only the counts of ticked types, as numbers
export const cleanCounts = (chosen, counts) => Object.fromEntries(chosen.filter((f) => Number(counts[f]) > 0).map((f) => [f, Number(counts[f])]));

export default function QuestionTypeCounts({ options, chosen, onChosen, counts, onCounts, total, per = "" }) {
  const sum = typedTotal(chosen, counts);
  const toggle = (f) => onChosen(chosen.includes(f) ? chosen.filter((x) => x !== f) : [...chosen, f]);
  return (
    <div>
      <div className="divide-y divide-[#f1e9d7] overflow-hidden rounded-2xl border border-[#efe6d2] bg-white">
        {options.map((f) => {
          const on = chosen.includes(f);
          return (
            <div key={f} className={`flex items-center gap-3 px-4 py-2.5 transition ${on ? "bg-[#fffaf0]" : ""}`}>
              <button type="button" onClick={() => toggle(f)} aria-pressed={on} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border ${on ? "border-[#b8862b] bg-[#b8862b] text-white" : "border-slate-300 bg-white"}`}>
                  {on && (
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </span>
                <span className={`text-sm font-semibold ${on ? "text-slate-900" : "text-slate-600"}`}>{LABELS[f] || f}</span>
                {JEE_ONLY.includes(f) && <span className="rounded-full bg-[#17140f] px-1.5 py-0.5 text-[10px] font-bold text-[#e5c372]">JEE</span>}
              </button>
              {on && (
                <label className="flex items-center gap-2 text-xs text-slate-500">
                  How many
                  <input
                    type="number"
                    min={0}
                    max={200}
                    placeholder="any"
                    value={counts[f] ?? ""}
                    onChange={(e) => onCounts({ ...counts, [f]: e.target.value })}
                    className="w-20 rounded-lg border border-[#e7dcc3] bg-white px-2 py-1.5 text-center text-sm font-semibold text-slate-900"
                    aria-label={`How many ${LABELS[f] || f}`}
                  />
                </label>
              )}
            </div>
          );
        })}
      </div>
      <p className={`mt-2 text-xs ${total && sum > total ? "font-semibold text-rose-700" : "text-slate-500"}`}>
        {!chosen.length
          ? "None ticked = every type."
          : !sum
            ? "No numbers typed = any mix of the ticked types."
            : total && sum > total
              ? `The types add up to ${sum}, more than the ${total} questions${per}.`
              : `${sum} set by type${total ? `, the other ${total - sum} from any ticked type` : ""}${per}.`}
      </p>
    </div>
  );
}
