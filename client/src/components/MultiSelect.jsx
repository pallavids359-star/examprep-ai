import { useEffect, useRef, useState } from "react";

// A dropdown where you can tick several options.
//   options: [[value, label, group?]]   value: array of ticked values
//   allLabel: shown when nothing is ticked ("All chapters")   noun: "chapters"
export default function MultiSelect({ options, value, onChange, allLabel, noun, disabled, disabledLabel, search = options.length > 8 }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const box = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => box.current && !box.current.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const shown = options.filter(([, l]) => !q || l.toLowerCase().includes(q.toLowerCase()));
  const label = disabled
    ? disabledLabel || allLabel
    : !value.length
      ? allLabel
      : value.length === 1
        ? options.find(([v]) => v === value[0])?.[1] || `1 ${noun}`
        : `${value.length} ${noun}`;
  const toggle = (v) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  const allShownOn = shown.length > 0 && shown.every(([v]) => value.includes(v));

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex w-full items-center justify-between gap-2 rounded-xl border bg-white px-3.5 py-2.5 text-left text-sm transition disabled:opacity-50 ${open ? "border-[#c9a24a] ring-4 ring-[#e5c372]/25" : "border-[#e7dcc3] hover:border-[#c9a24a]"}`}
      >
        <span className={`truncate ${value.length ? "font-semibold text-slate-900" : "text-slate-700"}`}>{label}</span>
        <span className="flex shrink-0 items-center gap-1.5">
          {value.length > 1 && <span className="rounded-full bg-[#17140f] px-2 py-0.5 text-[11px] font-bold text-[#e5c372]">{value.length}</span>}
          <svg viewBox="0 0 24 24" className={`h-4 w-4 text-slate-400 transition ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-30 mt-1.5 min-w-[16rem] overflow-hidden rounded-2xl border border-[#e7dcc3] bg-[#fffdf8] shadow-2xl shadow-black/10">
          {search && (
            <div className="border-b border-[#f1e9d7] p-2">
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Find ${noun}…`} className="w-full rounded-lg border border-[#e7dcc3] bg-white px-3 py-2 text-sm outline-none focus:border-[#c9a24a]" />
            </div>
          )}
          <div className="flex items-center justify-between border-b border-[#f1e9d7] px-3 py-2 text-xs">
            <button
              type="button"
              onClick={() => onChange(allShownOn ? value.filter((v) => !shown.some(([s]) => s === v)) : [...new Set([...value, ...shown.map(([v]) => v)])])}
              className="font-bold text-[#9a7a2c] hover:underline"
            >
              {allShownOn ? "Untick all" : q ? "Tick all found" : "Tick all"}
            </button>
            {value.length > 0 && (
              <button type="button" onClick={() => onChange([])} className="font-semibold text-slate-500 hover:text-slate-900">
                Clear ({value.length})
              </button>
            )}
          </div>
          <ul role="listbox" aria-multiselectable="true" className="max-h-72 overflow-y-auto py-1">
            {shown.map(([v, l, group], i) => {
              const on = value.includes(v);
              const head = group && group !== shown[i - 1]?.[2];
              return (
                <li key={v}>
                  {head && <p className="px-3 pb-1 pt-2.5 text-[11px] font-bold uppercase tracking-wider text-[#b8862b]">{group}</p>}
                  <button type="button" role="option" aria-selected={on} onClick={() => toggle(v)} className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition ${on ? "bg-[#fbf3df]" : "hover:bg-[#fbf7ee]"}`}>
                    <span className={`grid h-4.5 w-4.5 shrink-0 place-items-center rounded border ${on ? "border-[#b8862b] bg-[#b8862b] text-white" : "border-slate-300 bg-white"}`} style={{ height: 18, width: 18 }}>
                      {on && (
                        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    <span className={on ? "font-semibold text-slate-900" : "text-slate-700"}>{l}</span>
                  </button>
                </li>
              );
            })}
            {!shown.length && <li className="px-3 py-4 text-center text-sm text-slate-500">Nothing found</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
