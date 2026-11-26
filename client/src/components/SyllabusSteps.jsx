import { useEffect, useState } from "react";
import { Step } from "./premium";
import { CLASS_LABELS } from "./assignmentHelpers";

// The Class -> Chapters -> Concepts steps, shared by "New assignment" and the live-test picker,
// so both look and work the same.

const input = "w-full rounded-xl border border-[#e7dcc3] bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#c9a24a] focus:ring-4 focus:ring-[#e5c372]/30";

export function Choice({ on, onClick, children, sub, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-2xl border px-4 py-3 text-left transition ${on ? "border-[#17140f] bg-[#17140f] text-white shadow-lg shadow-black/10" : "border-[#e7dcc3] bg-white text-slate-800 hover:border-[#c9a24a]"} ${className}`}
    >
      <span className="block text-sm font-bold">{children}</span>
      {sub && <span className={`mt-0.5 block text-xs ${on ? "text-[#e5c372]" : "text-slate-500"}`}>{sub}</span>}
    </button>
  );
}

export function Tick({ on }) {
  return (
    <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border transition ${on ? "border-[#b8862b] bg-[#b8862b] text-white" : "border-slate-300 bg-white"}`}>
      {on && (
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 13l4 4L19 7" />
        </svg>
      )}
    </span>
  );
}

export function WizCard({ n, title, hint, right, children }) {
  return (
    <section className="gp-card p-5 md:p-6">
      <Step n={n} title={title} hint={hint} right={right} />
      <div className="mt-5">{children}</div>
    </section>
  );
}

// Class: 1st PUC / 2nd PUC / Both
export function ClassChoices({ value, onChange, counts }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {[
        ["11", "1st PUC", "Class 11"],
        ["12", "2nd PUC", "Class 12"],
        ["both", "Both", "1st + 2nd PUC"],
      ].map(([v, l, sub]) => (
        <Choice key={v} on={value === v} onClick={() => onChange(v)} sub={counts ? `${sub} · ${counts[v] ?? 0} chapters` : sub}>
          {l}
        </Choice>
      ))}
    </div>
  );
}

