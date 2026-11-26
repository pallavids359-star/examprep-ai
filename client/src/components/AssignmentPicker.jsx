import { useEffect, useState } from "react";
import api, { getErrorMessage } from "../api/axios";
import QuestionBody from "./QuestionBody";
import MathText from "./MathText";
import QuestionPreviewModal from "./QuestionPreviewModal";
import ConceptNav from "./ConceptNav";
import { toast } from "./Toaster";
import { CLASS_LABELS, FORMAT_LABELS, FORMAT_SHORT, JEE_ONLY, LEVEL_STYLE, Pill } from "./assignmentHelpers";

const select = "rounded-xl border border-[#e7dcc3] bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#c9a24a] focus:ring-4 focus:ring-[#e5c372]/30";

// Browse the question bank of an assignment's chapters and add questions by hand
export default function AssignmentPicker({ id, count, selected = [], onChange, onClose }) {
  const [filters, setFilters] = useState({ chapterId: "", topicId: "", difficulty: "", format: "", q: "", hideAdded: false });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [open, setOpen] = useState({});
  const [pane, setPane] = useState("list"); // phones: "list" or "selected"
  const [viewing, setViewing] = useState(null); // index in "Selected questions" shown in full

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

  // Remove from the "Selected questions" side
  const removeSelected = async (q) => {
    setBusy(q._id);
    try {
      await api.post(`/lecturer/assignments/${id}/add`, { questionId: q._id, remove: true });
      setData((d) => (d ? { ...d, questions: d.questions.map((x) => (x._id === q._id ? { ...x, added: false } : x)) } : d));
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
            The question list and your selected questions (<b className="text-white">{count}</b>)
          </p>
        </div>
        <button onClick={onClose} className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/20 hover:bg-white/15">
          Done
        </button>
      </div>

      {/* Phones: switch between the two lists */}
      <div className="flex border-b border-[#f1e9d7] lg:hidden" role="tablist">
        {[
          ["list", "Question list"],
          ["selected", `Selected (${count})`],
        ].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={pane === k} onClick={() => setPane(k)} className={`flex-1 py-3 text-sm font-bold ${pane === k ? "border-b-2 border-[#c9a24a] text-slate-900" : "text-slate-500"}`}>
            {l}
          </button>
        ))}
      </div>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className={`min-w-0 ${pane === "list" ? "" : "hidden lg:block"}`}>
      <p className="hidden border-b border-[#f1e9d7] bg-[#fbf6ea] px-5 py-2.5 text-xs font-bold uppercase tracking-[0.18em] text-[#b8862b] lg:block">Question list · tick the ones you want</p>
      {/* Filters */}
      <div className="space-y-3 border-b border-[#f1e9d7] bg-[#fffdf8] px-5 py-4">
        <div className="grid gap-2 sm:grid-cols-2">
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

      {data?.topicCounts?.length > 0 && (
        <ConceptNav
          className="border-b border-[#f1e9d7] bg-white"
          topics={data.topicCounts}
          focusChapter={filters.chapterId}
          focusTopic={filters.topicId}
          onJump={(chapterId, topicId = "") => setFilters((f) => ({ ...f, chapterId, topicId }))}
          picked={selected}
        />
      )}

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
                {busy === "page" ? "Adding…" : "✓ Select all on this page"}
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
      </div>

      {/* Right: the questions already selected, in order */}
      <aside className={`border-[#f1e9d7] bg-[#fdfbf6] lg:border-l ${pane === "selected" ? "" : "hidden lg:block"}`}>
        <div className="lg:sticky lg:top-0">
          <div className="flex items-center justify-between border-b border-[#f1e9d7] bg-[#fbf6ea] px-5 py-2.5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#b8862b]">Selected questions</p>
            <span className="rounded-full bg-[#17140f] px-2.5 py-0.5 text-xs font-bold text-[#e5c372]">{count}</span>
          </div>
          {!selected.length ? (
            <p className="px-5 py-10 text-center text-sm text-slate-500">Nothing selected yet. Click “+ Add” on a question on the left.</p>
          ) : (
            <ol className="max-h-[75vh] space-y-2 overflow-y-auto p-3">
              {selected.map((q, i) => (
                <li key={q._id} className={`flex gap-2.5 rounded-xl bg-white p-3 ring-1 transition hover:ring-[#c9a24a] ${viewing === i ? "ring-[#c9a24a]" : "ring-[#efe6d2]"}`}>
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-[#17140f] text-[11px] font-bold text-[#e5c372]">{i + 1}</span>
                  <button type="button" onClick={() => setViewing(i)} title="See the full question" className="min-w-0 flex-1 text-left hover:opacity-80">
                    <div className="line-clamp-2 text-sm text-slate-800">
                      <MathText text={String(q.text || "").replace(/\{\{IMG::[^}]*\}\}/g, "[image]").slice(0, 220)} />
                    </div>
                    <p className="mt-1 truncate text-[11px] text-slate-500">
                      {q.chapter}
                      {q.format ? ` · ${FORMAT_SHORT[q.format] || q.format}` : ""}
                      {q.difficulty ? ` · ${q.difficulty}` : ""}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeSelected(q)}
                    disabled={busy === q._id}
                    aria-label={`Remove question ${i + 1}`}
                    title="Remove"
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>
      </aside>
      </div>
      {viewing !== null && selected.length > 0 && (
        <QuestionPreviewModal
          list={selected}
          index={Math.min(viewing, selected.length - 1)}
          onIndex={setViewing}
          onRemove={async (q) => {
            await removeSelected(q);
            if (selected.length <= 1) setViewing(null);
          }}
          onClose={() => setViewing(null)}
        />
      )}
    </section>
  );
}
