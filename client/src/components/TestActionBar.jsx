// Bottom bar: Previous, Clear, Mark for review & next, Save & next
export default function TestActionBar({ isFirst, isLast, hasAnswer, isMarked, onPrev, onClear, onMark, onSaveNext }) {
  const outline = "rounded-lg border text-sm font-medium px-3 sm:px-4 py-2.5 disabled:opacity-40";
  return (
    <div className="fixed bottom-0 inset-x-0 z-20 bg-white border-t border-slate-200 shadow-[0_-4px_12px_rgba(15,23,42,0.06)]">
      <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center gap-2">
        <button onClick={onPrev} disabled={isFirst} className={outline + " border-slate-300 text-slate-700 hover:bg-slate-50"} aria-label="Previous question">
          <span aria-hidden="true">&larr;</span>
          <span className="hidden sm:inline"> Previous</span>
        </button>
        <button onClick={onClear} disabled={!hasAnswer} className="text-sm font-medium text-slate-500 hover:text-slate-800 px-2 py-2.5 disabled:opacity-40">
          Clear
        </button>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={onMark}
            className={outline + (isMarked ? " border-violet-500 bg-violet-50 text-violet-700" : " border-violet-300 text-violet-700 hover:bg-violet-50")}
          >
            {isMarked ? "Unmark" : <>Mark<span className="hidden sm:inline"> for review</span> &amp; next</>}
          </button>
          <button onClick={onSaveNext} className="rounded-lg bg-indigo-600 text-white text-sm font-semibold px-4 sm:px-5 py-2.5 hover:bg-indigo-700">
            {isLast ? "Save & finish" : "Save & next"}
          </button>
        </div>
      </div>
    </div>
  );
}