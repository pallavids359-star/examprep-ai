// Small helpers shared by the live test pages
export const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "—";

export const fmtDuration = (sec) => {
  const s = Math.max(0, Math.round(sec || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h) return `${h} h ${m} m`;
  if (m) return `${m} m ${String(r).padStart(2, "0")} s`;
  return `${r} s`;
};

// "in 2 days 3 h", "in 45 min"
export const fmtUntil = (d, now = Date.now()) => {
  const ms = new Date(d).getTime() - now;
  if (ms <= 0) return "now";
  const min = Math.round(ms / 60000);
  if (min < 60) return `in ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `in ${h} h ${min % 60} min`;
  const days = Math.floor(h / 24);
  return `in ${days} day${days > 1 ? "s" : ""} ${h % 24} h`;
};

// Plain text preview of a question (no pictures or formatting)
export const preview = (text, n = 90) => {
  const s = String(text || "").replace(/\{\{IMG::[^}]*\}\}/g, "[diagram]").replace(/\$+/g, "").replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
};

export const PHASE = {
  draft: { label: "Draft", cls: "bg-slate-100 text-slate-700" },
  scheduled: { label: "Scheduled", cls: "bg-indigo-50 text-indigo-700" },
  open: { label: "Open now", cls: "bg-green-50 text-green-700" },
  closed: { label: "Closed", cls: "bg-amber-50 text-amber-800" },
  archived: { label: "Deleted", cls: "bg-red-50 text-red-700" },
};

// For <input type="datetime-local">: local time without seconds
export const toLocalInput = (d) => {
  if (!d) return "";
  const x = new Date(d);
  const pad = (n) => String(n).padStart(2, "0");
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`;
};

// Lecturer subjects (Botany and Zoology sections go to Biology lecturers)
export const LECTURER_SUBJECTS = [
  ["physics", "Physics", "P"],
  ["chemistry", "Chemistry", "C"],
  ["mathematics", "Maths", "M"],
  ["biology", "Biology", "B"],
];
export const subjectOfSection = (key) => (key === "botany" || key === "zoology" ? "biology" : key);
export const subjectName = (k) => LECTURER_SUBJECTS.find(([v]) => v === k)?.[1] || "No subject";
// Lecturers who teach this section's subject, then everyone else
export const lecturersFor = (list, sectionKey) => {
  const sub = subjectOfSection(sectionKey);
  return { match: list.filter((l) => l.subject === sub), other: list.filter((l) => l.subject !== sub) };
};
