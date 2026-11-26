import { useEffect, useMemo, useState } from "react";
import QuestionBody from "./QuestionBody";
import Loading from "./Loading";
import { FORMAT_SHORT, LEVEL_STYLE } from "./assignmentHelpers";

// Swap pop-up, shared by assignments and live tests.
// The lecturer says what the new question should be (class, chapter, concept, level, type),
// then either lets GenPrep pick one (Automatic) or picks it from the list (Choose myself).
//
// Props:
//   q, number, subjectName
//   loadChapters()            -> [{ _id, name, classLevel, topics? }]
//   loadTopics(chapterId)     -> [{ _id, name }]   (only when chapters come without topics)
//   formats                   -> question types allowed in this paper
//   loadCandidates(choices, page) -> { questions, page, pages, total }
//   inPaper                   -> Set of question ids already on the paper
//   onAuto(choices), onPick(question) -> Promise<boolean>   (true closes the pop-up)
//   onClose()

const LABEL = "mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500";
const SELECT = "w-full rounded-xl border border-[#e7dcc3] bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#c9a24a] focus:ring-4 focus:ring-[#e5c372]/30";
const CLASS_OPTS = [["both", "Both"], ["11", "1st PUC"], ["12", "2nd PUC"]];
const LEVEL_OPTS = [["any", "Any"], ["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"]];

function Seg({ value, onChange, options }) {
  return (
    <div className="grid gap-1 rounded-xl bg-[#f8f2e4] p-1 ring-1 ring-[#e7dcc3]" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map(([v, l]) => (
        <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)} className={`rounded-lg px-1 py-1.5 text-xs font-semibold transition ${value === v ? "bg-[#17140f] text-[#e5c372] shadow" : "text-slate-700 hover:bg-white"}`}>
          {l}
        </button>
      ))}
    </div>
  );
}

