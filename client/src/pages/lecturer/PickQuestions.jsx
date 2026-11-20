import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import api, { getErrorMessage } from "../../api/axios";
import LecturerLayout from "../../components/LecturerLayout";
import QuestionBody from "../../components/QuestionBody";
import { toast } from "../../components/Toaster";
import { askConfirm } from "../../components/ConfirmDialog";
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
  const [search] = useSearchParams();
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
  const [view, setView] = useState(search.get("view") === "paper" ? "paper" : "add"); // "add" = browse the bank, "paper" = the questions picked so far
  const [history, setHistory] = useState([]); // earlier versions of the paper, for Undo
  const [swapFor, setSwapFor] = useState(null); // the picked question being replaced by hand
  const [busyId, setBusyId] = useState(null);
  const listTop = useRef(null);
  const remember = (list) => setHistory((h) => [...h.slice(-19), list]);

  const load = useCallback(() => {
    api
      .get(`/lecturer/live-tests/${id}/sections/${key}`)
      .then((res) => {
        setInfo((prev) => {
          if (!prev && res.data.questions.length) setView("paper");
          return res.data;
        });
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
  const save = async (next, { undo = true } = {}) => {
    const before = picked;
    if (undo) remember(before);
    setPicked(next);
    setSaving(true);
    try {
      const res = await api.put(`/lecturer/live-tests/${id}/sections/${key}`, { questionIds: next.map((q) => q._id) });
      if (res.data.testStatus === "published" && testStatus !== "published") toast("Every subject is ready. The test opens by itself at its start time.");
      setTestStatus(res.data.testStatus);
      return true;
    } catch (err) {
      setPicked(before);
      if (undo) setHistory((h) => h.slice(0, -1));
      toast(getErrorMessage(err), "error");
      return false;
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
  const undo = () => {
    const prev = history[history.length - 1];
    if (!prev) return;
    setHistory((h) => h.slice(0, -1));
    save(prev, { undo: false }).then((done) => done && toast("Undone"));
  };
  const clearAll = async () => {
    if (!(await askConfirm(`Remove all ${picked.length} questions from the ${sec.name} paper? You can press Undo right after if you change your mind.`, { title: "Clear the paper?", confirmText: "Remove all", danger: true }))) return;
    if (await save([])) toast("All questions removed. Press Undo to bring them back.");
  };

  // "Send to head lecturer": the lecturer is done; the test goes live once every subject is ready
  const needsSend = sec?.picker === "lecturer";
  const sentAt = sec?.submittedAt;
  const sendToHead = async () => {
    if (!(await askConfirm(`Send your ${sec.name} paper (${picked.length} questions) to the head lecturer? You can take it back to make changes until the test opens.`, { title: "Send to head lecturer?", confirmText: "Send", danger: false }))) return;
    setSaving(true);
    try {
      const res = info.isAdmin && info.section.picker === "lecturer"
        ? await api.post(`/admin/live-tests/${id}/sections/${key}/accept`)
        : await api.post(`/lecturer/live-tests/${id}/sections/${key}/submit`);
      setHistory([]);
      toast(res.data.testStatus === "published" ? "Sent. Every subject is ready, so the test opens by itself at its start time." : `Sent to the head lecturer.${res.data.waitingFor?.length ? ` Still waiting for: ${res.data.waitingFor.join(", ")}.` : ""}`);
      load();
    } catch (err) {
      toast(getErrorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };
  const takeBack = async () => {
    setSaving(true);
    try {
      const res = info.isAdmin
        ? await api.post(`/admin/live-tests/${id}/sections/${key}/reopen`, {})
        : await api.post(`/lecturer/live-tests/${id}/sections/${key}/unsubmit`);
      toast(res.data.testStatus === "draft" ? "Taken back. Make your changes, then send it again." : "Taken back");
      load();
    } catch (err) {
      toast(getErrorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };

  // Swap: GenPrep finds a similar one (same kind, same concept or chapter), or the lecturer chooses
  const swap = async (q, newQuestionId) => {
    setBusyId(String(q._id));
    try {
      const res = await api.post(`/lecturer/live-tests/${id}/sections/${key}/swap`, { questionId: q._id, newQuestionId });
      remember(picked);
      setPicked((list) => list.map((x) => (String(x._id) === String(q._id) ? res.data.question : x)));
      setTestStatus(res.data.testStatus);
      toast(`Question ${res.data.position + 1} swapped`);
      return true;
    } catch (err) {
      toast(getErrorMessage(err), "error");
      return false;
    } finally {
      setBusyId(null);
    }
  };
  const startManualSwap = (q) => {
    setSwapFor(q);
    setView("add");
    setPage(1);
    setClassLevel("both");
    setChapterIds(q.chapterId ? [String(q.chapterId)] : []);
    setTopicIds([]);
    setType(q.type === "numerical" ? "numerical" : "mcq");
    setDifficulty("any");
    setDiagram(false);
    setMoreFilters(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const finishManualSwap = async (newQ) => {
    const target = swapFor;
    if (await swap(target, newQ._id)) {
      setSwapFor(null);
      setView("paper");
      setTimeout(() => document.getElementById(`paper-${newQ._id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 150);
    }
  };
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
    const before = picked;
    try {
      const res = await api.post(`/lecturer/live-tests/${id}/sections/${key}/autopick`, { chapterIds, classLevel });
      if (res.data.shortMcq || res.data.shortNumerical) {
        toast(`Added ${res.data.added}. These chapters ran out: still ${res.data.shortMcq} MCQ and ${res.data.shortNumerical} numerical needed. Tick more chapters and try again.`, "error");
      } else toast(`Added ${res.data.added} questions. Check them in "Your paper" — swap or remove any you don't like, or press Undo.`);
      if (res.data.added) remember(before);
      load();
      setView("paper");
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
            <Link to={info.isAdmin ? `/admin/live-tests/${id}` : "/lecturer"} className="text-xs font-semibold text-amber-200 hover:underline">
              {info.isAdmin ? "← Back to the live test" : "← Your sections"}
            </Link>
            <p className="truncate text-xs font-semibold uppercase tracking-[0.12em] text-amber-100/60">
              {info.exam?.code} · {info.test.title}
            </p>
            <h1 className="text-xl font-extrabold text-white">
              {sec.name}: {info.isAdmin && sec.picker === "lecturer" ? `review ${sec.lecturerName ? `${sec.lecturerName}'s` : "the lecturer's"} questions` : "pick the questions"}
            </h1>
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
            {needsSend && sentAt ? (
              <span className="flex flex-wrap items-center gap-2">
                <span className="rounded-xl bg-green-500/15 px-3 py-2 text-sm font-semibold text-green-300 ring-1 ring-green-400/30">
                  Sent to head lecturer ✓ {testStatus === "published" ? `· opens ${fmtUntil(info.test.startsAt)}` : "· waiting for the other subjects"}
                </span>
                {info.canChange && (
                  <button type="button" disabled={saving} onClick={takeBack} className="rounded-xl px-3 py-2 text-sm font-semibold text-amber-100 ring-1 ring-amber-200/30 hover:bg-white/10 disabled:opacity-50">
                    {info.isAdmin ? "Send back to lecturer" : "Take back to edit"}
                  </button>
                )}
              </span>
            ) : needsSend && complete && editable ? (
              <button type="button" disabled={saving} onClick={sendToHead} className="gp-gold-btn px-5 py-2.5 text-sm disabled:opacity-50">
                {info.isAdmin ? "Mark as ready" : "Send to head lecturer →"}
              </button>
            ) : complete ? (
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
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 pb-3">
          <div className="flex gap-1 rounded-xl bg-white/5 p-1 ring-1 ring-amber-200/15" role="tablist">
            {[
              ["add", "Add questions"],
              ["paper", `Your paper · ${pickedCount}/${total}`],
            ].map(([v, l]) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                onClick={() => {
                  setView(v);
                  if (v === "paper") setSwapFor(null);
                }}
                className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${view === v ? "bg-amber-200 text-slate-900" : "text-amber-100/80 hover:text-white"}`}
              >
                {l}
              </button>
            ))}
          </div>
          {editable && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={undo}
                disabled={!history.length || saving}
                className="rounded-lg px-3 py-1.5 text-sm font-semibold text-amber-100 ring-1 ring-amber-200/30 hover:bg-white/10 disabled:opacity-40"
                title="Bring back the paper as it was before your last change"
              >
                ↶ Undo
              </button>
              {picked.length > 0 && (
                <button type="button" onClick={clearAll} disabled={saving} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-red-300 ring-1 ring-red-300/30 hover:bg-red-500/10 disabled:opacity-40">
                  Remove all
                </button>
              )}
            </div>
          )}
        </div>
        {!editable && !info.canChange && (
          <p className="bg-amber-50 px-4 py-2 text-center text-sm text-amber-800">
            The test has opened, so its questions can't change now.
          </p>
        )}
        {!editable && info.canChange && needsSend && sentAt && (
          <p className="bg-green-50 px-4 py-2 text-center text-sm text-green-800">
            You sent this paper to the head lecturer. To change anything, press <b>Take back to edit</b>.
          </p>
        )}
        {editable && needsSend && !sentAt && sec.returnedAt && (
          <p className="bg-orange-50 px-4 py-2 text-center text-sm text-orange-900">
            The head lecturer sent this back for changes{sec.returnNote ? <>: <b>“{sec.returnNote}”</b></> : "."} Fix it, then press <b>Send to head lecturer</b> again.
          </p>
        )}
      </div>

      {view === "paper" && (
        <PaperView
          sec={sec}
          picked={picked}
          editable={editable}
          saving={saving}
          busyId={busyId}
          showSolutions={showSolutions}
          setShowSolutions={setShowSolutions}
          onMove={move}
          onRemove={remove}
          onSwap={(q) => swap(q)}
          onChoose={startManualSwap}
          onAdd={() => setView("add")}
          editLink={info.isAdmin ? (q) => `/admin/questions/${q._id}?back=${encodeURIComponent(`/lecturer/tests/${id}/${key}?view=paper`)}` : null}
          sendCard={
            needsSend ? (
              <SendCard
                sec={sec}
                complete={complete}
                sentAt={sentAt}
                editable={editable}
                canChange={info.canChange}
                isAdmin={info.isAdmin}
                saving={saving}
                left={total - pickedCount}
                onSend={sendToHead}
                onTakeBack={takeBack}
              />
            ) : null
          }
        />
      )}


      {view === "add" && (
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
          {swapFor && (
            <div className="gp-hero flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="relative min-w-0">
                <p className="text-xs font-bold uppercase tracking-widest text-amber-200/80">Swapping question {picked.findIndex((q) => String(q._id) === String(swapFor._id)) + 1}</p>
                <p className="mt-1 truncate text-sm text-white">{preview(swapFor.text, 110)}</p>
                <p className="text-xs text-amber-100/70">Showing other {swapFor.type === "numerical" ? "numerical questions" : "MCQs"} from {swapFor.chapter}. Change the chapter on the left to look elsewhere, then press <b>Swap in</b>.</p>
              </div>
              <div className="relative flex gap-2">
                <button type="button" disabled={busyId === String(swapFor._id)} onClick={() => swap(swapFor).then((okd) => okd && (setSwapFor(null), setView("paper")))} className="gp-gold-btn px-4 py-2 text-sm disabled:opacity-50">
                  Let GenPrep choose
                </button>
                <button type="button" onClick={() => { setSwapFor(null); setView("paper"); }} className="rounded-xl px-4 py-2 text-sm font-semibold text-amber-100 ring-1 ring-amber-200/30 hover:bg-white/10">
                  Cancel
                </button>
              </div>
            </div>
          )}
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
                              {swapFor && !isPicked ? (
                                (q.type === "numerical") === (swapFor.type === "numerical") ? (
                                  <button type="button" onClick={() => finishManualSwap(q)} disabled={Boolean(busyId)} className="gp-gold-btn px-4 py-2 text-sm disabled:opacity-50">
                                    ⇄ Swap in for Q{picked.findIndex((x) => String(x._id) === String(swapFor._id)) + 1}
                                  </button>
                                ) : (
                                  <span className="text-xs text-slate-500">{swapFor.type === "numerical" ? "Pick a numerical question" : "Pick an MCQ"} to swap</span>
                                )
                              ) : isPicked ? (
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

      </div>
      )}
    </LecturerLayout>
  );
}

// Every picked question in full, with answer and solution, and Move / Swap / Remove under each one
function PaperView({ sec, picked, editable, saving, busyId, showSolutions, setShowSolutions, onMove, onRemove, onSwap, onChoose, onAdd, sendCard, editLink }) {
  const mcqs = picked.filter((q) => q.type !== "numerical");
  const nums = picked.filter((q) => q.type === "numerical");
  const groups = [
    ["MCQs", mcqs, sec.mcqCount, 0],
    ["Numerical questions", nums, sec.numericalCount, mcqs.length],
  ].filter(([, , need]) => need > 0);

  if (!picked.length) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="gp-card grid place-items-center px-6 py-14 text-center">
          <h2 className="text-xl font-bold text-slate-900">Your {sec.name} paper is empty</h2>
          <p className="mt-1 max-w-md text-sm text-slate-500">Add questions yourself or press Auto-fill. Everything you add shows up here, where you can swap or remove it.</p>
          <button type="button" onClick={onAdd} className="gp-gold-btn mt-5 px-5 py-2.5 text-sm">
            Add questions
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-6">
      <PaperSummary picked={picked} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          Read every question. Don't like one? <b>Swap</b> puts a similar question in the same place, <b>Choose</b> lets you pick the replacement, <b>Remove</b> takes it out.
        </p>
        <button type="button" onClick={() => setShowSolutions((v) => !v)} className="text-sm font-semibold text-amber-800 hover:underline">
          {showSolutions ? "Hide solutions" : "Show solutions"}
        </button>
      </div>
      {groups.map(([title, list, need, offset]) => (
        <section key={title} className="space-y-4">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-lg font-bold text-slate-900">{title}</h2>
            <span className={`text-sm font-semibold ${list.length === need ? "text-green-700" : "text-slate-500"}`}>
              {list.length} of {need}
              {list.length === need ? " ✓" : ""}
            </span>
          </div>
          {list.length === 0 && <p className="gp-card p-5 text-sm text-slate-500">None yet.</p>}
          {list.map((q, j) => {
            const i = offset + j;
            const busy = busyId === String(q._id);
            return (
              <article key={q._id} id={`paper-${q._id}`} className={`gp-card overflow-hidden transition ${busy ? "opacity-60" : ""}`}>
                <div className="flex flex-wrap items-center gap-2 border-b border-amber-100 bg-amber-50/50 px-5 py-2.5 text-xs">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-slate-900 text-xs font-extrabold text-amber-200">{i + 1}</span>
                  <span className="font-semibold text-slate-700">{q.chapter}</span>
                  {q.topic && <span className="text-slate-500">· {q.topic}</span>}
                  <span className="ml-auto flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-white px-2 py-0.5 font-medium capitalize text-slate-700 ring-1 ring-slate-200">{q.difficulty}</span>
                    {q.classLevel && <span className="rounded-full bg-white px-2 py-0.5 text-slate-700 ring-1 ring-slate-200">Class {q.classLevel}</span>}
                    {q.diagram && <span className="rounded-full bg-violet-50 px-2 py-0.5 font-medium text-violet-800">Diagram</span>}
                  </span>
                </div>
                <div className="p-5">
                  <QuestionBody key={`${q._id}-${showSolutions}`} q={q} solutionOpen={showSolutions} compact />
                </div>
                {editable && (
                  <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-5 py-3">
                    <button type="button" aria-label="Move up" disabled={saving || j === 0} onClick={() => onMove(i, -1)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-600 hover:border-amber-300 disabled:opacity-30">
                      ↑
                    </button>
                    <button type="button" aria-label="Move down" disabled={saving || j === list.length - 1} onClick={() => onMove(i, 1)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-600 hover:border-amber-300 disabled:opacity-30">
                      ↓
                    </button>
                    <span className="flex-1" />
                    <button type="button" disabled={busy || saving} onClick={() => onSwap(q)} className="rounded-lg bg-slate-900 px-3.5 py-1.5 text-sm font-semibold text-amber-200 hover:bg-black disabled:opacity-50" title="Replace with a similar question from the same concept or chapter">
                      {busy ? "Swapping..." : "⇄ Swap"}
                    </button>
                    <button type="button" disabled={busy || saving} onClick={() => onChoose(q)} className="rounded-lg border border-slate-300 px-3.5 py-1.5 text-sm font-semibold text-slate-700 hover:border-amber-400 disabled:opacity-50" title="Choose the replacement yourself">
                      Choose replacement
                    </button>
                    {editLink && (
                      <Link to={editLink(q)} className="rounded-lg border border-slate-300 px-3.5 py-1.5 text-sm font-semibold text-slate-700 hover:border-amber-400" title="Fix a typo, the answer or the solution of this question">
                        ✎ Edit
                      </Link>
                    )}
                    <button type="button" disabled={busy || saving} onClick={() => onRemove(q._id)} className="rounded-lg border border-red-200 px-3.5 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">
                      Remove
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </section>
      ))}
      {sendCard}
    </div>
  );
}

// Last step for a lecturer: send the finished paper to the head lecturer
function SendCard({ sec, complete, sentAt, editable, canChange, isAdmin, saving, left, onSend, onTakeBack }) {
  return (
    <section className="gp-hero p-6">
      <div className="relative flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 max-w-xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-200/80">Last step</p>
          {sentAt ? (
            <>
              <h2 className="mt-1 text-xl font-extrabold text-white">Sent to the head lecturer ✓</h2>
              <p className="gp-muted mt-1 text-sm">
                Sent {new Date(sentAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}.{" "}
                {canChange ? "Need a change? Take it back, fix it and send again before the test opens." : "The test has opened, so it is final."}
              </p>
            </>
          ) : complete ? (
            <>
              <h2 className="mt-1 text-xl font-extrabold text-white">Happy with all {sec.mcqCount + sec.numericalCount} questions?</h2>
              <p className="gp-muted mt-1 text-sm">Send your {sec.name} paper to the head lecturer. The test goes live once every subject is sent.</p>
            </>
          ) : (
            <>
              <h2 className="mt-1 text-xl font-extrabold text-white">
                {left} more question{left === 1 ? "" : "s"} to go
              </h2>
              <p className="gp-muted mt-1 text-sm">Once all {sec.mcqCount + sec.numericalCount} are picked, you can send the paper to the head lecturer.</p>
            </>
          )}
        </div>
        {sentAt ? (
          canChange && (
            <button type="button" disabled={saving} onClick={onTakeBack} className="rounded-xl px-5 py-3 text-sm font-semibold text-amber-100 ring-1 ring-amber-200/30 hover:bg-white/10 disabled:opacity-50">
              {isAdmin ? "Send back to lecturer" : "Take back to edit"}
            </button>
          )
        ) : (
          editable && (
            <button type="button" disabled={saving || !complete} onClick={onSend} className="gp-gold-btn px-6 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-40">
              {isAdmin ? "Mark as ready" : "Send to head lecturer →"}
            </button>
          )
        )}
      </div>
    </section>
  );
}

// Where the paper's questions come from: chapters with their concepts, levels, diagrams
function PaperSummary({ picked }) {
  const [open, setOpen] = useState(true);
  const chapters = [];
  for (const q of picked) {
    let c = chapters.find((x) => x.name === q.chapter);
    if (!c) chapters.push((c = { name: q.chapter || "No chapter", classLevel: q.classLevel, count: 0, topics: new Map() }));
    c.count += 1;
    const t = q.topic || "General";
    c.topics.set(t, (c.topics.get(t) || 0) + 1);
  }
  chapters.sort((a, b) => b.count - a.count);
  const lv = (d) => picked.filter((q) => q.difficulty === d).length;
  return (
    <section className="gp-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Where the questions come from</h2>
          <p className="text-sm text-slate-500">
            {chapters.length} chapter{chapters.length === 1 ? "" : "s"} · {lv("easy")} easy · {lv("medium")} medium · {lv("hard")} hard · {picked.filter((q) => q.diagram).length} with diagrams
          </p>
        </div>
        <button type="button" onClick={() => setOpen((v) => !v)} className="text-sm font-semibold text-amber-800 hover:underline">
          {open ? "Hide" : "Show"}
        </button>
      </div>
      {open && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {chapters.map((c) => (
            <div key={c.name} className="rounded-xl border border-slate-100 bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-slate-900">
                  {c.name}
                  {c.classLevel && <span className="ml-1.5 text-xs font-normal text-slate-500">Class {c.classLevel}</span>}
                </p>
                <span className="shrink-0 rounded-full bg-slate-900 px-2 py-0.5 text-xs font-bold text-amber-200">{c.count}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[...c.topics].map(([t, n]) => (
                  <span key={t} className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-900 ring-1 ring-amber-200/70">
                    {t} · {n}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
