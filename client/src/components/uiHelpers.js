// Helpers shared by the student pages (kept apart from components for fast refresh)

export const cx = (...parts) => parts.filter(Boolean).join(" ");

export const toneText = (p) => (p >= 75 ? "text-emerald-700" : p >= 50 ? "text-amber-700" : "text-red-700");
export const toneSoft = (p) => (p >= 75 ? "bg-emerald-50 text-emerald-700" : p >= 50 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700");
export const toneBar = (p) => (p >= 75 ? "bg-emerald-500" : p >= 50 ? "bg-amber-500" : "bg-red-500");

export const ICONS = {
  chevron: "M6 9l6 6 6-6",
  arrow: "M5 12h14M13 6l6 6-6 6",
  wrong: "M4 4v6h6M20 20v-6h-6M5.5 15a7.5 7.5 0 0013.5 2M18.5 9A7.5 7.5 0 005 7",
  bookmark: "M6 3h12v18l-6-4-6 4z",
  target: "M12 3a9 9 0 100 18 9 9 0 000-18zM12 8a4 4 0 100 8 4 4 0 000-8z",
  trophy: "M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0zM5 5H3v2a3 3 0 003 3M19 5h2v2a3 3 0 01-3 3",
  clock: "M12 7v5l3 2M12 3a9 9 0 100 18 9 9 0 000-18z",
};

export const when = (d) =>
  new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
export const shortDate = (d) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
export const minutes = (s) => {
  const m = Math.round((s || 0) / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
};
export const round1 = (n) => Math.round((Number(n) || 0) * 10) / 10;

// Makes a whole table row (or card) open a page: click anywhere on it, or Enter when focused.
// Clicks on a button, link or field inside the row still do their own job.
export const rowLink = (navigate, to) =>
  to
    ? {
        role: "link",
        tabIndex: 0,
        onClick: (e) => {
          if (e.target.closest("a,button,input,select,textarea,label") || window.getSelection()?.toString()) return;
          if (e.ctrlKey || e.metaKey) window.open(to, "_blank");
          else navigate(to);
        },
        onKeyDown: (e) => {
          if (e.key === "Enter" && e.target === e.currentTarget) navigate(to);
        },
      }
    : {};
export const ROW_CLICK = "cursor-pointer transition hover:bg-[#fbf5e6] focus:outline-none focus-visible:bg-[#fbf5e6]";