export default function SwapDialog({ q, number, subjectName, loadChapters, loadTopics, formats = [], loadCandidates, inPaper, onAuto, onPick, onClose }) {
  const [chapters, setChapters] = useState(null);
  const [topicsByChapter, setTopicsByChapter] = useState({});
  const [mode, setMode] = useState("auto");
  const [classLevel, setClassLevel] = useState(q.classLevel === "11" || q.classLevel === "12" ? String(q.classLevel) : "both");
  const [chapterId, setChapterId] = useState(q.chapterId ? String(q.chapterId) : "");
  const [topicId, setTopicId] = useState(q.topicId ? String(q.topicId) : "");
  const [difficulty, setDifficulty] = useState("any");
  const [format, setFormat] = useState("");
  const [busy, setBusy] = useState(false);
  const [list, setList] = useState(null);
  const [page, setPage] = useState(1);
  const [showCurrent, setShowCurrent] = useState(false);

  // Close with Esc, and stop the page behind from scrolling
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [busy, onClose]);

  useEffect(() => {
    let live = true;
    Promise.resolve(loadChapters())
      .then((cs) => {
        if (!live) return;
        setChapters(cs || []);
        const withTopics = {};
        (cs || []).forEach((c) => c.topics && (withTopics[String(c._id)] = c.topics));
        setTopicsByChapter(withTopics);
      })
      .catch(() => live && setChapters([]));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Concepts of the chosen chapter (fetched when the chapters came without them)
  useEffect(() => {
    if (!chapterId || topicsByChapter[chapterId] || !loadTopics) return;
    let live = true;
    Promise.resolve(loadTopics(chapterId))
      .then((ts) => live && setTopicsByChapter((m) => ({ ...m, [chapterId]: ts || [] })))
      .catch(() => live && setTopicsByChapter((m) => ({ ...m, [chapterId]: [] })));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterId, topicsByChapter]);

  const visibleChapters = useMemo(() => (chapters || []).filter((c) => classLevel === "both" || String(c.classLevel) === classLevel), [chapters, classLevel]);
  const topics = topicsByChapter[chapterId] || [];
  const choices = useMemo(
    () => ({
      classLevel: classLevel === "both" ? "" : classLevel,
      chapterId: chapterId || "",
      topicId: topicId || "",
      difficulty: difficulty === "any" ? "" : difficulty,
      format: format || "",
    }),
    [classLevel, chapterId, topicId, difficulty, format]
  );

  // Manual list: reload when the choices or the page change
  const key = JSON.stringify(choices);
  useEffect(() => {
    if (mode !== "manual") return;
    let live = true;
    setList(null);
    Promise.resolve(loadCandidates(choices, page))
      .then((r) => live && setList(r || { questions: [], pages: 0, total: 0, page: 1 }))
      .catch(() => live && setList({ questions: [], pages: 0, total: 0, page: 1, error: true }));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, key, page]);

  const change = (fn) => (v) => {
    setPage(1);
    fn(v);
  };
  const pickClass = change((v) => {
    setClassLevel(v);
    const ch = (chapters || []).find((c) => String(c._id) === chapterId);
    if (ch && v !== "both" && String(ch.classLevel) !== v) {
      setChapterId("");
      setTopicId("");
    }
  });
  const pickChapter = change((v) => {
    setChapterId(v);
    setTopicId("");
  });

  const doAuto = async () => {
    setBusy(true);
    const ok = await onAuto(choices);
    setBusy(false);
    if (ok) onClose();
  };
  const doPick = async (cand) => {
    setBusy(cand._id);
    const ok = await onPick(cand);
    setBusy(false);
    if (ok) onClose();
  };

  const summary = [
    classLevel === "both" ? null : CLASS_OPTS.find(([v]) => v === classLevel)?.[1],
    visibleChapters.find((c) => String(c._id) === chapterId)?.name || "any chapter",
    topics.find((t) => String(t._id) === topicId)?.name || "any concept",
    difficulty === "any" ? null : difficulty,
    format ? FORMAT_SHORT[format] || format : null,
  ].filter(Boolean);

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-[#17140f]/55 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={`Swap question ${number}`} className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl bg-[#fffdf8] shadow-2xl ring-1 ring-[#e7dcc3] sm:rounded-3xl">
        {/* Title */}
        <div className="flex items-start gap-3 border-b border-[#f1e9d7] px-5 py-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#17140f] text-base text-[#e5c372]">⇄</span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg font-bold text-slate-900">Swap question {number}</h2>
            <p className="truncate text-xs text-slate-500">
              Now: {q.chapter}
              {q.topic ? ` · ${q.topic}` : ""} ·{" "}
              <button type="button" onClick={() => setShowCurrent((v) => !v)} className="font-semibold text-[#b8862b] hover:text-[#8a6420]">
                {showCurrent ? "hide" : "see it"}
              </button>
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={Boolean(busy)} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-xl text-lg text-slate-500 hover:bg-[#f6efdf]">
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {showCurrent && (
            <div className="border-b border-[#f1e9d7] bg-white px-5 py-4">
              <QuestionBody q={q} compact solutionOpen={false} />
            </div>
          )}

          {/* What the new question should be */}
          <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
            <div>
              <span className={LABEL}>Subject</span>
              <div className="flex h-[42px] items-center rounded-xl border border-[#e7dcc3] bg-[#f8f2e4] px-3 text-sm font-semibold text-slate-800">{subjectName || "This subject"}</div>
            </div>
            <div>
              <span className={LABEL}>Class</span>
              <Seg value={classLevel} onChange={pickClass} options={CLASS_OPTS} />
            </div>
            <label className="block">
              <span className={LABEL}>Chapter</span>
              <select className={SELECT} value={chapterId} onChange={(e) => pickChapter(e.target.value)} disabled={!chapters}>
                <option value="">{chapters ? "Any chapter" : "Loading…"}</option>
                {visibleChapters.map((c) => (
                  <option key={c._id} value={String(c._id)}>
                    {c.name}
                    {classLevel === "both" && c.classLevel ? ` (${c.classLevel === "11" ? "1st" : "2nd"} PUC)` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={LABEL}>Concept</span>
              <select className={SELECT} value={topicId} onChange={(e) => change(setTopicId)(e.target.value)} disabled={!chapterId}>
                <option value="">{chapterId ? "Any concept" : "Pick a chapter first"}</option>
                {topics.map((t) => (
                  <option key={t._id} value={String(t._id)}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <span className={LABEL}>Difficulty</span>
              <Seg value={difficulty} onChange={change(setDifficulty)} options={LEVEL_OPTS} />
            </div>
            <label className="block">
              <span className={LABEL}>Question type</span>
              <select className={SELECT} value={format} onChange={(e) => change(setFormat)(e.target.value)}>
                <option value="">Any type</option>
                {formats.map((f) => (
                  <option key={f} value={f}>
                    {FORMAT_SHORT[f] || f}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* How to swap */}
          <div className="px-5">
            <div className="grid grid-cols-2 gap-1 rounded-2xl bg-[#f8f2e4] p-1 ring-1 ring-[#e7dcc3]">
              {[
                ["auto", "⚡ Automatic", "GenPrep picks one"],
                ["manual", "☰ Choose myself", "Pick from the list"],
              ].map(([v, l, s]) => (
                <button key={v} type="button" aria-pressed={mode === v} onClick={() => setMode(v)} className={`rounded-xl px-3 py-2.5 text-left transition ${mode === v ? "bg-white shadow ring-1 ring-[#e7dcc3]" : "hover:bg-white/60"}`}>
                  <span className={`block text-sm font-bold ${mode === v ? "text-slate-900" : "text-slate-600"}`}>{l}</span>
                  <span className="block text-[11px] text-slate-500">{s}</span>
                </button>
              ))}
            </div>
          </div>

          {mode === "auto" ? (
            <div className="px-5 py-5">
              <div className="rounded-2xl border border-dashed border-[#e0cf9f] bg-white px-4 py-4 text-sm text-slate-600">
                A random question that is not already on this paper, from: <b className="text-slate-900">{summary.join(" · ")}</b>
              </div>
            </div>
          ) : (
            <div className="space-y-3 px-5 py-5">
              {!list ? (
                <Loading label="Finding questions…" />
              ) : list.questions.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-[#e0cf9f] bg-white px-4 py-8 text-center text-sm text-slate-500">
                  {list.error ? "Couldn't load questions. Try again." : "No questions match. Try Any concept or Any difficulty."}
                </p>
              ) : (
                <>
                  <p className="text-xs font-semibold text-slate-500">{list.total} matching questions</p>
                  {list.questions.map((c) => {
                    const on = inPaper?.has(String(c._id)) || c.added;
                    return (
                      <div key={c._id} className={`rounded-2xl border bg-white ${on ? "border-slate-200 opacity-60" : "border-[#e7dcc3]"}`}>
                        <div className="flex flex-wrap items-center gap-1.5 border-b border-[#f1e9d7] px-4 py-2 text-[11px]">
                          <span className="min-w-0 flex-1 truncate text-slate-500">
                            <b className="text-slate-700">{c.chapter}</b>
                            {c.topic ? ` · ${c.topic}` : ""}
                          </span>
                          {c.format && <span className="rounded-full bg-[#f6efdf] px-2 py-0.5 font-semibold text-slate-700 ring-1 ring-[#e7dcc3]">{FORMAT_SHORT[c.format] || c.format}</span>}
                          {c.difficulty && <span className={`rounded-full px-2 py-0.5 font-semibold capitalize ring-1 ${LEVEL_STYLE[c.difficulty] || ""}`}>{c.difficulty}</span>}
                        </div>
                        <div className="max-h-40 overflow-hidden px-4 py-3 [mask-image:linear-gradient(to_bottom,black_75%,transparent)]">
                          <QuestionBody q={c} compact solutionOpen={false} />
                        </div>
                        <div className="flex justify-end border-t border-[#f1e9d7] px-4 py-2">
                          {on ? (
                            <span className="text-xs font-semibold text-slate-500">Already on the paper</span>
                          ) : (
                            <button type="button" disabled={Boolean(busy)} onClick={() => doPick(c)} className="gp-gold-btn px-4 py-1.5 text-xs disabled:opacity-60">
                              {busy === c._id ? "Swapping…" : "Use this"}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {list.pages > 1 && (
                    <div className="flex items-center justify-center gap-3 pt-1 text-sm">
                      <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-[#e7dcc3] bg-white px-3 py-1.5 font-semibold disabled:opacity-40">
                        ← Prev
                      </button>
                      <span className="text-slate-500">
                        Page {list.page || page} of {list.pages}
                      </span>
                      <button type="button" disabled={page >= list.pages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-[#e7dcc3] bg-white px-3 py-1.5 font-semibold disabled:opacity-40">
                        Next →
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Bottom bar */}
        <div className="flex items-center justify-end gap-2 border-t border-[#f1e9d7] bg-white px-5 py-3">
          <button type="button" onClick={onClose} disabled={Boolean(busy)} className="gp-ghost-btn px-4 py-2 text-sm">
            Cancel
          </button>
          {mode === "auto" && (
            <button type="button" onClick={doAuto} disabled={Boolean(busy) || !chapters} className="gp-gold-btn px-5 py-2 text-sm disabled:opacity-60">
              {busy ? "Swapping…" : "⇄ Swap automatically"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
