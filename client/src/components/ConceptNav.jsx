import { useMemo } from "react";

// Shared by the live-test picker and the assignment picker.
// Chapter tabs and concept chips (with how many questions each has) to jump straight to them
export default function ConceptNav({ topics, focusChapter, focusTopic, onJump, picked = [], loading, className = "gp-card lg:sticky lg:top-3" }) {
  const byChapter = useMemo(() => {
    const out = [];
    for (const t of topics) {
      const cid = String(t.chapterId || t.chapter);
      let c = out.find((x) => x.id === cid);
      if (!c) out.push((c = { id: cid, name: t.chapter, topics: [], count: 0 }));
      c.topics.push(t);
      c.count += t.count || 0;
    }
    return out;
  }, [topics]);
  if (!topics.length) return null;
  const all = byChapter.reduce((a, c) => a + c.count, 0);
  const shownChapter = byChapter.find((c) => c.id === focusChapter) || (byChapter.length === 1 ? byChapter[0] : null);
  const inPaper = (tid) => picked.filter((q) => String(q.topicId) === String(tid)).length;
  const tab = (on) => `shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${on ? "bg-[#17140f] text-[#e5c372] shadow" : "bg-white text-slate-700 ring-1 ring-[#e7dcc3] hover:ring-[#c9a24a]"}`;

  return (
    <div className={`z-10 space-y-3 p-3 sm:p-4 ${className} ${loading ? "opacity-80" : ""}`}>
      <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
        <span className="shrink-0 text-[11px] font-bold uppercase tracking-wider text-slate-500">Chapter</span>
        {byChapter.length > 1 && (
          <button type="button" onClick={() => onJump("")} className={tab(!focusChapter)}>
            All <span className="opacity-70">{all}</span>
          </button>
        )}
        {byChapter.map((c) => (
          <button key={c.id} type="button" onClick={() => onJump(byChapter.length > 1 ? c.id : "")} className={tab(byChapter.length === 1 || focusChapter === c.id)}>
            {c.name} <span className="opacity-70">{c.count}</span>
          </button>
        ))}
      </div>
      {shownChapter ? (
        <div className="flex max-h-28 flex-wrap items-center gap-1.5 overflow-y-auto border-t border-[#f1e9d7] pt-3">
          <span className="mr-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">Concept</span>
          <button type="button" onClick={() => onJump(focusChapter, "")} className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${!focusTopic ? "bg-[#c9a24a] text-white" : "bg-[#f8f2e4] text-slate-700 hover:bg-[#f1e6cc]"}`}>
            All concepts
          </button>
          {shownChapter.topics.map((t) => {
            const n = inPaper(t._id);
            const on = focusTopic === String(t._id);
            return (
              <button key={t._id} type="button" onClick={() => onJump(focusChapter, String(t._id))} className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${on ? "bg-[#c9a24a] text-white" : "bg-[#f8f2e4] text-slate-700 hover:bg-[#f1e6cc]"}`}>
                {t.name} <span className="opacity-70">{t.count}</span>
                {n > 0 && <span className={`ml-1 rounded px-1 ${on ? "bg-white/25" : "bg-green-100 text-green-800"}`}>✓{n}</span>}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="border-t border-[#f1e9d7] pt-3 text-xs text-slate-500">Pick a chapter above to see its concepts, or scroll — questions are grouped chapter by chapter, concept by concept.</p>
      )}
    </div>
  );
}

