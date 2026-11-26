import { useEffect } from "react";
import QuestionBody from "./QuestionBody";
import { CLASS_LABELS, FORMAT_SHORT, LEVEL_STYLE } from "./assignmentHelpers";

// Full view of one selected question (opened by clicking it in "Selected questions").
// ← → move through the list; Remove takes it off the paper.
// (index is kept in range by the caller's list; it closes itself when the list is empty)
export default function QuestionPreviewModal({ list, index, onIndex, onRemove, onClose }) {
  const q = list[index];
  const last = list.length - 1;

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && index > 0) onIndex(index - 1);
      if (e.key === "ArrowRight" && index < last) onIndex(index + 1);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [index, last, onIndex, onClose]);

  if (!q) return null;
  const chip = "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1";

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-[#17140f]/55 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={`Question ${index + 1}`} className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl bg-[#fffdf8] shadow-2xl ring-1 ring-[#e7dcc3] sm:rounded-3xl">
        <div className="flex items-center gap-3 border-b border-[#f1e9d7] px-5 py-3.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#17140f] font-display text-sm font-bold text-[#e5c372]">{index + 1}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-slate-900">
              {q.chapter || "Question"}
              {q.topic ? <span className="font-medium text-slate-500"> · {q.topic}</span> : null}
            </p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {q.format && <span className={`${chip} bg-[#f6efdf] text-slate-700 ring-[#e7dcc3]`}>{FORMAT_SHORT[q.format] || q.format}</span>}
              {q.difficulty && <span className={`${chip} capitalize ${LEVEL_STYLE[q.difficulty] || "bg-white text-slate-700 ring-slate-200"}`}>{q.difficulty}</span>}
              {q.classLevel && <span className={`${chip} bg-white text-slate-600 ring-slate-200`}>{CLASS_LABELS[q.classLevel] || `Class ${q.classLevel}`}</span>}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-xl text-lg text-slate-500 hover:bg-[#f6efdf]">
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <QuestionBody key={q._id} q={q} solutionOpen={false} />
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-[#f1e9d7] bg-white px-5 py-3">
          <button type="button" disabled={index === 0} onClick={() => onIndex(index - 1)} className="gp-ghost-btn px-3 py-2 text-sm disabled:opacity-40">
            ← Prev
          </button>
          <span className="text-xs font-semibold text-slate-500">
            {index + 1} of {list.length}
          </span>
          <button type="button" disabled={index === last} onClick={() => onIndex(index + 1)} className="gp-ghost-btn px-3 py-2 text-sm disabled:opacity-40">
            Next →
          </button>
          <span className="flex-1" />
          {onRemove && (
            <button type="button" onClick={() => onRemove(q)} className="rounded-xl px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50">
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
