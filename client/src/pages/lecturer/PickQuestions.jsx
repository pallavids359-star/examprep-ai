import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import api, { getErrorMessage } from "../../api/axios";
import LecturerLayout from "../../components/LecturerLayout";
import QuestionBody from "../../components/QuestionBody";
import { toast } from "../../components/Toaster";
import { askConfirm } from "../../components/ConfirmDialog";
import { fmtUntil, preview } from "../../components/liveHelpers";

// The lecturer picks questions for one section of a live test:
// class -> chapters -> concepts -> questions grouped by concept, with answers and solutions.

const FLABEL = "mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500";

// Small building blocks for the filter panel
const Seg = ({ value, onChange, options }) => (
  <div className="grid gap-1 rounded-xl bg-amber-50/70 p-1 ring-1 ring-amber-200/70" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
    {options.map(([v, l]) => (
      <button
        key={v}
        type="button"
        aria-pressed={value === v}
        onClick={() => onChange(v)}
        className={`rounded-lg px-1 py-1.5 text-xs font-semibold transition ${value === v ? "bg-slate-900 text-amber-200 shadow" : "text-slate-700 hover:bg-white"}`}
      >
        {l}
      </button>
    ))}
  </div>
);
const Box = ({ on }) => (
  <span className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-[5px] border text-[10px] font-bold ${on ? "border-amber-600 bg-amber-500 text-white" : "border-slate-300 bg-white"}`}>
    {on ? "✓" : ""}
  </span>
);
const Toggle = ({ on, onClick, label }) => (
  <button type="button" role="switch" aria-checked={on} onClick={onClick} className="flex items-center gap-2.5 text-left text-sm text-slate-700">
    <span className={`relative h-5 w-9 shrink-0 rounded-full transition ${on ? "bg-amber-500" : "bg-slate-300"}`}>
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
    </span>
    {label}
  </button>
);
const Fold = ({ title, badge, open, onToggle, children }) => (
  <div className="border-b border-amber-100 last:border-b-0">
    <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center justify-between px-5 py-3.5 text-left hover:bg-amber-50/40">
      <span className="text-sm font-bold text-slate-900">{title}</span>
      <span className="flex items-center gap-2">
        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold capitalize text-amber-800">{badge}</span>
        <span className={`text-slate-400 transition ${open ? "rotate-180" : ""}`}>⌄</span>
      </span>
    </button>
    {open && <div className="px-5 pb-4">{children}</div>}
  </div>
);

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
  const [view, setView] = useState(search.get("view") === "paper" ? "paper" : "add");
  const [stage, setStage] = useState("class"); // add questions: class -> chapters -> topics -> questions // "add" = browse the bank, "paper" = the questions picked so far
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
    if (!info || chapterIds.length === 0 || stage !== "questions") {
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
  }, [info, id, key, classLevel, chapterIds, topicIds, type, difficulty, diagram, hideUsed, page, stage]);

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
  const chooseClass = (cl) => {
    setPage(1);
    setClassLevel(cl);
    const keep = new Set(chapters.filter((c) => cl === "both" || c.classLevel === cl).map((c) => c._id));
    setChapterIds((p) => p.filter((c) => keep.has(c)));
    setTopicIds([]);
    setStage("chapters");
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
    if (!(await askConfirm(`Send your ${sec.name} paper (${picked.length} questions) to the head lecturer? You can take it back to make changes until a student starts the test.`, { title: "Send to head lecturer?", confirmText: "Send", danger: false }))) return;
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
    setStage("questions");
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
      {/* Header */}
      <div className="mx-auto max-w-7xl px-4 pt-6">
        <nav className="flex flex-wrap items-center gap-2 text-sm text-slate-500" aria-label="Breadcrumb">
          <Link to={info.isAdmin ? `/admin/live-tests/${id}` : "/lecturer"} className="font-semibold text-amber-800 hover:underline">
            {info.isAdmin ? "Live test" : "My subjects"}
          </Link>
          <span>/</span>
          <span className="truncate">{info.test.title}</span>
          <span>/</span>
          <span className="font-semibold text-slate-800">{sec.name}</span>
        </nav>

        <section className="gp-hero mt-3 p-6 md:p-7">
          <div className="relative flex flex-wrap items-center justify-between gap-6">
            <div className="flex min-w-0 items-center gap-4">
              <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-amber-200 to-amber-500 font-display text-3xl font-extrabold text-slate-900 shadow-lg">
                {sec.name[0]}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-bold text-amber-200">{info.exam?.code}</span>
                  {needsSend && (
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        sentAt ? "bg-green-400/15 text-green-300" : sec.returnedAt ? "bg-orange-400/15 text-orange-300" : "bg-white/10 text-amber-100/80"
                      }`}
                    >
                      {sentAt ? "Sent ✓" : sec.returnedAt ? "Sent back for changes" : "Not sent yet"}
                    </span>
                  )}
                  {info.test.phase !== "open" && info.test.phase !== "closed" && <span className="text-xs text-amber-100/60">Opens {fmtUntil(info.test.startsAt)}</span>}
                </div>
                <h1 className="mt-1 text-3xl font-extrabold text-white">{sec.name}</h1>
                <p className="gp-muted text-sm">
                  {sec.picker === "lecturer" ? `Picked by ${sec.lecturerName || "the lecturer"}` : sec.picker === "auto" ? "Filled automatically" : "Picked by the head lecturer"}
                  {saving && <span className="ml-2 text-amber-200/70">· saving…</span>}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {needsSend && sentAt ? (
                info.canChange && (
                  <button type="button" disabled={saving} onClick={takeBack} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-amber-100 ring-1 ring-amber-200/40 hover:bg-white/10 disabled:opacity-50">
                    {info.isAdmin ? "Send back to lecturer" : "Take back to edit"}
                  </button>
                )
              ) : needsSend && complete && editable ? (
                <button type="button" disabled={saving} onClick={sendToHead} className="gp-gold-btn px-5 py-3 text-sm disabled:opacity-50">
                  {info.isAdmin ? "Mark as ready" : "Send to head lecturer →"}
                </button>
              ) : !complete && editable ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={autoFill}
                  className="gp-gold-btn px-5 py-3 text-sm disabled:opacity-50"
                  title={chapterIds.length ? "Picks from the ticked chapters" : "Picks from the whole syllabus"}
                >
                  Auto-fill the rest{chapterIds.length ? " from ticked chapters" : ""}
                </button>
              ) : null}
            </div>
          </div>

          {/* Progress */}
          <div className="relative mt-6 grid gap-3 sm:grid-cols-3">
            {[
              ["Questions", pickedCount, total],
              ["MCQ", mcqPicked, sec.mcqCount],
              ...(sec.numericalCount ? [["Numerical", numPicked, sec.numericalCount]] : []),
            ].map(([l, n, of]) => (
              <div key={l} className="rounded-2xl bg-white/5 p-4 ring-1 ring-amber-200/15">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-bold uppercase tracking-widest text-amber-200/70">{l}</span>
                  <span className={`text-xs font-semibold ${n === of ? "text-green-300" : "text-amber-100/60"}`}>{n === of ? "Complete" : `${of - n} to go`}</span>
                </div>
                <p className="mt-1 font-display text-2xl font-extrabold tabular-nums text-white">
                  {n}
                  <span className="text-base text-amber-100/50"> / {of}</span>
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className={`h-full rounded-full transition-all ${n === of ? "bg-green-400" : "bg-gradient-to-r from-amber-200 to-amber-500"}`} style={{ width: `${of ? Math.min(100, (n / of) * 100) : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        {!editable && !info.canChange && (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Students have already started this test, so its questions can't change now.</p>
        )}
        {!editable && info.canChange && needsSend && sentAt && (
          <p className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
            This paper is with the head lecturer. To change anything, press <b>Take back to edit</b>.
          </p>
        )}
        {editable && needsSend && !sentAt && sec.returnedAt && (
          <p className="mt-4 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900">
            The head lecturer sent this back for changes{sec.returnNote ? <>: <b>“{sec.returnNote}”</b></> : "."} Fix it, then press <b>Send to head lecturer</b> again.
          </p>
        )}
      </div>

      {/* Toolbar */}
      <div className="sticky top-0 z-20 mt-4 border-y border-amber-200/60 bg-[#fbf7ee]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2.5">
          <div className="flex gap-1 rounded-xl bg-white p-1 shadow-sm ring-1 ring-amber-200/70" role="tablist">
            {[
              ["add", "Add questions", null],
              ["paper", "Paper", `${pickedCount}/${total}`],
            ].map(([v, l, n]) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                onClick={() => {
                  setView(v);
                  if (v === "paper") setSwapFor(null);
                }}
                className={`flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-semibold transition ${view === v ? "bg-slate-900 text-amber-200" : "text-slate-600 hover:text-slate-900"}`}
              >
                {l}
                {n && <span className={`rounded-full px-1.5 text-xs ${view === v ? "bg-amber-200/20" : "bg-amber-100 text-amber-900"}`}>{n}</span>}
              </button>
            ))}
          </div>
          {editable && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={undo}
                disabled={!history.length || saving}
                className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-white disabled:opacity-35"
                title="Bring back the paper as it was before your last change"
              >
                ↶ Undo
              </button>
              {picked.length > 0 && (
                <button type="button" onClick={clearAll} disabled={saving} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-40">
                  Remove all
                </button>
              )}
            </div>
          )}
        </div>
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
      <div className="mx-auto max-w-7xl space-y-5 px-4 py-6">
        {stage !== "questions" ? (
          <SelectWizard
            stage={stage}
            setStage={setStage}
            classLevel={classLevel}
            chooseClass={chooseClass}
            chapters={chapters}
            chapterIds={chapterIds}
            toggleChapter={toggleChapter}
            setClassChapters={setClassChapters}
            topicsByChapter={topicsByChapter}
            topicIds={topicIds}
            setTopicIds={setTopicIds}
            onShow={() => {
              setPage(1);
              setStage("questions");
            }}
          />
        ) : (
          <QuestionsBar
            classLevel={classLevel}
            chapterCount={chapterIds.length}
            topicCount={topicIds.length}
            setStage={setStage}
            type={type}
            setType={filtered((v) => setType(v))}
            difficulty={difficulty}
            setDifficulty={filtered((v) => setDifficulty(v))}
            diagram={diagram}
            toggleDiagram={filtered(() => setDiagram((v) => !v))}
            hideUsed={hideUsed}
            toggleHideUsed={filtered(() => setHideUsed((v) => !v))}
          />
        )}

        {/* Questions grouped by concept */}
        {stage === "questions" && (
        <main className="min-w-0 space-y-4" ref={listTop}>
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
                <p className="text-sm text-slate-600">{loadingResults ? "Loading..." : "Questions for your choices"}</p>
                <Toggle on={showSolutions} onClick={() => setShowSolutions((v) => !v)} label="Show answers & solutions" />
              </div>
              {groups.map((g) => {
                const inTopic = picked.filter((q) => String(q.topicId) === String(g.topicId)).length;
                return (
                  <section key={`${g.topicId}-${g.questions[0]._id}`} className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-l-4 border-amber-400 pl-3 pt-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{g.chapter}</p>
                        <h2 className="text-lg font-bold text-slate-900">{g.name}</h2>
                      </div>
                      <span className="flex gap-1.5 text-xs font-semibold">
                        {inTopic > 0 && <span className="rounded-full bg-green-50 px-2.5 py-1 text-green-800 ring-1 ring-green-200">{inTopic} in paper</span>}
                      </span>
                    </div>
                    {g.questions.map((q) => {
                      const isPicked = pickedIds.has(String(q._id));
                      return (
                        <article key={q._id} className={`gp-card overflow-hidden transition ${isPicked ? "ring-2 ring-green-500" : ""}`}>
                          <div className="p-5">
                          <div className="mb-3 flex flex-wrap items-center gap-1.5 text-xs">
                            {isPicked && <span className="rounded-full bg-green-600 px-2.5 py-0.5 font-semibold text-white">✓ In paper</span>}
                            <span className={`rounded-full px-2.5 py-0.5 font-medium ${q.type === "numerical" ? "bg-orange-50 text-orange-800" : "bg-blue-50 text-blue-800"}`}>
                              {q.type === "numerical" ? "Numerical" : q.type === "mcq_multi" ? "MCQ (multi)" : "MCQ"}
                            </span>
                            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-medium capitalize text-slate-700">{q.difficulty}</span>
                            {q.classLevel && <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-slate-700">Class {q.classLevel}</span>}
                            {q.diagram && <span className="rounded-full bg-violet-50 px-2.5 py-0.5 font-medium text-violet-800">Diagram</span>}
                            {q.source?.kind === "pyq" && <span className="rounded-full bg-amber-50 px-2.5 py-0.5 font-medium text-amber-800">PYQ {q.source.year || ""}</span>}
                          </div>
                          <QuestionBody key={`${q._id}-${showSolutions}`} q={q} solutionOpen={showSolutions} compact />
                          </div>
                          {editable && (
                            <div className={`flex items-center justify-end gap-3 border-t px-5 py-3 ${isPicked ? "border-green-100 bg-green-50/60" : "border-slate-100 bg-amber-50/30"}`}>
                              {swapFor && !isPicked ? (
                                (q.type === "numerical") === (swapFor.type === "numerical") ? (
                                  <button type="button" onClick={() => finishManualSwap(q)} disabled={Boolean(busyId)} className="gp-gold-btn px-4 py-2 text-sm disabled:opacity-50">
                                    ⇄ Swap in for Q{picked.findIndex((x) => String(x._id) === String(swapFor._id)) + 1}
                                  </button>
                                ) : (
                                  <span className="text-xs text-slate-500">{swapFor.type === "numerical" ? "Pick a numerical question" : "Pick an MCQ"} to swap</span>
                                )
                              ) : isPicked ? (
                                <>
                                  <span className="text-sm font-semibold text-green-800">Added to the paper</span>
                                  <button type="button" onClick={() => remove(q._id)} disabled={saving} className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">
                                    Remove
                                  </button>
                                </>
                              ) : (
                                <button type="button" onClick={() => add(q)} disabled={saving} className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-amber-200 shadow-sm hover:bg-black disabled:opacity-50">
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
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-amber-300 disabled:opacity-40"
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
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-amber-300 disabled:opacity-40"
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
        </main>
        )}

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
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e7dcc3] bg-white px-4 py-3">
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
          <span className="font-semibold text-slate-900">Under each question:</span>
          <span><b className="text-slate-900">⇄ Swap</b> similar question</span>
          <span><b className="text-slate-900">Choose</b> your own</span>
          <span><b className="text-slate-900">Remove</b> it</span>
        </p>
        <Toggle on={showSolutions} onClick={() => setShowSolutions((v) => !v)} label="Answers & solutions" />
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
                {canChange ? "Need a change? Take it back, fix it and send again before any student starts." : "Students have started the test, so it is final."}
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

// Where the paper's questions come from: level mix, then each chapter with its topics
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
  const total = picked.length || 1;
  const levels = [
    ["Easy", picked.filter((q) => q.difficulty === "easy").length, "#7fb069"],
    ["Medium", picked.filter((q) => q.difficulty === "medium").length, "#c9a24a"],
    ["Hard", picked.filter((q) => q.difficulty === "hard").length, "#b5532c"],
  ];
  const diagrams = picked.filter((q) => q.diagram).length;

  return (
    <section className="overflow-hidden rounded-2xl border border-[#e7dcc3] bg-white">
      {/* Top: numbers + level mix */}
      <div className="flex flex-wrap items-center gap-x-10 gap-y-4 border-b border-[#efe6d2] px-6 py-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Paper overview</p>
          <p className="mt-1 text-lg font-bold text-slate-900">
            {picked.length} questions · {chapters.length} chapter{chapters.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="min-w-[260px] flex-1">
          <div className="flex h-2.5 overflow-hidden rounded-full bg-[#f1e9d6]">
            {levels.map(([l, n, c]) => (n ? <div key={l} style={{ width: `${(n / total) * 100}%`, background: c }} /> : null))}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600">
            {levels.map(([l, n, c]) => (
              <span key={l} className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />
                {l} <b className="text-slate-900">{n}</b>
              </span>
            ))}
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm border border-slate-400" />
              Diagrams <b className="text-slate-900">{diagrams}</b>
            </span>
          </div>
        </div>
        <button type="button" onClick={() => setOpen((v) => !v)} className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-[#f7f3ea]">
          {open ? "Hide chapters" : "Show chapters"}
        </button>
      </div>

      {/* Chapters and their topics */}
      {open && (
        <div className="divide-y divide-[#efe6d2]">
          {chapters.map((c) => (
            <div key={c.name} className="grid gap-4 px-6 py-4 md:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
              <div>
                <p className="font-semibold text-slate-900">{c.name}</p>
                <p className="text-xs text-slate-500">
                  {c.classLevel ? `Class ${c.classLevel} · ` : ""}
                  {c.count} question{c.count === 1 ? "" : "s"}
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#f1e9d6]">
                  <div className="h-full rounded-full bg-[#c9a24a]" style={{ width: `${(c.count / total) * 100}%` }} />
                </div>
              </div>
              <ul className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
                {[...c.topics]
                  .sort((a, b) => b[1] - a[1])
                  .map(([t, n]) => (
                    <li key={t} className="flex items-center justify-between gap-3 border-b border-dashed border-[#efe6d2] pb-1.5 text-sm">
                      <span className="truncate text-slate-700">{t}</span>
                      <span className="shrink-0 rounded-md bg-[#f7f3ea] px-1.5 text-xs font-semibold tabular-nums text-slate-700">{n}</span>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// Add questions, step by step: class -> chapters -> topics -> questions
const STEPS = [
  ["class", "Class"],
  ["chapters", "Chapters"],
  ["topics", "Topics"],
  ["questions", "Questions"],
];

function Stepper({ stage, setStage, canGo }) {
  const at = STEPS.findIndex(([k]) => k === stage);
  return (
    <ol className="flex flex-wrap items-center gap-2">
      {STEPS.map(([k, l], i) => {
        const done = i < at;
        const here = i === at;
        const ok = canGo(k);
        return (
          <li key={k} className="flex items-center gap-2">
            <button
              type="button"
              disabled={!ok || here}
              onClick={() => setStage(k)}
              className={`flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-4 text-sm font-semibold transition ${
                here ? "bg-slate-900 text-amber-200 shadow" : done ? "bg-white text-slate-800 ring-1 ring-amber-300 hover:bg-amber-50" : "bg-white/60 text-slate-400 ring-1 ring-slate-200"
              }`}
            >
              <span className={`grid h-6 w-6 place-items-center rounded-full text-xs font-extrabold ${here ? "bg-amber-300 text-slate-900" : done ? "bg-green-600 text-white" : "bg-slate-200 text-slate-500"}`}>
                {done ? "✓" : i + 1}
              </span>
              {l}
            </button>
            {i < STEPS.length - 1 && <span className="h-px w-6 bg-amber-300/70" />}
          </li>
        );
      })}
    </ol>
  );
}

function SelectWizard({ stage, setStage, classLevel, chooseClass, chapters, chapterIds, toggleChapter, setClassChapters, topicsByChapter, topicIds, setTopicIds, onShow }) {
  const classes = ["11", "12"].filter((c) => chapters.some((x) => x.classLevel === c));
  const visible = chapters.filter((c) => classLevel === "both" || c.classLevel === classLevel);
  const canGo = (k) => k === "class" || (k === "chapters" && classLevel) || ((k === "topics" || k === "questions") && chapterIds.length > 0);
  const toggleTopic = (tid) => setTopicIds((p) => (p.includes(tid) ? p.filter((x) => x !== tid) : [...p, tid]));

  return (
    <div className="space-y-5">
      <Stepper stage={stage} setStage={setStage} canGo={canGo} />

      {stage === "class" && (
        <section className="gp-card p-6 md:p-8">
          <h2 className="text-2xl font-extrabold text-slate-900">Which class?</h2>
          <p className="mt-1 text-sm text-slate-500">Choose the class whose chapters you want to pick questions from.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {[...classes.map((c) => [c, `Class ${c}`]), ["both", "Both classes"]].map(([v, l]) => {
              const n = chapters.filter((c) => v === "both" || c.classLevel === v).length;
              return (
                <button key={v} type="button" aria-pressed={classLevel === v} onClick={() => chooseClass(v)} className="gp-tile group p-6 text-left">
                  <span className="font-display text-4xl font-extrabold text-slate-900">{v === "both" ? "11+12" : v}</span>
                  <span className="mt-2 block font-semibold text-slate-800">{l}</span>
                  <span className="text-sm text-slate-500">{n} chapters</span>
                  <span className="mt-4 block text-sm font-semibold text-amber-800 group-hover:underline">Choose →</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {stage === "chapters" && (
        <section className="gp-card p-6 md:p-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-extrabold text-slate-900">Tick the chapters</h2>
              <p className="mt-1 text-sm text-slate-500">{classLevel === "both" ? "Class 11 and 12" : `Class ${classLevel}`} · tick one or more</p>
            </div>
          </div>
          {(classLevel === "both" ? classes : [classLevel]).map((cl) => {
            const list = visible.filter((c) => c.classLevel === cl);
            const on = list.filter((c) => chapterIds.includes(c._id)).length;
            return (
              <div key={cl} className="mt-6">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-bold text-slate-800">
                    Class {cl} <span className="font-normal text-slate-400">· {on} of {list.length} ticked</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => setClassChapters(cl, on !== list.length)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${on === list.length ? "bg-slate-900 text-amber-200" : "bg-amber-50 text-amber-800 ring-1 ring-amber-200 hover:bg-amber-100"}`}
                  >
                    {on === list.length ? "Clear all" : "Select all"}
                  </button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map((c, i) => {
                    const checked = chapterIds.includes(c._id);
                    return (
                      <button key={c._id} type="button" aria-pressed={checked} onClick={() => toggleChapter(c._id)} className="gp-tile flex items-start gap-3 p-3 text-left">
                        <Box on={checked} />
                        <span className="min-w-0">
                          <span className="block text-[11px] font-semibold text-slate-400">Chapter {i + 1}</span>
                          <span className={`block text-sm leading-snug ${checked ? "font-bold text-slate-900" : "text-slate-700"}`}>{c.name}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <WizardFooter
            left={<button type="button" onClick={() => setStage("class")} className="text-sm font-semibold text-slate-600 hover:underline">← Change class</button>}
            note={chapterIds.length ? `${chapterIds.length} chapter${chapterIds.length === 1 ? "" : "s"} ticked` : "Tick at least one chapter"}
          >
            <button type="button" disabled={!chapterIds.length} onClick={onShow} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-white disabled:opacity-40">
              Skip, show all questions
            </button>
            <button type="button" disabled={!chapterIds.length} onClick={() => setStage("topics")} className="gp-gold-btn px-5 py-2.5 text-sm disabled:opacity-40">
              Next: choose topics →
            </button>
          </WizardFooter>
        </section>
      )}

      {stage === "topics" && (
        <section className="gp-card p-6 md:p-8">
          <h2 className="text-2xl font-extrabold text-slate-900">Choose the topics</h2>
          <p className="mt-1 text-sm text-slate-500">Pick a chapter on the left, then tick its topics. A chapter with nothing ticked uses all its topics.</p>
          <TopicPicker chapters={chapters} chapterIds={chapterIds} topicsByChapter={topicsByChapter} topicIds={topicIds} setTopicIds={setTopicIds} toggleTopic={toggleTopic} />
          <WizardFooter
            left={<button type="button" onClick={() => setStage("chapters")} className="text-sm font-semibold text-slate-600 hover:underline">← Change chapters</button>}
            note={topicIds.length ? `${topicIds.length} topic${topicIds.length === 1 ? "" : "s"} chosen` : "All topics of the ticked chapters"}
          >
            <button type="button" onClick={onShow} className="gp-gold-btn px-6 py-2.5 text-sm">
              Show questions →
            </button>
          </WizardFooter>
        </section>
      )}
    </div>
  );
}

function WizardFooter({ left, note, children }) {
  return (
    <div className="sticky bottom-0 -mx-6 -mb-6 mt-8 flex flex-wrap items-center justify-between gap-3 rounded-b-[inherit] border-t border-amber-100 bg-[#fffdf7]/95 px-6 py-4 backdrop-blur md:-mx-8 md:-mb-8 md:px-8">
      <div className="flex items-center gap-4">
        {left}
        <span className="text-sm text-slate-500">{note}</span>
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

// Shown above the questions: what was chosen, with quick filters
function QuestionsBar({ classLevel, chapterCount, topicCount, setStage, type, setType, difficulty, setDifficulty, diagram, toggleDiagram, hideUsed, toggleHideUsed }) {
  return (
    <div className="gp-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {[
            ["class", classLevel === "both" ? "Class 11 + 12" : `Class ${classLevel}`],
            ["chapters", `${chapterCount} chapter${chapterCount === 1 ? "" : "s"}`],
            ["topics", topicCount ? `${topicCount} topic${topicCount === 1 ? "" : "s"}` : "All topics"],
          ].map(([k, l]) => (
            <button key={k} type="button" onClick={() => setStage(k)} className="group flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 font-semibold text-slate-800 ring-1 ring-amber-200 hover:bg-amber-100" title="Change">
              {l}
              <span className="text-xs text-amber-700 group-hover:underline">✎</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-56">
            <Seg value={type} onChange={setType} options={TYPES.map(([v, l]) => [v, v === "all" ? "All" : l])} />
          </div>
          <div className="w-64">
            <Seg value={difficulty} onChange={setDifficulty} options={DIFFS.map(([v, l]) => [v, v === "any" ? "Any" : l])} />
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-5 border-t border-amber-100 pt-3">
        <Toggle on={diagram} onClick={toggleDiagram} label="Only with a diagram" />
        <Toggle on={hideUsed} onClick={toggleHideUsed} label="Hide questions used in other live tests" />
      </div>
    </div>
  );
}

// Topics: chapters as tabs on the left, a tidy checklist of the chosen chapter's topics on the right
function TopicPicker({ chapters, chapterIds, topicsByChapter, topicIds, setTopicIds, toggleTopic }) {
  const [active, setActive] = useState(chapterIds[0]);
  const [q, setQ] = useState("");
  const cur = chapterIds.includes(active) ? active : chapterIds[0];
  const ch = chapters.find((c) => c._id === cur);
  const ts = topicsByChapter[cur];
  const list = (Array.isArray(ts) ? ts : []).slice().sort((x, y) => x.name.localeCompare(y.name));
  const shown = q ? list.filter((t) => t.name.toLowerCase().includes(q.toLowerCase())) : list;
  const countFor = (cid) => {
    const l = Array.isArray(topicsByChapter[cid]) ? topicsByChapter[cid] : [];
    return [l.filter((t) => topicIds.includes(t._id)).length, l.length];
  };
  const [on, all] = countFor(cur);

  return (
    <div className="mt-6 grid overflow-hidden rounded-2xl border border-slate-200 bg-white md:grid-cols-[260px_minmax(0,1fr)]">
      {/* Chapters */}
      <nav className="border-b border-slate-200 bg-amber-50/40 p-2 md:border-b-0 md:border-r" aria-label="Chapters">
        {chapterIds.map((cid) => {
          const c = chapters.find((x) => x._id === cid);
          const [n, total] = countFor(cid);
          const here = cid === cur;
          return (
            <button
              key={cid}
              type="button"
              onClick={() => {
                setActive(cid);
                setQ("");
              }}
              className={`mb-1 flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition ${here ? "bg-slate-900 text-white shadow" : "text-slate-700 hover:bg-white"}`}
            >
              <span className="min-w-0">
                <span className={`block truncate font-semibold ${here ? "text-white" : "text-slate-900"}`}>{c?.name}</span>
                <span className={`text-xs ${here ? "text-amber-200/80" : "text-slate-500"}`}>Class {c?.classLevel}</span>
              </span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${n ? (here ? "bg-amber-300 text-slate-900" : "bg-slate-900 text-amber-200") : here ? "bg-white/10 text-amber-100" : "bg-white text-slate-500 ring-1 ring-slate-200"}`}>
                {n ? `${n}/${total}` : "All"}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Topics of the chosen chapter */}
      <div className="min-w-0 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-lg font-bold text-slate-900">{ch?.name}</p>
            <p className="text-xs text-slate-500">{on ? `${on} of ${all} topics ticked` : `All ${all} topics will be used`}</p>
          </div>
          <div className="flex items-center gap-2">
            {all > 0 && (
              <button
                type="button"
                onClick={() => setTopicIds((p) => (on === all ? p.filter((x) => !list.some((t) => t._id === x)) : [...new Set([...p, ...list.map((t) => t._id)])]))}
                className="rounded-lg px-3 py-1.5 text-sm font-semibold text-amber-800 ring-1 ring-amber-200 hover:bg-amber-50"
              >
                {on === all ? "Clear all" : "Select all"}
              </button>
            )}
            {on > 0 && on < all && (
              <button type="button" onClick={() => setTopicIds((p) => p.filter((x) => !list.some((t) => t._id === x)))} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-100">
                Clear
              </button>
            )}
          </div>
        </div>
        {all > 8 && (
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Search ${all} topics...`}
            className="mt-4 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm focus:border-amber-400 focus:bg-white focus:outline-none"
          />
        )}
        {ts === "loading" || !ts ? (
          <p className="mt-6 text-sm text-slate-400">Loading topics...</p>
        ) : shown.length === 0 ? (
          <p className="mt-6 text-sm text-slate-400">{q ? "No topic matches that search." : "No topics in this chapter."}</p>
        ) : (
          <ul className="mt-4 grid gap-x-4 sm:grid-cols-2">
            {shown.map((t) => {
              const checked = topicIds.includes(t._id);
              return (
                <li key={t._id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    onClick={() => toggleTopic(t._id)}
                    className={`flex w-full items-center gap-3 border-b border-slate-100 px-2 py-2.5 text-left text-sm transition ${checked ? "font-semibold text-slate-900" : "text-slate-700 hover:bg-amber-50/50"}`}
                  >
                    <Box on={checked} />
                    <span className="min-w-0 leading-snug">{t.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
