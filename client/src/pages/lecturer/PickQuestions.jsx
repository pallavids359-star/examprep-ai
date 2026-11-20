import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api, { getErrorMessage } from "../../api/axios";
import LecturerLayout from "../../components/LecturerLayout";
import QuestionBody from "../../components/QuestionBody";
import { toast } from "../../components/Toaster";
import { fmtUntil, preview } from "../../components/liveHelpers";
import { Ring } from "../../components/premium";

// The lecturer picks questions for one section of a live test:
// class -> chapters -> concepts -> questions grouped by concept, with answers and solutions.
const pill = (on) =>
  `rounded-lg border px-3 py-1.5 text-sm font-medium ${on ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-slate-300 text-slate-700 hover:border-slate-400"}`;

const DIFFS = [
  ["any", "Any level"],
  ["easy", "Easy"],
  ["medium", "Medium"],
  ["hard", "Hard"],
];
const TYPES = [
  ["all", "All types"],
  ["mcq", "MCQ"],
  ["numerical", "Numerical"],
];

export default function PickQuestions() {
  const { id, key } = useParams();
  const [info, setInfo] = useState(null); // section, chapters, editable...
  const [picked, setPicked] = useState([]); // full question objects, in paper order
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Filters
  const [classLevel, setClassLevel] = useState("both");
  const [chapterIds, setChapterIds] = useState([]);
  const [topicIds, setTopicIds] = useState([]);
  const [type, setType] = useState("all");
  const [difficulty, setDifficulty] = useState("any");
  const [diagram, setDiagram] = useState(false);
  const [hideUsed, setHideUsed] = useState(true);
  const [page, setPage] = useState(1);
  const [topicsByChapter, setTopicsByChapter] = useState({});

  const [results, setResults] = useState(null);
  const [loadingResults, setLoadingResults] = useState(false);
  const [showSolutions, setShowSolutions] = useState(true);
  const [showConcepts, setShowConcepts] = useState(false);
  const [moreFilters, setMoreFilters] = useState(false);
  const [testStatus, setTestStatus] = useState(null);
  const listTop = useRef(null);

  const load = useCallback(() => {
    api
      .get(`/lecturer/live-tests/${id}/sections/${key}`)
      .then((res) => {
        setInfo(res.data);
        setPicked(res.data.questions);
        setTestStatus(res.data.test.status);
      })
      .catch((err) => setError(getErrorMessage(err)));
  }, [id, key]);
  useEffect(load, [load]);

  // Concepts of the ticked chapters
  useEffect(() => {
    chapterIds
      .filter((c) => !topicsByChapter[c])
      .forEach((c) => {
        setTopicsByChapter((p) => ({ ...p, [c]: "loading" }));
        api
          .get(`/chapters/${c}/topics`)
          .then((res) => setTopicsByChapter((p) => ({ ...p, [c]: res.data.topics })))
          .catch(() => setTopicsByChapter((p) => ({ ...p, [c]: [] })));
      });
  }, [chapterIds, topicsByChapter]);

  // Questions for the current filters
  useEffect(() => {
    if (!info || chapterIds.length === 0) {
      setResults(null);
      return;
    }
    let cancelled = false;
    setLoadingResults(true);
    api
      .get(`/lecturer/live-tests/${id}/sections/${key}/questions`, {
        params: {
          classLevel,
          chapterIds: chapterIds.join(","),
          topicIds: topicIds.join(","),
          type,
          difficulty,
          diagram: diagram ? "1" : "0",
          hideUsed: hideUsed ? "1" : "0",
          page,
        },
      })
      .then((res) => !cancelled && setResults(res.data))
      .catch((err) => !cancelled && toast(getErrorMessage(err), "error"))
      .finally(() => !cancelled && setLoadingResults(false));
    return () => {
      cancelled = true;
    };
  }, [info, id, key, classLevel, chapterIds, topicIds, type, difficulty, diagram, hideUsed, page]);

  // Any filter change goes back to page 1
  const filtered = (fn) => (...args) => {
    setPage(1);
    fn(...args);
  };

  const chapters = info?.chapters || [];
  const visibleChapters = chapters.filter((c) => classLevel === "both" || c.classLevel === classLevel);
  const classes = [...new Set(visibleChapters.map((c) => c.classLevel))].sort();
  const pickedIds = useMemo(() => new Set(picked.map((q) => String(q._id))), [picked]);
  const sec = info?.section;
  const mcqPicked = picked.filter((q) => q.type !== "numerical").length;
  const numPicked = picked.filter((q) => q.type === "numerical").length;
  const complete = sec && mcqPicked === sec.mcqCount && numPicked === sec.numericalCount;
  const editable = Boolean(info?.editable);

  const toggleChapter = (cid) => {
    setPage(1);
    if (chapterIds.includes(cid)) {
      const gone = new Set((Array.isArray(topicsByChapter[cid]) ? topicsByChapter[cid] : []).map((t) => t._id));
      setTopicIds((p) => p.filter((t) => !gone.has(t)));
      setChapterIds((p) => p.filter((c) => c !== cid));
    } else setChapterIds((p) => [...p, cid]);
  };
  const setClassChapters = (cl, on) => {
    setPage(1);
    const ids = visibleChapters.filter((c) => c.classLevel === cl).map((c) => c._id);
    setChapterIds((p) => (on ? [...new Set([...p, ...ids])] : p.filter((c) => !ids.includes(c))));
    if (!on) setTopicIds((p) => p.filter((t) => !ids.some((c) => (Array.isArray(topicsByChapter[c]) ? topicsByChapter[c] : []).some((x) => x._id === t))));
  };

  // Save the whole list; the server puts numericals last and checks every rule
  const save = async (next) => {
    const before = picked;
    setPicked(next);
    setSaving(true);
    try {
      const res = await api.put(`/lecturer/live-tests/${id}/sections/${key}`, { questionIds: next.map((q) => q._id) });
      if (res.data.testStatus === "published" && testStatus !== "published") toast("Every subject is ready. The test opens by itself at its start time.");
      setTestStatus(res.data.testStatus);
    } catch (err) {
      setPicked(before);
      toast(getErrorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };
  const add = (q) => {
    if (q.type === "numerical" && numPicked >= sec.numericalCount) return toast(`All ${sec.numericalCount} numerical questions are picked. Remove one first.`, "error");
    if (q.type !== "numerical" && mcqPicked >= sec.mcqCount) return toast(`All ${sec.mcqCount} MCQs are picked. Remove one first.`, "error");
    const next = [...picked, q];
    save([...next.filter((x) => x.type !== "numerical"), ...next.filter((x) => x.type === "numerical")]);
  };
  const remove = (qid) => save(picked.filter((q) => String(q._id) !== String(qid)));
  const move = (index, dir) => {
    const next = [...picked];
    const j = index + dir;
    if (j < 0 || j >= next.length || (next[index].type === "numerical") !== (next[j].type === "numerical")) return;
    [next[index], next[j]] = [next[j], next[index]];
    save(next);
  };

  // Let GenPrep pick the remaining questions (from the ticked chapters, if any)
  const autoFill = async () => {
    setSaving(true);
    try {
      const res = await api.post(`/lecturer/live-tests/${id}/sections/${key}/autopick`, { chapterIds, classLevel });
      if (res.data.shortMcq || res.data.shortNumerical) {
        toast(`Added ${res.data.added}. These chapters ran out: still ${res.data.shortMcq} MCQ and ${res.data.shortNumerical} numerical needed. Tick more chapters and try again.`, "error");
      } else toast(`Added ${res.data.added} questions`);
      load();
    } catch (err) {
      toast(getErrorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };

  // Group the page's questions by concept
  const groups = useMemo(() => {
    const out = [];
    for (const q of results?.questions || []) {
      const last = out[out.length - 1];
      if (last && String(last.topicId) === String(q.topicId)) last.questions.push(q);
      else {
        const t = (results.topics || []).find((x) => String(x._id) === String(q.topicId));
        out.push({ topicId: q.topicId, name: q.topic, chapter: q.chapter, total: t?.count || 0, questions: [q] });
      }
    }
    return out;
  }, [results]);

  if (error) {
    return (
      <LecturerLayout>
        <div className="mx-auto max-w-3xl px-4 py-10">
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          <Link to="/lecturer" className="mt-4 inline-block text-sm font-medium text-indigo-700 hover:underline">
            ← Your sections
          </Link>
        </div>
      </LecturerLayout>
    );
  }
  if (!info) {
    return (
      <LecturerLayout>
        <p className="px-4 py-10 text-center text-sm text-slate-500">Loading...</p>
      </LecturerLayout>
    );
  }

  const total = sec.mcqCount + sec.numericalCount;
  const pickedCount = mcqPicked + numPicked;

  return (
    <LecturerLayout>
      {/* Section header with progress */}
      <div className="gp-topbar sticky top-0 z-20">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3">
          <div className="min-w-0">
            <Link to="/lecturer" className="text-xs font-semibold text-amber-200 hover:underline">
              ← Your sections
            </Link>
            <p className="truncate text-xs font-semibold uppercase tracking-[0.12em] text-amber-100/60">
              {info.exam?.code} · {info.test.title}
            </p>
            <h1 className="text-xl font-extrabold text-white">{sec.name}: pick the questions</h1>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Ring value={total ? (pickedCount / total) * 100 : 0} size={52} stroke={6} dark tone={complete ? "green" : "gold"} />
            <div className="min-w-[200px]">
              <p className="text-sm text-amber-50">
                <b>
                  {pickedCount} of {total}
                </b>{" "}
                picked · {mcqPicked}/{sec.mcqCount} MCQ{sec.numericalCount ? ` · ${numPicked}/${sec.numericalCount} numerical` : ""}
                {saving && <span className="ml-2 text-xs text-amber-200/60">Saving...</span>}
              </p>
            </div>
            {complete ? (
              <span className="rounded-xl bg-green-500/15 px-3 py-2 text-sm font-semibold text-green-300 ring-1 ring-green-400/30">
                Done ✓ {testStatus === "published" ? `Opens ${fmtUntil(info.test.startsAt)}` : "Waiting for the other subjects"}
              </span>
            ) : (
              editable && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={autoFill}
                  className="gp-gold-btn px-4 py-2.5 text-sm disabled:opacity-50"
                  title={chapterIds.length ? "Picks from the ticked chapters" : "Picks from the whole syllabus"}
                >
                  Auto-fill the rest{chapterIds.length ? " from ticked chapters" : ""}
                </button>
              )
            )}
          </div>
        </div>
        {!editable && (
          <p className="bg-amber-50 px-4 py-2 text-center text-sm text-amber-800">
            The test has opened, so its questions can't change now.
          </p>
        )}
      </div>

      <div className="mx-auto flex max-w-7xl flex-wrap items-start gap-6 px-4 py-6">
        {/* Filters */}
        <aside className="w-full space-y-4 lg:w-72 lg:shrink-0" aria-label="Filters">
          <section className="gp-card p-4">
            <h2 className="text-sm font-semibold text-slate-900">1. Choose class</h2>
            <div className="mt-2 flex gap-2">
              {[
                ["11", "11"],
                ["12", "12"],
                ["both", "Both"],
              ].map(([v, l]) => (
                <button key={v} type="button" className={`${pill(classLevel === v)} flex-1`} onClick={filtered(() => setClassLevel(v))}>
                  {l}
                </button>
              ))}
            </div>
          </section>

          <section className="gp-card p-4">
            <h2 className="text-sm font-semibold text-slate-900">2. Tick chapters</h2>
            {classes.length === 0 && <p className="mt-2 text-sm text-slate-500">No chapters for this class.</p>}
            {classes.map((cl) => {
              const list = visibleChapters.filter((c) => c.classLevel === cl);
              const allOn = list.every((c) => chapterIds.includes(c._id));
              return (
                <div key={cl} className="mt-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Class {cl}</p>
                    <button type="button" className="text-xs font-semibold text-amber-800 hover:underline" onClick={() => setClassChapters(cl, !allOn)}>
                      {allOn ? "Clear" : "Select all"}
                    </button>
                  </div>
                  <div className="mt-1 max-h-64 space-y-1 overflow-y-auto pr-1">
                    {list.map((c) => (
                      <label key={c._id} className="flex cursor-pointer items-start gap-2 rounded-md px-1 py-1 text-sm text-slate-800 hover:bg-slate-50">
                        <input type="checkbox" className="mt-0.5 h-4 w-4 accent-indigo-600" checked={chapterIds.includes(c._id)} onChange={() => toggleChapter(c._id)} />
                        <span>{c.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </section>

          {chapterIds.length > 0 && !showConcepts && (
            <button type="button" onClick={() => setShowConcepts(true)} className="w-full rounded-2xl border border-dashed border-slate-300 bg-white p-3 text-sm font-medium text-indigo-700 hover:border-indigo-400">
              + Narrow down to concepts{topicIds.length ? ` (${topicIds.length} ticked)` : ""}
            </button>
          )}
          {chapterIds.length > 0 && showConcepts && (
            <section className="gp-card p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">
                  Concepts <span className="font-normal text-slate-500">(optional)</span>
                </h2>
                <button type="button" onClick={() => setShowConcepts(false)} className="text-xs font-semibold text-amber-800 hover:underline">
                  Hide
                </button>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">Nothing ticked = every concept of the chosen chapters.</p>
              <div className="mt-2 max-h-80 space-y-3 overflow-y-auto pr-1">
                {chapterIds.map((cid) => {
                  const ch = chapters.find((c) => c._id === cid);
                  const ts = topicsByChapter[cid];
                  return (
                    <div key={cid}>
                      <p className="text-xs font-semibold text-slate-600">{ch?.name}</p>
                      {ts === "loading" || !ts ? (
                        <p className="text-xs text-slate-400">Loading...</p>
                      ) : (
                        ts.map((t) => (
                          <label key={t._id} className="flex cursor-pointer items-start gap-2 rounded-md px-1 py-0.5 text-sm text-slate-800 hover:bg-slate-50">
                            <input
                              type="checkbox"
                              className="mt-0.5 h-4 w-4 accent-indigo-600"
                              checked={topicIds.includes(t._id)}
                              onChange={filtered(() => setTopicIds((p) => (p.includes(t._id) ? p.filter((x) => x !== t._id) : [...p, t._id])))}
                            />
                            <span>{t.name}</span>
                          </label>
                        ))
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {!moreFilters ? (
            <button type="button" onClick={() => setMoreFilters(true)} className="w-full rounded-2xl border border-dashed border-slate-300 bg-white p-3 text-sm font-medium text-indigo-700 hover:border-indigo-400">
              + More filters (type, level, diagrams)
            </button>
          ) : (
          <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Show only</h2>
              <button type="button" onClick={() => setMoreFilters(false)} className="text-xs font-semibold text-amber-800 hover:underline">
                Hide
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {TYPES.map(([v, l]) => (
                <button key={v} type="button" className={pill(type === v)} onClick={filtered(() => setType(v))}>
                  {l}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {DIFFS.map(([v, l]) => (
                <button key={v} type="button" className={pill(difficulty === v)} onClick={filtered(() => setDifficulty(v))}>
                  {l}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-800">
              <input type="checkbox" className="h-4 w-4 accent-indigo-600" checked={diagram} onChange={filtered(() => setDiagram((v) => !v))} />
              With a diagram only
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-800">
              <input type="checkbox" className="h-4 w-4 accent-indigo-600" checked={hideUsed} onChange={filtered(() => setHideUsed((v) => !v))} />
              Hide questions used in other live tests
            </label>
          </section>
          )}
        </aside>

        {/* Questions grouped by concept */}
        <main className="min-w-0 flex-[999_1_480px] space-y-4" ref={listTop}>
          {chapterIds.length === 0 ? (
            <div className="gp-card p-10 text-center text-slate-500">
              Tick one or more chapters to see their questions. Or press <b>Auto-fill the rest</b> and GenPrep picks for you.
            </div>
          ) : !results ? (
            <p className="text-sm text-slate-500">Loading questions...</p>
          ) : results.total === 0 ? (
            <div className="gp-card p-10 text-center text-slate-500">No questions match these filters.</div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-slate-600">
                  {results.total} questions{loadingResults ? " · loading..." : ""}
                </p>
                <button type="button" onClick={() => setShowSolutions((v) => !v)} className="text-sm font-semibold text-amber-800 hover:underline">
                  {showSolutions ? "Collapse all solutions" : "Open all solutions"}
                </button>
              </div>
              {groups.map((g) => {
                const inTopic = picked.filter((q) => String(q.topicId) === String(g.topicId)).length;
                return (
                  <section key={`${g.topicId}-${g.questions[0]._id}`} className="space-y-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2 pt-2">
                      <h2 className="text-lg font-bold text-slate-900">
                        {g.name} <span className="text-sm font-normal text-slate-500">· {g.chapter}</span>
                      </h2>
                      <span className="text-sm text-slate-500">
                        {g.total} questions · {inTopic} picked
                      </span>
                    </div>
                    {g.questions.map((q) => {
                      const isPicked = pickedIds.has(String(q._id));
                      return (
                        <article key={q._id} className={`gp-card p-5 transition ${isPicked ? "ring-2 ring-amber-500" : ""}`}>
                          <div className="mb-3 flex flex-wrap gap-1.5 text-xs">
                            <span className={`rounded-full px-2.5 py-0.5 font-medium ${q.type === "numerical" ? "bg-orange-50 text-orange-800" : "bg-blue-50 text-blue-800"}`}>
                              {q.type === "numerical" ? "Numerical" : q.type === "mcq_multi" ? "MCQ (multi)" : "MCQ"}
                            </span>
                            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-medium capitalize text-slate-700">{q.difficulty}</span>
                            {q.classLevel && <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-slate-700">Class {q.classLevel}</span>}
                            {q.diagram && <span className="rounded-full bg-violet-50 px-2.5 py-0.5 font-medium text-violet-800">Diagram</span>}
                            {q.source?.kind === "pyq" && <span className="rounded-full bg-amber-50 px-2.5 py-0.5 font-medium text-amber-800">PYQ {q.source.year || ""}</span>}
                          </div>
                          <QuestionBody key={`${q._id}-${showSolutions}`} q={q} solutionOpen={showSolutions} compact />
                          {editable && (
                            <div className="mt-4 flex justify-end">
                              {isPicked ? (
                                <button type="button" onClick={() => remove(q._id)} disabled={saving} className="rounded-xl border border-green-600 bg-green-50 px-4 py-2 text-sm font-semibold text-green-800 disabled:opacity-50">
                                  ✓ Added · Remove
                                </button>
                              ) : (
                                <button type="button" onClick={() => add(q)} disabled={saving} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                                  + Add to paper
                                </button>
                              )}
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </section>
                );
              })}
              {results.pages > 1 && (
                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => {
                      setPage((p) => p - 1);
                      listTop.current?.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium disabled:opacity-40"
                  >
                    ← Previous
                  </button>
                  <span className="text-sm text-slate-600">
                    Page {results.page} of {results.pages}
                  </span>
                  <button
                    type="button"
                    disabled={page >= results.pages}
                    onClick={() => {
                      setPage((p) => p + 1);
                      listTop.current?.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium disabled:opacity-40"
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
        </main>

        {/* The paper so far */}
        <aside className="w-full rounded-2xl border border-slate-200 bg-white p-4 lg:sticky lg:top-28 lg:w-72 lg:shrink-0" aria-label="Paper so far">
          <h2 className="font-semibold text-slate-900">{sec.name} paper so far</h2>
          <p className="mt-0.5 text-xs text-slate-500">MCQs first, numericals last. Use the arrows to change the order.</p>
          {picked.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Nothing picked yet.</p>
          ) : (
            <ol className="mt-3 max-h-[60vh] space-y-1.5 overflow-y-auto pr-1 text-sm">
              {picked.map((q, i) => (
                <li key={q._id} className="flex items-start gap-2 rounded-lg px-1 py-1 hover:bg-slate-50">
                  <span className="w-6 shrink-0 text-right font-semibold text-slate-500">{i + 1}.</span>
                  <span className="min-w-0 flex-1 text-slate-800">
                    {preview(q.text, 60)}
                    <span className="block text-xs text-slate-500">
                      {q.topic}
                      {q.type === "numerical" ? " · numerical" : ""}
                    </span>
                  </span>
                  {editable && (
                    <span className="flex shrink-0 gap-0.5">
                      <button type="button" aria-label="Move up" onClick={() => move(i, -1)} className="rounded px-1 text-slate-500 hover:bg-slate-200">
                        ↑
                      </button>
                      <button type="button" aria-label="Move down" onClick={() => move(i, 1)} className="rounded px-1 text-slate-500 hover:bg-slate-200">
                        ↓
                      </button>
                      <button type="button" aria-label="Remove" onClick={() => remove(q._id)} className="rounded px-1 text-red-600 hover:bg-red-50">
                        ×
                      </button>
                    </span>
                  )}
                </li>
              ))}
            </ol>
          )}
          {!complete && (
            <p className="mt-3 rounded-lg bg-slate-50 p-2 text-sm text-slate-700">
              Still needed: <b>{Math.max(0, sec.mcqCount - mcqPicked)} MCQ</b>
              {sec.numericalCount ? (
                <>
                  {" "}
                  and <b>{Math.max(0, sec.numericalCount - numPicked)} numerical</b>
                </>
              ) : null}
            </p>
          )}
        </aside>
      </div>

    </LecturerLayout>
  );
}
