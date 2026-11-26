// Small building blocks shared by the student pages, so every page looks the same.
import { Link } from "react-router-dom";
import { cx, toneBar, toneSoft } from "./uiHelpers";


// Title area at the top of a page
export function PageHeader({ eyebrow, title, subtitle, actions }) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-700">{eyebrow}</p>}
        <h1 className="mt-1 text-2xl font-bold text-slate-900 md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function Card({ className = "", children, ...rest }) {
  return (
    <section className={cx("rounded-2xl border border-slate-200 bg-white", className)} {...rest}>
      {children}
    </section>
  );
}

export function CardTitle({ children, hint, right }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h2 className="font-semibold text-slate-900">{children}</h2>
        {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
      </div>
      {right}
    </div>
  );
}

// One number with a label
export function StatTile({ label, value, sub, accent }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={cx("mt-1 text-2xl font-bold tabular-nums md:text-[1.7rem]", accent || "text-slate-900")}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

// Two or three big options side by side (like tabs)
export function Segmented({ options, value, onChange, label }) {
  return (
    <div className={cx("grid gap-1.5 rounded-2xl border border-slate-200 bg-slate-100/70 p-1.5 sm:gap-2", options.length === 3 ? "grid-cols-3" : "grid-cols-2")} role="tablist" aria-label={label}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.value)}
            className={cx(
              "min-w-0 rounded-xl px-2.5 py-2.5 text-left transition sm:px-4",
              on ? "bg-white shadow-[0_4px_14px_-8px_rgba(70,48,10,0.45)] ring-1 ring-indigo-300" : "hover:bg-white/60"
            )}
          >
            <span className={cx("block truncate text-[13px] font-semibold sm:text-sm", on ? "text-slate-900" : "text-slate-600")}>{o.label}</span>
            {o.hint && <span className="block truncate text-xs text-slate-500">{o.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}

// Small round filter button
export function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        "rounded-full border px-3.5 py-1.5 text-sm font-medium transition",
        active ? "border-slate-900 bg-slate-900 text-[#f2d68e]" : "border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-900"
      )}
    >
      {children}
    </button>
  );
}


export function Bar({ value, className = "" }) {
  const v = Math.max(Math.min(Number(value) || 0, 100), 0);
  return (
    <div className={cx("h-2 w-full overflow-hidden rounded-full bg-slate-100", className)}>
      <div className={cx("h-full rounded-full", toneBar(v))} style={{ width: `${Math.max(v, 2)}%` }} />
    </div>
  );
}

export function Pct({ value }) {
  const v = Math.round((Number(value) || 0) * 10) / 10;
  return <span className={cx("inline-block min-w-[3.5rem] rounded-full px-2 py-0.5 text-center text-xs font-semibold tabular-nums", toneSoft(v))}>{v}%</span>;
}

export function EmptyBlock({ title, text, actionLabel, actionTo }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-10 text-center">
      <p className="font-semibold text-slate-900">{title}</p>
      {text && <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{text}</p>}
      {actionTo && (
        <Link to={actionTo} className="mt-4 inline-block rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white">
          {actionLabel}
        </Link>
      )}
    </div>
  );
}

export function Icon({ d, className = "h-5 w-5" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}


