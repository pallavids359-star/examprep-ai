import { Link } from "react-router-dom";
import QuestionBody from "./QuestionBody";
import { CLASS_LABELS, FORMAT_SHORT, LEVEL_STYLE } from "./assignmentHelpers";

// One question on a paper. Used by both the assignment page and the live-test picker,
// so the two look exactly the same.
const chip = "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1";

export function SolutionsToggle({ on, onClick }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={onClick} className="flex items-center gap-2.5 text-left text-sm font-medium text-slate-700">
      <span className={`relative h-5 w-9 shrink-0 rounded-full transition ${on ? "bg-[#c9a24a]" : "bg-slate-300"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
      </span>
      Answers &amp; solutions
    </button>
  );
}

// The bar above the paper: one line of help and the answers switch
export function PaperToolbar({ showSolutions, setShowSolutions }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e7dcc3] bg-white px-4 py-3">
      <p className="text-sm text-slate-600">
        Press <b className="text-slate-900">⇄ Swap</b> on a question to replace it — automatically or by choosing one yourself.
      </p>
      <SolutionsToggle on={showSolutions} onClick={() => setShowSolutions((v) => !v)} />
    </div>
  );
}

export default function PaperQuestionCard({ q, number, solutionOpen, editable, busy, disabled, onSwap, onRemove, onUp, onDown, editLink }) {
  return (
    <article id={`paper-${q._id}`} className={`gp-card overflow-hidden transition ${busy ? "opacity-60" : ""}`}>
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-[#f1e9d7] bg-[#fffdf8] px-4 py-2.5 sm:px-5">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#17140f] font-display text-xs font-bold text-[#e5c372]">{number}</span>
        <span className="min-w-0 flex-1 truncate text-xs text-slate-500">
          <b className="font-semibold text-slate-700">{q.chapter || "—"}</b>
          {q.topic ? ` · ${q.topic}` : ""}
        </span>
        <span className="flex flex-wrap items-center gap-1.5">
          {q.format && <span className={`${chip} bg-[#f6efdf] text-slate-700 ring-[#e7dcc3]`}>{FORMAT_SHORT[q.format] || q.format}</span>}
          {q.difficulty && <span className={`${chip} capitalize ${LEVEL_STYLE[q.difficulty] || "bg-white text-slate-700 ring-slate-200"}`}>{q.difficulty}</span>}
          {q.classLevel && <span className={`${chip} bg-white text-slate-600 ring-slate-200`}>{CLASS_LABELS[q.classLevel] || `Class ${q.classLevel}`}</span>}
        </span>
      </header>

      <div className="px-4 py-4 sm:px-5">
        <QuestionBody key={`${q._id}-${solutionOpen}`} q={q} solutionOpen={solutionOpen} compact />
      </div>

      {editable && (
        <footer className="flex flex-wrap items-center gap-2 border-t border-[#f1e9d7] bg-[#fffdf8]/60 px-4 py-2.5 sm:px-5">
          {(onUp || onDown) && (
            <span className="flex gap-1">
              <button type="button" aria-label="Move up" disabled={disabled || !onUp} onClick={onUp} className="grid h-8 w-8 place-items-center rounded-lg border border-[#e7dcc3] bg-white text-sm text-slate-600 hover:border-[#c9a24a] disabled:opacity-30">
                ↑
              </button>
              <button type="button" aria-label="Move down" disabled={disabled || !onDown} onClick={onDown} className="grid h-8 w-8 place-items-center rounded-lg border border-[#e7dcc3] bg-white text-sm text-slate-600 hover:border-[#c9a24a] disabled:opacity-30">
                ↓
              </button>
            </span>
          )}
          <span className="flex-1" />
          <button type="button" disabled={disabled || busy} onClick={onSwap} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#17140f] px-3.5 text-xs font-semibold text-[#e5c372] hover:bg-black disabled:opacity-50">
            ⇄ {busy ? "Swapping…" : "Swap"}
          </button>
          {editLink && (
            <Link to={editLink} className="inline-flex h-8 items-center rounded-lg border border-[#e7dcc3] bg-white px-3.5 text-xs font-semibold text-slate-700 hover:border-[#c9a24a]" title="Fix a typo, the answer or the solution">
              ✎ Edit
            </Link>
          )}
          <button type="button" disabled={disabled || busy} onClick={onRemove} className="inline-flex h-8 items-center rounded-lg px-3 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50">
            Remove
          </button>
        </footer>
      )}
    </article>
  );
}