// Chapters: search + tick tiles + Tick all
// chapters = every chapter of the subject (null while loading); ids are strings
export function ChapterStep({ n = "2", chapters, classLevel, chapterIds, onToggle, onSetMany }) {
  const [search, setSearch] = useState("");
  const inClass = (chapters || []).filter((c) => classLevel === "both" || String(c.classLevel) === classLevel);
  const visible = inClass.filter((c) => c.name.toLowerCase().includes(search.trim().toLowerCase()));
  const allOn = visible.length > 0 && visible.every((c) => chapterIds.includes(String(c._id)));

  return (
    <WizCard
      n={n}
      title="Chapters"
      hint={`${chapterIds.length} of ${inClass.length} ticked`}
      right={
        inClass.length > 0 && (
          <button type="button" onClick={() => onSetMany(visible.map((c) => String(c._id)), !allOn)} className="gp-ghost-btn px-3 py-1.5 text-xs font-semibold">
            {allOn ? "Untick all" : "Tick all"}
          </button>
        )
      }
    >
      {!chapters ? (
        <div className="h-32 animate-pulse rounded-xl bg-[#f3ecdc]" />
      ) : !inClass.length ? (
        <p className="rounded-xl bg-[#faf6ec] px-4 py-6 text-center text-sm text-slate-500">No {CLASS_LABELS[classLevel]} chapters for this subject.</p>
      ) : (
        <>
          <input className={input} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search chapters…" />
          <div className="mt-3 grid max-h-[26rem] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
            {visible.map((c) => {
              const on = chapterIds.includes(String(c._id));
              return (
                <button
                  key={c._id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onToggle(String(c._id))}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition ${on ? "border-[#c9a24a] bg-[#fbf5e6]" : "border-[#efe6d2] bg-white hover:border-[#e0cfa6]"}`}
                >
                  <Tick on={on} />
                  <span className="min-w-0 flex-1 font-medium text-slate-800">{c.name}</span>
                  {classLevel === "both" && <span className="shrink-0 text-[11px] font-semibold text-slate-400">{CLASS_LABELS[c.classLevel] || ""}</span>}
                </button>
              );
            })}
            {!visible.length && <p className="col-span-full py-4 text-center text-sm text-slate-500">No chapter matches.</p>}
          </div>
        </>
      )}
    </WizCard>
  );
}

// Concepts: a tab per ticked chapter, its concepts as ticks, "Select all concepts"
// picked = ticked chapters as [{ _id, name, topics: [{ _id, name }] | null (loading) }]
export function ConceptStep({ n = "3", picked, topicIds, setTopicIds, hint }) {
  const [tab, setTab] = useState("");
  useEffect(() => {
    if (!picked.some((c) => String(c._id) === tab)) setTab(String(picked[0]?._id || ""));
  }, [picked, tab]);
  const tabChapter = picked.find((c) => String(c._id) === tab);
  const topicsOf = (c) => (Array.isArray(c.topics) ? c.topics : []);
  const conceptsIn = (c) => topicsOf(c).filter((t) => topicIds.includes(String(t._id))).length;
  const all = picked.flatMap((c) => topicsOf(c).map((t) => String(t._id)));
  const allOn = all.length > 0 && all.every((id) => topicIds.includes(id));
  const toggle = (id) => setTopicIds(topicIds.includes(id) ? topicIds.filter((x) => x !== id) : [...topicIds, id]);

  return (
    <WizCard
      n={n}
      title="Concepts"
      hint={hint || (topicIds.length ? `${topicIds.length} concepts chosen` : "Optional · leave empty to use every concept")}
      right={
        picked.length > 0 && (
          <div className="flex gap-2">
            {all.length > 0 && (
              <button type="button" onClick={() => setTopicIds(allOn ? [] : all)} className="gp-ghost-btn px-3 py-1.5 text-xs font-semibold">
                {allOn ? "Untick all" : `Select all concepts (${all.length})`}
              </button>
            )}
            {topicIds.length > 0 && !allOn && (
              <button type="button" onClick={() => setTopicIds([])} className="gp-ghost-btn px-3 py-1.5 text-xs font-semibold">
                Clear
              </button>
            )}
          </div>
        )
      }
    >
      {!picked.length ? (
        <p className="rounded-xl bg-[#faf6ec] px-4 py-6 text-center text-sm text-slate-500">Tick chapters first.</p>
      ) : (
        <>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {picked.map((c) => {
              const on = String(c._id) === tab;
              const k = conceptsIn(c);
              return (
                <button
                  key={c._id}
                  type="button"
                  onClick={() => setTab(String(c._id))}
                  className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${on ? "bg-[#17140f] text-[#e5c372]" : "bg-[#f3ecdc] text-slate-700 hover:bg-[#ece1c7]"}`}
                >
                  {c.name}
                  {k > 0 && <span className={`ml-1.5 rounded-full px-1.5 ${on ? "bg-[#e5c372] text-[#17140f]" : "bg-white text-[#b8862b]"}`}>{k}</span>}
                </button>
              );
            })}
          </div>
          {tabChapter && (
            <div className="mt-3 rounded-2xl border border-[#efe6d2] bg-[#fffdf8] p-3">
              {!Array.isArray(tabChapter.topics) ? (
                <div className="h-20 animate-pulse rounded-xl bg-[#f3ecdc]" />
              ) : !tabChapter.topics.length ? (
                <p className="py-3 text-center text-sm text-slate-500">This chapter has no concepts listed. All its questions will be used.</p>
              ) : (
                <>
                  {(() => {
                    const ids = tabChapter.topics.map((t) => String(t._id));
                    const chOn = ids.every((id) => topicIds.includes(id));
                    return (
                      <div className="mb-2 flex items-center justify-between border-b border-[#f3ecdc] px-1.5 pb-2.5">
                        <span className="text-xs font-semibold text-slate-500">
                          {ids.filter((id) => topicIds.includes(id)).length} of {ids.length} concepts in this chapter
                        </span>
                        <button
                          type="button"
                          onClick={() => setTopicIds(chOn ? topicIds.filter((id) => !ids.includes(id)) : [...new Set([...topicIds, ...ids])])}
                          className="text-xs font-bold text-[#9a7a2c] hover:underline"
                        >
                          {chOn ? "Untick this chapter" : "Select all in this chapter"}
                        </button>
                      </div>
                    );
                  })()}
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {tabChapter.topics.map((t) => {
                      const on = topicIds.includes(String(t._id));
                      return (
                        <button
                          key={t._id}
                          type="button"
                          aria-pressed={on}
                          onClick={() => toggle(String(t._id))}
                          className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition ${on ? "bg-[#fbf1d9] text-slate-900" : "text-slate-700 hover:bg-[#faf6ec]"}`}
                        >
                          <Tick on={on} />
                          {t.name}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
          {topicIds.length > 0 && <p className="mt-2 text-xs text-slate-500">Chapters where you pick no concepts use all of their concepts.</p>}
        </>
      )}
    </WizCard>
  );
}

// Back / Proceed under each step (same look as the assignment form)
export function StepNav({ backLabel, onBack, nextLabel, onNext, nextDisabled, extra }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
      {onBack ? (
        <button type="button" onClick={onBack} className="text-sm font-semibold text-slate-600 hover:text-slate-900">
          ← {backLabel}
        </button>
      ) : (
        <span />
      )}
      <div className="flex flex-wrap items-center gap-2">
        {extra}
        <button type="button" disabled={nextDisabled} onClick={onNext} className="gp-btn gp-btn-dark px-6 py-3.5 text-sm uppercase tracking-wide disabled:opacity-40">
          {nextLabel} →
        </button>
      </div>
    </div>
  );
}
