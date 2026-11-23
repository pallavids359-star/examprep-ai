import { useEffect, useState } from "react";
import api, { getErrorMessage } from "../api/axios";
import QuestionBody from "./QuestionBody";
import { toast } from "./Toaster";
import { CLASS_LABELS, FORMAT_LABELS, FORMAT_SHORT, JEE_ONLY, LEVEL_STYLE, Pill } from "./assignmentHelpers";

const select = "rounded-xl border border-[#e7dcc3] bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#c9a24a] focus:ring-4 focus:ring-[#e5c372]/30";

// Browse the question bank of an assignment's chapters and add questions by hand
export default function AssignmentPicker({ id, count, onChange, onClose }) {
  const [filters, setFilters] = useState({ chapterId: "", topicId: "", difficulty: "", format: "", q: "", hideAdded: false });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [open, setOpen] = useState({});

  // Wait a moment after typing before searching
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => (f.q === search ? f : { ...f, q: search })), 350);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => setPage(1), [filters]);

  useEffect(() => {
    let live = true;
    setError("");
    api
      .get(`/lecturer/assignments/${id}/browse`, { params: { ...filters, hideAdded: filters.hideAdded ? "1" : "", page } })
      .then((res) => live && setData(res.data))
      .catch((err) => live && setError(getErrorMessage(err)));
    return () => {
      live = false;
    };
  }, [id, filters, page]);

  const set = (k, v) => setFilters((f) => ({ ...f, [k]: v, ...(k === "chapterId" ? { topicId: "" } : {}) }));
  const chapter = data?.chapters.find((c) => String(c._id) === filters.chapterId);

  const toggle = async (q) => {
    setBusy(q._id);
    try {
      await api.post(`/lecturer/assignments/${id}/add`, { questionId: q._id, remove: q.added });
      setData((d) => ({ ...d, questions: d.questions.map((x) => (x._id === q._id ? { ...x, added: !q.added } : x)) }));
      onChange();
    } catch (err) {
      toast(getErrorMessage(err), "error");
    } finally {
      setBusy("");
    }
  };

  const addPage = async () => {
    const todo = (data?.questions || []).filter((q) => !q.added);
    if (!todo.length) return;
    setBusy("page");
    try {
      for (const q of todo) await api.post(`/lecturer/assignments/${id}/add`, { questionId: q._id });
      setData((d) => ({ ...d, questions: d.questions.map((x) => ({ ...x, added: true })) }));
      onChange();
      toast(`Added ${todo.length} questions`);
    } catch (err) {
      toast(getErrorMessage(err), "error");
      onChange();
    } finally {
      setBusy("");
    }
  };

  return (
    <section className="gp-card mt-4 overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#17140f] px-5 py-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#e5c372]">Add questions</p>
          <p className="mt-0.5 text-sm text-amber-50/80">
            Pick from the question bank · <b className="text-white">{count}</b> in this assignment
          </p>
        </div>
        <button onClick={onClose} className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/20 hover:bg-white/15">
          Done
        </button>
      </div>

      {/* Filters */}
      <div className="space-y-3 border-b border-[#f1e9d7] bg-[#fffdf8] px-5 py-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <select className={select} value={filters.chapterId} onChange={(e) => set("chapterId", e.target.value)} aria-label="Chapter">
            <option value="">All chapters</option>
            {(data?.chapters || []).map((c) => (
              <option key={c._id} value={c._id}>
                {c.name} {CLASS_LABELS[c.classLevel] ? `(${CLASS_LABELS[c.classLevel]})` : ""}
              </option>
            ))}
          </select>
          <select className={select} value={filters.topicId} onChange={(e) => set("topicId", e.target.value)} disabled={!chapter} aria-label="Concept">
            <option value="">{chapter ? "All concepts" : "Concepts (pick a chapter)"}</option>
            {(chapter?.topics || []).map((t) => (
              <option key={t._id} value={t._id}>
                {t.name}
              </option>
            ))}
          </select>
          <select className={select} value={filters.format} onChange={(e) => set("format", e.target.value)} aria-label="Question type">
            <option value="">All question types</option>
            {(data?.formats || []).map((f) => (
              <option key={f} value={f}>
                {FORMAT_LABELS[f]}
                {JEE_ONLY.includes(f) ? " (JEE)" : ""}
              </option>
            ))}
          </select>
          <input className={select} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search question text…" aria-label="Search" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {[
            ["", "Any level"],
            ["easy", "Easy"],
            ["medium", "Medium"],
            ["hard", "Hard"],
          ].map(([v, l]) => (
            <button
              key={v}
              type="button"
              onClick={() => set("difficulty", v)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${filters.difficulty === v ? "bg-[#17140f] text-[#e5c372]" : "bg-[#f3ecdc] text-slate-700 hover:bg-[#ece1c7]"}`}
            >
              {l}
            </button>
          ))}
          <label className="ml-auto inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" className="h-4 w-4 accent-[#b8862b]" checked={filters.hideAdded} onChange={(e) => set("hideAdded", e.target.checked)} />
            Hide questions already added
          </label>
        </div>
      </div>

      {/* Results */}
      <div className="px-5 py-4">
        {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {!data && !error && <div className="h-40 animate-pulse rounded-xl bg-[#f3ecdc]" />}
        {data && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-600">
              {data.total ? `${data.total} matching · page ${data.page} of ${data.pages}` : "No questions match these filters."}
            </p>
            {data.questions.some((q) => !q.added) && (
              <button onClick={addPage} disabled={busy === "page"} className="gp-ghost-btn px-3 py-1.5 text-xs font-semibold disabled:opacity-60">
                {busy === "page" ? "Adding…" : "+ Add all on this page"}
              </button>
            )}
          </div>
        )}
        <div className="space-y-3">
          {(data?.questions || []).map((q) => {
            const isOpen = open[q._id];
            return (
              <article key={q._id} className={`overflow-hidden rounded-2xl border transition ${q.added ? "border-[#c9a24a] bg-[#fffaf0]" : "border-[#efe6d2] bg-white"}`}>
                <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
                  <span className="min-w-0 truncate text-xs font-semibold text-slate-600">
                    {q.chapter}
                    {q.topic ? ` · ${q.topic}` : ""}
                  </span>
                  <span className="ml-auto flex flex-wrap gap-1.5">
                    {q.format && <Pill cls="bg-[#f3ecdc] text-slate-700 ring-[#e7dcc3]">{FORMAT_SHORT[q.format] || q.format}</Pill>}
                    {q.difficulty && <Pill cls={LEVEL_STYLE[q.difficulty] || ""}>{q.difficulty}</Pill>}
                  </span>
                </div>
                <div className={`px-4 py-3 ${isOpen ? "" : "max-h-40 overflow-hidden [mask-image:linear-gradient(to_bottom,black_65%,transparent)]"}`}>
                  <QuestionBody q={q} compact solutionOpen={false} />
                </div>
                <div className="flex items-center gap-2 border-t border-[#f1e9d7] px-4 py-2.5">
                  <button onClick={() => setOpen({ ...open, [q._id]: !isOpen })} className="text-sm font-semibold text-[#b8862b] hover:text-[#8a6420]">
                    {isOpen ? "Show less" : "Show full question"}
                  </button>
                  <button
                    onClick={() => toggle(q)}
                    disabled={busy === q._id}
                    className={`ml-auto rounded-xl px-4 py-2 text-sm font-bold transition disabled:opacity-60 ${q.added ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-rose-50 hover:text-rose-700 hover:ring-rose-200" : "gp-gold-btn"}`}
                    title={q.added ? "Click to remove" : "Add to assignment"}
                  >
                    {busy === q._id ? "…" : q.added ? "✓ Added" : "+ Add"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        {data && data.pages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="gp-ghost-btn px-4 py-2 text-sm font-semibold disabled:opacity-40">
              ← Previous
            </button>
            <span className="px-2 text-sm font-semibold text-slate-700">
              {data.page} / {data.pages}
            </span>
            <button onClick={() => setPage((p) => Math.min(data.pages, p + 1))} disabled={page >= data.pages} className="gp-ghost-btn px-4 py-2 text-sm font-semibold disabled:opacity-40">
              Next →
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
