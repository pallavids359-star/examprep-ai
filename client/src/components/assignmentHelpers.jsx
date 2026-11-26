// Shared words and styles for the assignment pages
export const FORMAT_LABELS = {
  single_correct: "MCQ (single correct)",
  assertion_reason: "Assertion and reason",
  statement_based: "Statement based questions",
  match_following: "Match the following",
  diagram_based: "Diagram based questions",
  true_false: "True / False",
  multi_correct: "Multiple correct answer",
  numerical: "Numerical / integer type",
};
export const JEE_ONLY = ["multi_correct", "numerical"];
export const FORMAT_SHORT = {
  single_correct: "Single correct",
  multi_correct: "Multiple correct",
  assertion_reason: "Assertion–Reason",
  match_following: "Match",
  statement_based: "Statements",
  diagram_based: "Diagram",
  true_false: "True / False",
  numerical: "Numerical",
};
export const CLASS_LABELS = { 11: "1st PUC", 12: "2nd PUC", both: "1st + 2nd PUC" };

export const LEVEL_STYLE = {
  easy: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  medium: "bg-amber-50 text-amber-800 ring-amber-200",
  hard: "bg-rose-50 text-rose-700 ring-rose-200",
};

export const STATE = {
  open: { label: "To do", cls: "bg-amber-50 text-amber-800 ring-amber-200" },
  in_progress: { label: "Started", cls: "bg-indigo-50 text-indigo-700 ring-indigo-200" },
  submitted: { label: "Submitted", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  late: { label: "Due date passed", cls: "bg-rose-50 text-rose-700 ring-rose-200" },
  missed: { label: "Missed", cls: "bg-rose-50 text-rose-700 ring-rose-200" },
  not_started: { label: "Not started", cls: "bg-slate-100 text-slate-600 ring-slate-200" },
  draft: { label: "Draft", cls: "bg-slate-100 text-slate-700 ring-slate-200" },
  published: { label: "Published", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
};

export const audienceText = (a) => `${a.college}${a.sections?.length ? ` · Section ${a.sections.join(", ")}` : " · All sections"}`;

export function Pill({ cls, children }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${cls}`}>{children}</span>;
}
