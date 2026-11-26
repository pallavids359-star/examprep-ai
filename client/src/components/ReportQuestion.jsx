import { useEffect, useState } from "react";

export const FLAG_REASONS = [
  ["wrong_answer", "The answer key looks wrong"],
  ["no_correct_option", "None of the options is correct"],
  ["question_error", "The question has a mistake or is unclear"],
  ["image_missing", "An image or diagram is missing"],
  ["other", "Something else"],
];
export const FLAG_REASON_LABEL = Object.fromEntries(FLAG_REASONS);

// The small flag at the top right of every question
export function FlagButton({ flag, onClick }) {
  const on = Boolean(flag);
  return (
    <button
      type="button"
      onClick={onClick}
      title={on ? "You reported this question. Click to change." : "Report a mistake in this question"}
      aria-label={on ? "Reported. Change report" : "Report a mistake in this question"}
      className={`ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold transition ${
        on ? "bg-rose-50 text-rose-700 ring-1 ring-rose-200" : "text-slate-400 hover:bg-rose-50 hover:text-rose-600"
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 22V4M4 4h13l-2 4 2 4H4" />
      </svg>
      {on ? "Reported" : <span className="hidden sm:inline">Report</span>}
    </button>
  );
}

// Pop-up: choose what is wrong, optional note, send
export function FlagDialog({ number, flag, busy, onSend, onRemove, onClose }) {
  const [reason, setReason] = useState(flag?.reason || "");
  const [note, setNote] = useState(flag?.note || "");

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="flag-title" className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-rose-50 text-rose-600">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M4 22V4M4 4h13l-2 4 2 4H4" /></svg>
          </span>
          <h2 id="flag-title" className="text-lg font-semibold text-slate-900">Report Question {number}</h2>
        </div>
        <p className="mt-1 text-sm text-slate-500">What is wrong with this question?</p>

        <div className="mt-4 space-y-2" role="radiogroup">
          {FLAG_REASONS.map(([k, label]) => (
            <label key={k} className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 px-3 py-2.5 text-sm ${reason === k ? "border-rose-400 bg-rose-50/60 text-slate-900" : "border-slate-200 text-slate-700 hover:border-slate-300"}`}>
              <input type="radio" name="flag-reason" value={k} checked={reason === k} onChange={() => setReason(k)} className="accent-rose-600" />
              {label}
            </label>
          ))}
        </div>

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          rows={2}
          placeholder="Tell us more (optional). Example: the answer should be B."
          className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-rose-400"
        />

        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Keep answering as normal. The head lecturer will check it. If the question really is wrong, everyone gets full marks for it.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {flag && (
            <button type="button" disabled={busy} onClick={onRemove} className="text-sm font-semibold text-slate-500 hover:text-rose-700 disabled:opacity-50">
              Remove report
            </button>
          )}
          <span className="flex-1" />
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">
            Cancel
          </button>
          <button type="button" disabled={!reason || busy} onClick={() => onSend({ reason, note: note.trim() })} className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50">
            {busy ? "Sending..." : flag ? "Update report" : "Send report"}
          </button>
        </div>
      </div>
    </div>
  );
}
