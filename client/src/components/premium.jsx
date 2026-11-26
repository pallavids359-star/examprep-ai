import { useEffect, useState } from "react";

// Showcase building blocks used across the redesigned pages.

// Circular progress (0–100). Gold on a soft track.
export function Ring({ value = 0, size = 64, stroke = 7, label, sub, tone = "gold", dark = false }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  const colors = { gold: ["#d2a446", "#f0d48d"], green: ["#1f8a4c", "#3ddc84"], orange: ["#c2560c", "#f59e42"] }[tone] || ["#d2a446", "#f0d48d"];
  const id = `ring-${tone}-${size}`;
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }} role="img" aria-label={`${Math.round(v)}%${label ? ` ${label}` : ""}`}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <defs>
          <linearGradient id={id} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor={colors[1]} />
            <stop offset="100%" stopColor={colors[0]} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={dark ? "rgba(255,250,240,0.12)" : "#efe5cf"} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (v / 100) * c}
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center leading-tight">
        <div>
          <div className={`font-display font-extrabold ${dark ? "text-white" : "text-slate-900"}`} style={{ fontSize: size * 0.24 }}>
            {label ?? `${Math.round(v)}%`}
          </div>
          {sub && <div className={`text-[10px] ${dark ? "text-amber-200/80" : "text-slate-500"}`}>{sub}</div>}
        </div>
      </div>
    </div>
  );
}

// Donut made of parts: [{ value, color, label }]
export function Donut({ parts, size = 160, stroke = 22, center, centerSub }) {
  const total = parts.reduce((a, p) => a + p.value, 0) || 1;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" role="img" aria-label={parts.map((p) => `${p.label} ${p.value}`).join(", ")}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#efe5cf" strokeWidth={stroke} />
        {parts.map((p) => {
          const len = (p.value / total) * c;
          const el = (
            <circle
              key={p.label}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={p.color}
              strokeWidth={stroke}
              strokeDasharray={`${Math.max(0, len - 2)} ${c}`}
              strokeDashoffset={-offset}
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="font-display text-3xl font-extrabold text-slate-900">{center}</div>
          {centerSub && <div className="text-xs text-slate-500">{centerSub}</div>}
        </div>
      </div>
    </div>
  );
}

// Live countdown to a time: "02 : 14 : 09"
export function Countdown({ to, onDone, dark = true, compact = false }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const ms = new Date(to).getTime() - now;
  useEffect(() => {
    if (ms <= 0 && onDone) onDone();
  }, [ms <= 0]); // eslint-disable-line react-hooks/exhaustive-deps
  const s = Math.max(0, Math.floor(ms / 1000));
  const parts = [
    [Math.floor(s / 86400), "days"],
    [Math.floor((s % 86400) / 3600), "hrs"],
    [Math.floor((s % 3600) / 60), "min"],
    [s % 60, "sec"],
  ].filter((p, i) => i > 0 || p[0] > 0);
  return (
    <div className="flex items-end gap-2" role="timer" aria-live="off">
      {parts.map(([n, l]) => (
        <div key={l} className={`text-center ${compact ? "min-w-[2.5rem]" : "min-w-[3.4rem]"}`}>
          <div
            className={`gp-clock rounded-xl ${compact ? "px-2 py-1 text-xl" : "px-3 py-2 text-3xl"} font-extrabold ${
              dark ? "bg-white/10 text-white ring-1 ring-amber-200/20" : "bg-amber-50 text-slate-900 ring-1 ring-amber-200"
            }`}
          >
            {String(n).padStart(2, "0")}
          </div>
          <div className={`mt-1 text-[10px] font-semibold uppercase tracking-widest ${dark ? "text-amber-200/70" : "text-slate-500"}`}>{l}</div>
        </div>
      ))}
    </div>
  );
}

// Number tile with an icon
// With onClick it becomes a button (e.g. shows that group of tests); "active" outlines it
export function Stat({ label, value, sub, icon, accent = false, onClick, active = false }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      {...(onClick ? { type: "button", onClick, "aria-pressed": active } : {})}
      className={`gp-card min-w-0 p-3.5 text-left sm:p-5 ${onClick ? "group w-full cursor-pointer transition hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus-visible:ring-4 focus-visible:ring-[#e5c372]/50" : ""} ${active ? "ring-2 ring-[#c9a24a]" : ""}`}
    >
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <p className="min-w-0 text-[11px] font-semibold uppercase leading-tight tracking-wider text-slate-500 sm:text-xs">{label}</p>
        {icon && (
          <span className={`hidden h-9 w-9 shrink-0 place-items-center rounded-xl sm:grid ${accent ? "bg-slate-900 text-amber-200" : "bg-amber-50 text-amber-700"}`}>
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={icon} />
            </svg>
          </span>
        )}
      </div>
      <p className="mt-1.5 whitespace-nowrap font-display text-2xl font-extrabold tabular-nums text-slate-900 sm:mt-2 sm:text-3xl">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] leading-snug text-slate-500 sm:text-xs">{sub}</p>}
      {onClick && <p className="mt-2 text-[11px] font-semibold text-[#b8862b] opacity-70 transition group-hover:opacity-100 sm:text-xs">{active ? "Showing ✓" : "Show these →"}</p>}
    </Tag>
  );
}

// Section heading with a numbered gold step
export function Step({ n, title, hint, right }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="gp-step">
        <span className="gp-step-num">{n}</span>
        <div>
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          {hint && <p className="text-sm text-slate-500">{hint}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

// Big page title used by every redesigned page
export function Hero({ eyebrow, title, subtitle, children, right }) {
  return (
    <section className="gp-hero p-6 md:p-8">
      <div className="relative flex flex-wrap items-center justify-between gap-6">
        <div className="min-w-0 max-w-2xl">
          {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-200/80">{eyebrow}</p>}
          <h1 className="mt-2 text-3xl font-extrabold text-white md:text-4xl">{title}</h1>
          {subtitle && <p className="gp-muted mt-2 text-[15px]">{subtitle}</p>}
          {children}
        </div>
        {right}
      </div>
    </section>
  );
}

export const ICONS = {
  clock: "M12 7v5l3 2M12 3a9 9 0 100 18 9 9 0 000-18z",
  users: "M16 19v-1a4 4 0 00-4-4H6a4 4 0 00-4 4v1M9 10a3 3 0 100-6 3 3 0 000 6zM22 19v-1a4 4 0 00-3-3.9M16 4.1a3 3 0 010 5.8",
  check: "M5 13l4 4L19 7",
  bolt: "M13 2L3 14h8l-1 8 10-12h-8z",
  trophy: "M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0zM17 5h3v2a3 3 0 01-3 3M7 5H4v2a3 3 0 003 3",
  target: "M12 3a9 9 0 100 18 9 9 0 000-18zM12 8a4 4 0 100 8 4 4 0 000-8zM12 11.5a.5.5 0 100 1 .5.5 0 000-1z",
  book: "M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2zM4 5v16",
  calendar: "M8 3v3M16 3v3M4 8h16M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z",
  sparkle: "M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4zM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z",
};
