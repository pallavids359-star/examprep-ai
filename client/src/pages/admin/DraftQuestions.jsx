import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api, { getErrorMessage } from "../../api/axios";
import AdminLayout from "../../components/AdminLayout";
import QuestionBody from "../../components/QuestionBody";
import { askConfirm } from "../../components/ConfirmDialog";
import { toast } from "../../components/Toaster";

const select = "w-full rounded-xl border border-[#e7dcc3] bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-[#c9a24a] focus:ring-4 focus:ring-[#e5c372]/30 disabled:opacity-50";
const QTYPES = [
  ["", "All question types"],
  ["mcq", "Single correct"],
  ["multi", "More than one correct"],
  ["assertion", "Assertion and reason"],
  ["match", "Match the following"],
  ["statement", "Statement based"],
  ["numerical", "Numerical"],
];
const LEVEL = { easy: "bg-emerald-50 text-emerald-700 ring-emerald-200", medium: "bg-amber-50 text-amber-800 ring-amber-200", hard: "bg-rose-50 text-rose-700 ring-rose-200" };
const EMPTY = { subjectId: "", classLevel: "", chapterId: "", topicId: "", qtype: "", difficulty: "", q: "" };

// Admin: questions that are not reviewed yet (draft). Check them, edit, then publish.
export default function DraftQuestions() {
  const [exams, setExams] = useState([]);
  const [examId, setExamId] = useState(localStorage.getItem("examId") || "");
  const [tree, setTree] = useState({ subjects: [], chapters: [], topics: [] });
  const [filters, setFilters] = useState(EMPTY);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    api
      .get("/exams")
      .then((res) => {
        setExams(res.data.exams);
        if (!examId && res.data.exams[0]) setExamId(res.data.exams[0]._id);
      })
      .catch((err) => setError(getErrorMessage(err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!examId) return;
    localStorage.setItem("examId", examId);
    api
      .get("/admin/syllabus-filters", { params: { examId } })
      .then((res) => setTree(res.data))
      .catch((err) => setError(getErrorMessage(err)));
  }, [examId]);

  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => (f.q === search ? f : { ...f, q: search })), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!examId) return;
    const params = { page, limit: 20, examId, status: "draft" };
    Object.entries(filters).forEach(([k, v]) => v && (params[k] = v));
    setData(null);
    api
      .get("/admin/questions", { params })
      .then((res) => {
        setData(res.data);
        setError("");
      })
      .catch((err) => setError(getErrorMessage(err)));
  }, [examId, filters, page, reload]);

  useEffect(() => setPicked([]), [data]);

  const change = (next) => {
    setPage(1);
    setFilters((f) => ({ ...f, ...next }));
  };
  const chapters = useMemo(
    () => tree.chapters.filter((c) => (!filters.subjectId || String(c.subjectId) === filters.subjectId) && (!filters.classLevel || c.classLevel === filters.classLevel)),
    [tree, filters.subjectId, filters.classLevel]
  );
  const topics = useMemo(() => tree.topics.filter((t) => String(t.chapterId) === filters.chapterId), [tree, filters.chapterId]);
  const nameOf = (list, id) => list.find((x) => String(x._id) === String(id))?.name || "";

  const setStatus = async (ids, status, label) => {
    setBusy(label);
    try {
      const res = await api.post("/admin/questions/status", { ids, status });
      const sb = res.data.supabase || {};
      if (status !== "published") toast(`Deleted ${res.data.updated}`);
      else {
        const n = res.data.updated;
        let msg = `Published ${n} question${n === 1 ? "" : "s"}.`;
        if (sb.enabled && sb.accepted) msg += ` Accepted in Supabase: ${sb.accepted}.`;
        toast(msg);
        if (sb.enabled && sb.failed) toast(`Supabase: ${sb.failed} not accepted. ${sb.errors?.[0] || ""}`, "error");
      }
      setReload((n) => n + 1);
    } catch (err) {
      toast(getErrorMessage(err), "error");
    } finally {
      setBusy("");
    }
  };
  const removeMany = async (ids) => {
    if (!(await askConfirm(`Delete ${ids.length} question${ids.length === 1 ? "" : "s"}? Students will never get ${ids.length === 1 ? "it" : "them"}.`, { title: "Delete questions?", confirmText: "Delete", danger: true }))) return;
    setStatus(ids, "archived", "delete");
  };

  const questions = data?.questions || [];
  const allOn = questions.length > 0 && questions.every((q) => picked.includes(q._id));
  const back = encodeURIComponent("/admin/drafts");

  return (
    <AdminLayout>
      {/* Header */}
      <section className="gp-hero mt-2 p-6 md:p-8">
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-200/80">Question bank</p>
            <h1 className="mt-2 text-3xl font-extrabold text-white md:text-4xl">Draft questions</h1>
            <p className="gp-muted mt-2 text-[15px]">Not reviewed yet, so students never get them. Check each one, edit if needed, then publish it.</p>
          </div>
          <div className="rounded-2xl bg-white/5 px-5 py-3 text-right ring-1 ring-amber-200/20">
            <p className="text-[11px] font-bold uppercase tracking-widest text-amber-200/70">{Object.values(filters).some(Boolean) ? "Matching" : "Drafts"}</p>
            <p className="font-display text-3xl font-extrabold text-white">{data ? data.total.toLocaleString("en-IN") : "…"}</p>
          </div>
        </div>
      </section>

      {/* Filters */}
      <div className="gp-card mt-5 space-y-3 p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <select value={examId} onChange={(e) => { setPage(1); setFilters(EMPTY); setSearch(""); setExamId(e.target.value); }} className={select} aria-label="Exam">
            {exams.map((e) => <option key={e._id} value={e._id}>{e.code}</option>)}
          </select>
          <select value={filters.subjectId} onChange={(e) => change({ subjectId: e.target.value, chapterId: "", topicId: "" })} className={select} aria-label="Subject">
            <option value="">All subjects</option>
            {tree.subjects.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
          </select>
          <select value={filters.classLevel} onChange={(e) => change({ classLevel: e.target.value, chapterId: "", topicId: "" })} className={select} aria-label="Class">
            <option value="">1st + 2nd PUC</option>
            <option value="11">1st PUC</option>
            <option value="12">2nd PUC</option>
          </select>
          <select value={filters.chapterId} onChange={(e) => change({ chapterId: e.target.value, topicId: "" })} className={select} aria-label="Chapter">
            <option value="">All chapters</option>
            {chapters.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
          <select value={filters.topicId} onChange={(e) => change({ topicId: e.target.value })} disabled={!filters.chapterId} className={select} aria-label="Concept">
            <option value="">{filters.chapterId ? "All concepts" : "Concepts (pick a chapter)"}</option>
            {topics.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
          </select>
          <select value={filters.qtype} onChange={(e) => change({ qtype: e.target.value })} className={select} aria-label="Question type">
            {QTYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select value={filters.difficulty} onChange={(e) => change({ difficulty: e.target.value })} className={select} aria-label="Difficulty">
            <option value="">Any difficulty</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search question text…" className={select} aria-label="Search" />
        </div>
      </div>

      {error && <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {/* Select bar */}
      {questions.length > 0 && (
        <div className="sticky top-0 z-10 mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-[#e7dcc3] bg-[#fffdf8]/95 px-4 py-3 backdrop-blur">
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700">
            <input type="checkbox" className="h-4 w-4 accent-[#b8862b]" checked={allOn} onChange={() => setPicked(allOn ? [] : questions.map((q) => q._id))} />
            Select all on this page
          </label>
          <span className="text-sm text-slate-500">{picked.length ? `${picked.length} selected` : `Page ${data.page} of ${data.pages}`}</span>
          <span className="ml-auto flex gap-2">
            <button type="button" disabled={!picked.length || Boolean(busy)} onClick={() => setStatus(picked, "published", "publish-many")} className="gp-gold-btn px-4 py-2 text-sm disabled:opacity-40">
              {busy === "publish-many" ? "Publishing…" : `Publish selected${picked.length ? ` (${picked.length})` : ""}`}
            </button>
            <button type="button" disabled={!picked.length || Boolean(busy)} onClick={() => removeMany(picked)} className="rounded-xl px-3 py-2 text-sm font-semibold text-rose-700 ring-1 ring-rose-200 hover:bg-rose-50 disabled:opacity-40">
              Delete selected
            </button>
          </span>
        </div>
      )}

      {/* List */}
      <div className="mt-4 space-y-4">
        {!data && !error && [0, 1, 2].map((i) => <div key={i} className="gp-card h-48 animate-pulse bg-white/60" />)}
        {data && !questions.length && (
          <div className="gp-card px-6 py-14 text-center">
            <p className="text-lg font-bold text-slate-900">No draft questions here</p>
            <p className="mt-1 text-sm text-slate-500">{Object.values(filters).some(Boolean) ? "Try other filters." : "Every question of this exam is reviewed."}</p>
          </div>
        )}
        {questions.map((q, i) => {
          const on = picked.includes(q._id);
          return (
            <article key={q._id} className={`gp-card overflow-hidden transition ${on ? "ring-2 ring-[#c9a24a]" : ""}`}>
              <div className="flex flex-wrap items-center gap-2 border-b border-[#f1e9d7] bg-[#fffdf8] px-4 py-2.5">
                <input type="checkbox" className="h-4 w-4 accent-[#b8862b]" checked={on} onChange={() => setPicked(on ? picked.filter((x) => x !== q._id) : [...picked, q._id])} aria-label="Select question" />
                <span className="grid h-7 min-w-7 place-items-center rounded-lg bg-[#17140f] px-1.5 font-display text-xs font-bold text-[#e5c372]">{(data.page - 1) * 20 + i + 1}</span>
                <span className="min-w-0 truncate text-xs font-semibold text-slate-600">
                  {[nameOf(tree.subjects, q.subjectId), nameOf(tree.chapters, q.chapterId), nameOf(tree.topics, q.topicId)].filter(Boolean).join(" · ")}
                </span>
                <span className="ml-auto flex items-center gap-1.5">
                  {q.difficulty && <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${LEVEL[q.difficulty] || ""}`}>{q.difficulty}</span>}
                  <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">Draft</span>
                </span>
              </div>
              <div className="px-5 py-4">
                <QuestionBody q={q} compact solutionOpen />
              </div>
              <div className="flex flex-wrap items-center gap-2 border-t border-[#f1e9d7] px-4 py-3">
                <Link to={`/admin/questions/${q._id}?back=${back}`} className="rounded-xl border border-[#e7dcc3] bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:border-[#c9a24a]">
                  ✎ Edit
                </Link>
                <button type="button" disabled={Boolean(busy)} onClick={() => removeMany([q._id])} className="rounded-xl px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50">
                  Delete
                </button>
                <button type="button" disabled={Boolean(busy)} onClick={() => setStatus([q._id], "published", `pub-${q._id}`)} className="gp-gold-btn ml-auto px-5 py-2 text-sm disabled:opacity-50">
                  {busy === `pub-${q._id}` ? "Publishing…" : "✓ Publish"}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {data && data.pages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="gp-ghost-btn px-4 py-2 text-sm font-semibold disabled:opacity-40">← Previous</button>
          <span className="px-2 text-sm font-semibold text-slate-700">{data.page} / {data.pages}</span>
          <button type="button" onClick={() => setPage((p) => Math.min(data.pages, p + 1))} disabled={page >= data.pages} className="gp-ghost-btn px-4 py-2 text-sm font-semibold disabled:opacity-40">Next →</button>
        </div>
      )}
    </AdminLayout>
  );
}
