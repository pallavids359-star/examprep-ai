import { useEffect } from "react";

// Step-by-step form pieces: steps panel, summary, Auto/Manual pop-up, preview
const CheckIcon = () => (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 13l4 4L19 7" />
  </svg>
);

// Left: "Your steps" and "Your paper"
export function StepsPanel({ steps, step, done, onGo, paper, paperTitle = "Your paper" }) {
  return (
    <aside className="lg:sticky lg:top-6 lg:self-start">
      {/* Phones: a slim progress row */}
      <ol className="flex gap-1.5 lg:hidden" aria-label="Steps">
        {steps.map(([name], i) => (
          <li key={name} className="flex-1">
            <button type="button" onClick={() => onGo(i + 1)} className="w-full text-left">
              <span className={`block h-1.5 rounded-full ${i + 1 === step ? "bg-[#c9a24a]" : done[i] ? "bg-[#17140f]" : "bg-[#e7dcc3]"}`} />
              <span className={`mt-1 block truncate text-[11px] font-semibold ${i + 1 === step ? "text-slate-900" : "text-slate-400"}`}>{name}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className="gp-card hidden p-4 lg:block">
        <p className="px-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#b8862b]">Your steps</p>
        <ol className="mt-3 space-y-1">
          {steps.map(([name, sub], i) => {
            const n = i + 1;
            const now = n === step;
            return (
              <li key={name}>
                <button type="button" onClick={() => onGo(n)} aria-current={now ? "step" : undefined} className={`flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition ${now ? "bg-[#f6eedb]" : "hover:bg-[#fbf7ee]"}`}>
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${done[i] && !now ? "bg-emerald-600 text-white" : now ? "bg-[#17140f] text-[#e5c372]" : "bg-[#f3ecdc] text-slate-500"}`}>
                    {done[i] && !now ? <CheckIcon /> : n}
                  </span>
                  <span className="min-w-0">
                    <span className={`block text-sm font-semibold ${now ? "text-slate-900" : "text-slate-700"}`}>{name}</span>
                    <span className="block truncate text-xs text-slate-500">{sub}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="mt-4 hidden rounded-3xl bg-[#17140f] p-5 text-white shadow-xl shadow-black/10 lg:block">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#e5c372]">{paperTitle}</p>
        <dl className="mt-3 space-y-3">
          {paper.map(([k, v]) => (
            <div key={k}>
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-amber-100/50">{k}</dt>
              <dd className="text-sm font-bold">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </aside>
  );
}

// Step 4: which way the questions are found, with a "Change" link
export function ModeBar({ manual, onChange, label, sub }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-[#fbf6ea] px-4 py-3 ring-1 ring-[#efe6d2]">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-b from-[#e5c372] to-[#b8862b] text-[#17140f]">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d={manual ? "M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" : "M13 2L3 14h8l-1 8 10-12h-8z"} />
        </svg>
      </span>
      <span className="flex-1 text-sm">
        <b className="text-slate-900">{label || (manual ? "Manual fetch" : "Auto fetch")}</b>
        <span className="text-slate-500"> · {sub || (manual ? "you hand-pick every question" : "set the count, difficulty and types; questions are picked for you")}</span>
      </span>
      <button type="button" onClick={onChange} className="text-sm font-semibold text-[#9a7a2c] hover:underline">
        Change
      </button>
    </div>
  );
}

// The pop-up when step 4 opens: Auto fetch or Manual fetch
export function ModeModal({ label, current, onPick, onClose, modes, title = "How should questions be chosen?" }) {
  useEffect(() => {
    const k = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  const MODES = modes || [
    ["auto", "Auto fetch", "Set chapter counts, difficulty and question types. GenPrep balances and picks the questions; you check them before publishing.", "M13 2L3 14h8l-1 8 10-12h-8z", "Use auto fetch"],
    ["manual", "Manual fetch", "Hand-pick every question. Filter by chapter, concept, difficulty and question type, like a live test.", "M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z", "Use manual fetch"],
  ];
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#17140f]/45 p-4 backdrop-blur-sm" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="mode-title" className="w-full max-w-3xl rounded-3xl bg-[#fffdf8] p-6 shadow-2xl md:p-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="rounded-full bg-[#f3ecdc] px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#8a6420]">{label}</span>
            <h2 id="mode-title" className="mt-3 font-display text-2xl font-extrabold text-slate-900">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">You can change this later.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full text-slate-400 hover:bg-[#f3ecdc] hover:text-slate-900">
            ✕
          </button>
        </div>
        <div className={`mt-6 grid gap-4 ${MODES.length > 2 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
          {MODES.map(([v, title, sub, icon, cta]) => (
            <div key={v} className={`flex flex-col rounded-2xl border p-5 ${current === v ? "border-[#c9a24a] bg-[#fbf6ea]" : "border-[#e7dcc3] bg-white"}`}>
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-b from-[#e5c372] to-[#b8862b] text-[#17140f]">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d={icon} />
                </svg>
              </span>
              <p className="mt-3 font-display text-lg font-extrabold text-slate-900">{title}</p>
              <p className="mt-1 flex-1 text-sm text-slate-600">{sub}</p>
              <button type="button" onClick={() => onPick(v)} className="gp-btn gp-btn-dark mt-4 w-full text-sm">
                {cta} →
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Step 5: everything chosen, in one place
export function PaperPreview({ rows }) {
  return (
    <section className="gp-card p-5 md:p-6">
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#b8862b]">Preview</p>
      <dl className="mt-3 grid grid-cols-2 gap-2.5 lg:grid-cols-3">
        {rows.map(([k, v]) => (
          <div key={k} className="rounded-xl bg-[#fbf7ee] px-3.5 py-2.5 ring-1 ring-[#efe6d2]">
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{k}</dt>
            <dd className="mt-0.5 text-sm font-bold text-slate-900">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}


// Back / Proceed buttons under each step
export function WizardNav({ steps, step, onGo, last }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
      {step > 1 ? (
        <button type="button" onClick={() => onGo(step - 1)} className="text-sm font-semibold text-slate-600 hover:text-slate-900">
          ← Back to {steps[step - 2][0]}
        </button>
      ) : (
        <span />
      )}
      {step < steps.length ? (
        <button type="button" onClick={() => onGo(step + 1)} className="gp-btn gp-btn-dark px-6 py-3.5 text-sm uppercase tracking-wide">
          Proceed to {steps[step][0]} (step {step + 1}) →
        </button>
      ) : (
        last
      )}
    </div>
  );
}
