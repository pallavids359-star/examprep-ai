// Difficulty choice for practice and mock tests:
// one level, any, equal, or custom percentages (easy + medium + hard = 100)
const OPTIONS = [
  ["any", "Any"],
  ["easy", "Easy"],
  ["medium", "Medium"],
  ["hard", "Hard"],
  ["equal", "Equal %"],
  ["custom", "Custom %"],
];
const LEVELS = [
  ["easy", "Easy", "bg-emerald-500"],
  ["medium", "Medium", "bg-amber-500"],
  ["hard", "Hard", "bg-rose-500"],
];

export const mixValid = (difficulty, mix) => difficulty !== "custom" || mix.easy + mix.medium + mix.hard === 100;

export default function DifficultyPicker({ value, onChange, mix, onMixChange, total = 0 }) {
  const sum = mix.easy + mix.medium + mix.hard;
  const shown = value === "equal" ? { easy: 34, medium: 33, hard: 33 } : mix;
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {OPTIONS.map(([v, l]) => (
          <button
            key={v}
            type="button"
            aria-pressed={value === v}
            onClick={() => onChange(v)}
            className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${value === v ? "border-[#17140f] bg-[#17140f] text-[#e5c372]" : "border-[#e7dcc3] bg-white text-slate-700 hover:border-[#c9a24a]"}`}
          >
            {l}
          </button>
        ))}
      </div>

      {(value === "equal" || value === "custom") && (
        <div className="mt-4 space-y-3 rounded-2xl border border-[#efe6d2] bg-[#fffdf8] p-4">
          <div className="flex h-3 overflow-hidden rounded-full bg-[#f3ecdc]">
            {LEVELS.map(([k, , bar]) => (
              <div key={k} className={`${bar} transition-all`} style={{ width: `${Math.min(100, shown[k])}%` }} />
            ))}
          </div>
          {LEVELS.map(([k, l, bar]) => (
            <div key={k} className="flex items-center gap-3">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${bar}`} />
              <span className="w-16 text-sm font-semibold text-slate-800">{l}</span>
              <span className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={shown[k]}
                  disabled={value === "equal"}
                  onChange={(e) => onMixChange({ ...mix, [k]: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                  className="w-20 rounded-lg border border-[#e7dcc3] bg-white px-2 py-1.5 text-center font-semibold text-slate-900 disabled:opacity-60"
                  aria-label={`${l} percent`}
                />
                <span className="text-sm text-slate-500">%</span>
              </span>
              <span className="flex-1" />
              <span className="w-28 text-right text-sm tabular-nums text-slate-700">
                {total > 0 && <span className="text-slate-500">≈ {Math.round((total * shown[k]) / 100)} questions</span>}
              </span>
            </div>
          ))}
          {value === "custom" && (
            <p className={`text-sm font-semibold ${sum === 100 ? "text-emerald-700" : "text-rose-700"}`}>
              Total {sum}% {sum === 100 ? "✓" : "— must be 100%"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
