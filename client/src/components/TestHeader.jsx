const SAVE_TEXT = { saving: "Saving...", saved: "All answers saved", error: "Not saved yet, retrying" };

// Sticky top bar: test name, big timer, submit button and a progress line
export default function TestHeader({ title, isMock, saveState, clockText, remaining, answered, total, submitting, onSubmit }) {
  let tone = "bg-slate-100 text-slate-800";
  if (remaining !== null && remaining <= 60) tone = "bg-red-600 text-white animate-pulse";
  else if (remaining !== null && remaining <= 300) tone = "bg-red-50 text-red-700";

  return (
    <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="max-w-[1600px] mx-auto px-4 h-16 flex items-center gap-3">
        <img src="/genprep-icon.png" alt="" className="hidden sm:block w-12 h-12" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900 truncate">{title}</p>
          <p className="text-xs text-slate-500 truncate">{isMock ? SAVE_TEXT[saveState] || "Answers save automatically" : "Practice mode"}</p>
        </div>
        <div className={`flex items-center gap-2 rounded-full px-4 py-1.5 ${tone}`} role="timer" aria-label={isMock ? "Time left" : "Time spent"}>
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 7v5l3 2M12 3a9 9 0 100 18 9 9 0 000-18z" />
          </svg>
          <span className="font-mono text-lg font-semibold tabular-nums">{clockText}</span>
          <span className="hidden md:inline text-xs opacity-75">{isMock ? "left" : "spent"}</span>
        </div>
        <button
          onClick={onSubmit}
          disabled={submitting}
          className="rounded-lg bg-indigo-600 text-white text-sm font-semibold px-4 py-2 hover:bg-indigo-700 disabled:opacity-60"
        >
          {submitting ? "Submitting..." : "Submit"}
        </button>
      </div>
      <div className="h-1 bg-slate-100" aria-hidden="true">
        <div className="h-1 bg-emerald-500 transition-all duration-300" style={{ width: `${total ? (answered / total) * 100 : 0}%` }} />
      </div>
    </header>
  );
}