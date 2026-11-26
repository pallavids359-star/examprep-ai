import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { getErrorMessage } from "../../api/axios";
import LecturerLayout from "../../components/LecturerLayout";
import BackLink from "../../components/BackLink";
import { ChapterStep, Choice, ClassChoices, ConceptStep, WizCard as Card } from "../../components/SyllabusSteps";
import { toast } from "../../components/Toaster";
import { useAuth } from "../../context/AuthContext";
import { toLocalInput } from "../../components/liveHelpers";
import { CLASS_LABELS, FORMAT_LABELS, JEE_ONLY } from "../../components/assignmentHelpers";
import QuestionTypeCounts, { cleanCounts, typedTotal } from "../../components/QuestionTypeCounts";
import { ModeBar, ModeModal, PaperPreview, StepsPanel } from "../../components/Wizard";

const input = "w-full rounded-xl border border-[#e7dcc3] bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#c9a24a] focus:ring-4 focus:ring-[#e5c372]/30";
const LEVELS = [
  ["easy", "Easy", "bg-emerald-500"],
  ["medium", "Medium", "bg-amber-500"],
  ["hard", "Hard", "bg-rose-500"],
];

// Default due date: one week from now at 9 pm
const nextWeek = () => {
  const d = new Date(Date.now() + 7 * 86400e3);
  d.setHours(21, 0, 0, 0);
  return toLocalInput(d);
};

// Lecturer: make a new assignment
// The five steps (name shown on the left and on the Proceed button)
const STEPS = [
  ["Subject", "Exam, subject and class"],
  ["Chapters", "Which chapters"],
  ["Concepts", "Optional"],
  ["Select questions", "Auto or by hand"],
  ["Preview & save", "Students and due date"],
];

// Unfinished choices are kept in this browser, so going back by mistake loses nothing
const draftKey = (user) => `gp-assignment-draft:${user?._id || user?.email || "me"}`;
const readDraft = (user) => {
  try {
    const d = JSON.parse(localStorage.getItem(draftKey(user)) || "null");
    return d && Date.now() - (d.savedAt || 0) < 14 * 864e5 ? d : null; // keep for 2 weeks
  } catch {
    return null;
  }
};

export default function AssignmentForm() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [draft] = useState(() => readDraft(user)); // what was filled in last time (or null)
  const d = (k, fallback) => (draft && draft[k] !== undefined ? draft[k] : fallback);
  const restore = useRef(draft); // chapters and concepts are put back once their list has loaded
  const [opts, setOpts] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [examId, setExamId] = useState(() => d("examId", ""));
  const [subjectId, setSubjectId] = useState(() => d("subjectId", ""));
  const [title, setTitle] = useState(() => d("title", ""));
  const [pickMode, setPickMode] = useState(() => d("pickMode", "auto"));
  const [classLevel, setClassLevel] = useState(() => d("classLevel", "both"));
  const [chapters, setChapters] = useState(null);
  const [chapterIds, setChapterIds] = useState([]);
  const [topicIds, setTopicIds] = useState([]);
  const [countMode, setCountMode] = useState(() => d("countMode", "total"));
  const [totalCount, setTotalCount] = useState(() => d("totalCount", 20));
  const [perChapter, setPerChapter] = useState(() => d("perChapter", {}));
  const [diffMode, setDiffMode] = useState(() => d("diffMode", "equal"));
  const [pct, setPct] = useState(() => d("pct", { easy: 40, medium: 40, hard: 20 }));
  const [formats, setFormats] = useState(() => d("formats", []));
  const [formatCounts, setFormatCounts] = useState(() => d("formatCounts", {}));
  const [college, setCollege] = useState(() => d("college", "MBPU"));
  const [sections, setSections] = useState(() => d("sections", []));
  const [dueAt, setDueAt] = useState(() => d("dueAt", nextWeek()));
  const [instructions, setInstructions] = useState(() => d("instructions", ""));
  const [step, setStep] = useState(() => d("step", 1));
  const [modeAsked, setModeAsked] = useState(() => d("modeAsked", false));
  const [modeOpen, setModeOpen] = useState(false);

  // Exams, my subjects and colleges
  useEffect(() => {
    api
      .get("/lecturer/assignments/options", { params: examId ? { examId } : {} })
      .then((res) => {
        setOpts(res.data);
        if (!examId) setExamId(String(res.data.examId || ""));
        const subs = res.data.subjects || [];
        setFormats((cur) => cur.filter((f) => (res.data.formats || []).includes(f)));
        setSubjectId((cur) => (subs.some((s) => String(s._id) === cur) ? cur : String(subs[0]?._id || "")));
      })
      .catch((err) => setError(getErrorMessage(err)));
  }, [examId]);

  // Chapters (with their concepts) for the subject
  useEffect(() => {
    if (!subjectId) return;
    setChapters(null);
    setChapterIds([]);
    setTopicIds([]);
    api
      .get("/lecturer/assignments/chapters", { params: { subjectId } })
      .then((res) => {
        setChapters(res.data.chapters);
        const r = restore.current;
        if (r && r.subjectId === subjectId) {
          setChapterIds(r.chapterIds || []);
          setTopicIds(r.topicIds || []);
          setPerChapter(r.perChapter || {});
        }
        restore.current = null;
      })
      .catch((err) => setError(getErrorMessage(err)));
  }, [subjectId]);

  // Save every change (after the chapters are back in place)
  const [restored, setRestored] = useState(Boolean(draft && (draft.step > 1 || draft.chapterIds?.length || draft.title))); // only if something was really filled in
  useEffect(() => {
    if (restore.current || !chapters) return;
    const data = { examId, subjectId, title, pickMode, classLevel, chapterIds, topicIds, countMode, totalCount, perChapter, diffMode, pct, formats, formatCounts, college, sections, dueAt, instructions, step, modeAsked };
    try {
      localStorage.setItem(draftKey(user), JSON.stringify({ ...data, savedAt: Date.now() }));
    } catch {
      /* storage full or blocked: nothing to do */
    }
  }, [examId, subjectId, title, pickMode, classLevel, chapterIds, topicIds, countMode, totalCount, perChapter, diffMode, pct, formats, formatCounts, college, sections, dueAt, instructions, step, modeAsked, chapters, user]);
  const startOver = () => {
    try {
      localStorage.removeItem(draftKey(user));
    } catch {
      /* ignore */
    }
    window.location.reload();
  };

  const inClass = useMemo(() => (chapters || []).filter((c) => classLevel === "both" || String(c.classLevel) === classLevel), [chapters, classLevel]);
  const picked = (chapters || []).filter((c) => chapterIds.includes(String(c._id)));

  // Changing the class drops chapters that are not in it
  useEffect(() => {
    const ok = new Set(inClass.map((c) => String(c._id)));
    setChapterIds((ids) => ids.filter((id) => ok.has(id)));
  }, [inClass]);

  // Concepts of chapters that are no longer ticked go too
  useEffect(() => {
    const ok = new Set(picked.flatMap((c) => c.topics.map((t) => String(t._id))));
    setTopicIds((ids) => ids.filter((id) => ok.has(id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterIds.join(",")]);

  const toggle = (list, setList, id) => setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const total = countMode === "total" ? Number(totalCount) || 0 : picked.reduce((n, c) => n + (Number(perChapter[c._id]) || 0), 0);
  const pctSum = pct.easy + pct.medium + pct.hard;

  const manual = pickMode === "manual";
  const problem = !subjectId
    ? "Choose the subject"
    : !chapterIds.length
      ? "Tick at least one chapter"
      : manual
        ? !dueAt
          ? "Choose the due date"
          : new Date(dueAt) <= new Date()
            ? "The due date must be in the future"
            : ""
      : total < 1
        ? "Enter how many questions"
        : total > 200
          ? "At most 200 questions"
          : typedTotal(formats, formatCounts) > total
            ? `The question types add up to ${typedTotal(formats, formatCounts)}, more than ${total}`
          : diffMode === "custom" && pctSum !== 100
            ? `Difficulty adds up to ${pctSum}%, it must be 100%`
            : !dueAt
              ? "Choose the due date"
              : new Date(dueAt) <= new Date()
                ? "The due date must be in the future"
                : "";

  const subjectName = opts?.subjects?.find((s) => String(s._id) === subjectId)?.name || "";
  // What each step needs before the next one
  const stepProblem = (n) =>
    n === 1
      ? !subjectId ? "Choose the subject" : ""
      : n === 2
        ? !chapterIds.length ? "Tick at least one chapter" : ""
        : n === 4 && !manual
          ? total < 1
            ? "Enter how many questions"
            : total > 200
              ? "At most 200 questions"
              : typedTotal(formats, formatCounts) > total
                ? `The question types add up to ${typedTotal(formats, formatCounts)}, more than ${total}`
                : diffMode === "custom" && pctSum !== 100
                  ? `Difficulty adds up to ${pctSum}%, it must be 100%`
                  : ""
          : "";
  const doneSteps = [1, 2, 3, 4, 5].map((n) => n < step && !stepProblem(n));
  const goTo = (n) => {
    if (n > step) {
      for (let k = step; k < n; k++) {
        const why = stepProblem(k);
        if (why) {
          setStep(k);
          return toast(why, "error");
        }
      }
    }
    setStep(n);
    if (n === 4 && !modeAsked) setModeOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const examCode = opts?.exams?.find((e) => String(e._id) === examId)?.code || "";
  const paperRows = [
    ["Exam", examCode || "—"],
    ["Subject", subjectName || "—"],
    ["Class", CLASS_LABELS[classLevel]],
    ["Chapters", chapterIds.length ? `${chapterIds.length} chapter${chapterIds.length === 1 ? "" : "s"}` : "—"],
    ["Concepts", topicIds.length ? `${topicIds.length} chosen` : "All"],
    ["Questions", manual ? "Hand-picked" : `${total}`],
    ...(manual ? [] : [["Difficulty", diffMode === "custom" ? `${pct.easy}% / ${pct.medium}% / ${pct.hard}%` : diffMode === "equal" ? "Equal" : "Any"]]),
    ["Students", `${college}${sections.length ? ` · Section ${sections.join(", ")}` : " · all sections"}`],
  ];

  const create = async () => {
    if (problem) return toast(problem, "error");
    setSaving(true);
    try {
      const res = await api.post("/lecturer/assignments", {
        title,
        instructions,
        pickMode,
        examId,
        subjectId,
        classLevel,
        chapterIds,
        topicIds,
        countMode,
        totalCount,
        perChapter,
        difficulty: diffMode === "custom" ? { mode: "custom", ...pct } : { mode: diffMode },
        formats,
        formatCounts: cleanCounts(formats, formatCounts),
        college,
        sections,
        dueAt: new Date(dueAt).toISOString(),
      });
      const { got, wanted, shortages } = res.data;
      try {
        localStorage.removeItem(draftKey(user)); // made: the unfinished copy is no longer needed
      } catch {
        /* ignore */
      }
      if (manual) {
        toast("Saved. Now add your questions.");
        navigate(`/lecturer/assignments/${res.data.assignment._id}`, { state: { pick: true } });
        return;
      }
      toast(got < wanted ? `Found ${got} of ${wanted} questions. Check them before publishing.` : `${got} questions ready. Check them, then publish.`, got < wanted ? "error" : "success");
      navigate(`/lecturer/assignments/${res.data.assignment._id}`, { state: { shortages } });
    } catch (err) {
      toast(getErrorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };


  return (
    <LecturerLayout>
      <main className="mx-auto max-w-[1600px] px-4 pb-24 pt-6 md:px-8 md:pt-8">
        <BackLink to="/lecturer/assignments">Assignments</BackLink>
        {restored && (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
            <span className="flex-1">↺ Your unfinished choices are back, just as you left them.</span>
            <button type="button" onClick={startOver} className="font-semibold underline">
              Start fresh
            </button>
            <button type="button" onClick={() => setRestored(false)} aria-label="Hide" className="text-amber-700">
              ✕
            </button>
          </div>
        )}
        <div className="mt-4">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#b8862b]">New assignment</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold text-slate-900 md:text-4xl">{STEPS[step - 1][0]}</h1>
          <p className="mt-1 text-slate-500">Step {step} of 5 · You'll see every question before students do.</p>
        </div>

        {error && <div className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div className="mt-6 grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <StepsPanel steps={STEPS} step={step} done={doneSteps} onGo={goTo} paper={paperRows} />
        <div className="min-w-0 space-y-5">
          {step === 1 && (<>
          {/* 1. Subject */}
          <Card n="1a" title="Exam & subject" hint="Which subject is this assignment for?">
            <div className="grid gap-4 md:grid-cols-2">

              <div>
                <span className="gp-label">Exam</span>
                <div className="mt-1.5 inline-flex w-full rounded-xl bg-[#f3ecdc] p-1">
                  {(opts?.exams || []).map((e) => (
                    <button
                      key={e._id}
                      type="button"
                      onClick={() => setExamId(String(e._id))}
                      className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold transition ${String(e._id) === examId ? "bg-gradient-to-b from-[#e5c372] to-[#b8862b] text-[#17140f] shadow" : "text-slate-600 hover:text-slate-900"}`}
                    >
                      {e.code}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-4">
              <span className="gp-label">Subject</span>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {(opts?.subjects || []).map((s) => (
                  <Choice key={s._id} on={String(s._id) === subjectId} onClick={() => setSubjectId(String(s._id))} className="min-w-[8rem]">
                    {s.name}
                  </Choice>
                ))}
                {opts && !opts.subjects.length && <p className="text-sm text-slate-500">No subjects for this exam.</p>}
              </div>
            </div>
          </Card>

          {/* 2. Class */}
          <Card n="1b" title="Class" hint="Which year's chapters to use">
            <ClassChoices value={classLevel} onChange={setClassLevel} />
          </Card>

          </>)}

          {step === 2 && (<>
          <ChapterStep
            n="2"
            chapters={chapters}
            classLevel={classLevel}
            chapterIds={chapterIds}
            onToggle={(id) => toggle(chapterIds, setChapterIds, id)}
            onSetMany={(ids, on) => setChapterIds(on ? [...new Set([...chapterIds, ...ids])] : chapterIds.filter((x) => !ids.includes(x)))}
          />

          </>)}

          {step === 3 && (<>
          <ConceptStep
            n="3"
            picked={picked}
            topicIds={topicIds}
            setTopicIds={setTopicIds}
            hint={topicIds.length ? `${topicIds.length} concepts chosen` : manual ? "Optional · limits what you browse" : "Optional · leave empty to use every concept"}
          />

          </>)}

          {step === 4 && (<>
          <ModeBar manual={manual} onChange={() => setModeOpen(true)} />
          {manual && (
            <section className="gp-card p-6 text-sm text-slate-600">
              <p className="font-display text-lg font-extrabold text-slate-900">You'll hand-pick every question</p>
              <p className="mt-1">After the last step you go straight to the question bank, filtered to your chapters and concepts. Add questions one by one, like a live test.</p>
            </section>
          )}
          {!manual && (<>
          {/* 5. Count */}
          <Card n="4a" title="How many questions" hint={`${total} in all`}>
            <div className="grid grid-cols-2 gap-3 sm:max-w-md">
              <Choice on={countMode === "total"} onClick={() => setCountMode("total")} sub="Shared out between chapters">
                Total count
              </Choice>
              <Choice on={countMode === "per_chapter"} onClick={() => setCountMode("per_chapter")} sub="You set each chapter">
                Per chapter
              </Choice>
            </div>
            {countMode === "total" ? (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <input type="number" min={1} max={200} className={`${input} w-28 text-center font-display text-lg font-bold`} value={totalCount} onChange={(e) => setTotalCount(e.target.value)} aria-label="Total questions" />
                {[10, 20, 30, 45, 60].map((n) => (
                  <button key={n} type="button" onClick={() => setTotalCount(n)} className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${Number(totalCount) === n ? "bg-[#17140f] text-[#e5c372]" : "bg-[#f3ecdc] text-slate-700 hover:bg-[#ece1c7]"}`}>
                    {n}
                  </button>
                ))}
              </div>
            ) : !picked.length ? (
              <p className="mt-4 rounded-xl bg-[#faf6ec] px-4 py-6 text-center text-sm text-slate-500">Tick chapters first.</p>
            ) : (
              <div className="mt-4 divide-y divide-[#f1e9d7] rounded-2xl border border-[#efe6d2] bg-white">
                {picked.map((c) => (
                  <div key={c._id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">{c.name}</span>
                    <div className="flex items-center rounded-xl border border-[#e7dcc3]">
                      <button type="button" aria-label="Fewer" className="px-3 py-1.5 text-lg text-slate-500 hover:text-slate-900" onClick={() => setPerChapter({ ...perChapter, [c._id]: Math.max(0, (Number(perChapter[c._id]) || 0) - 1) })}>
                        −
                      </button>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        aria-label={`Questions from ${c.name}`}
                        className="w-12 bg-transparent text-center font-display font-bold outline-none"
                        value={perChapter[c._id] ?? 0}
                        onChange={(e) => setPerChapter({ ...perChapter, [c._id]: e.target.value })}
                      />
                      <button type="button" aria-label="More" className="px-3 py-1.5 text-lg text-slate-500 hover:text-slate-900" onClick={() => setPerChapter({ ...perChapter, [c._id]: (Number(perChapter[c._id]) || 0) + 1 })}>
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* 6. Difficulty */}
          <Card n="4b" title="Difficulty">
            <div className="grid grid-cols-3 gap-3">
              <Choice on={diffMode === "any"} onClick={() => setDiffMode("any")} sub="Whatever comes up">
                Any
              </Choice>
              <Choice on={diffMode === "equal"} onClick={() => setDiffMode("equal")} sub="⅓ easy · ⅓ medium · ⅓ hard">
                Equal
              </Choice>
              <Choice on={diffMode === "custom"} onClick={() => setDiffMode("custom")} sub="Set the percentages">
                Custom %
              </Choice>
            </div>
            {diffMode === "custom" && (
              <div className="mt-5 space-y-4">
                <div className="flex h-3 overflow-hidden rounded-full bg-[#f3ecdc]">
                  {LEVELS.map(([k, , bar]) => (
                    <div key={k} className={`${bar} transition-all`} style={{ width: `${Math.min(100, pct[k])}%` }} />
                  ))}
                </div>
                {LEVELS.map(([k, l, bar]) => (
                  <div key={k} className="flex items-center gap-3">
                    <span className={`h-2.5 w-2.5 rounded-full ${bar}`} />
                    <span className="w-16 text-sm font-semibold text-slate-800">{l}</span>
                    <span className="flex items-center gap-1.5">
                      <input type="number" min={0} max={100} value={pct[k]} onChange={(e) => setPct({ ...pct, [k]: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} className="w-20 rounded-lg border border-[#e7dcc3] bg-white px-2 py-1.5 text-center font-semibold" aria-label={`${l} percent`} />
                      <span className="text-sm text-slate-500">%</span>
                    </span>
                    <span className="flex-1" />
                    <span className="w-28 text-right text-sm tabular-nums text-slate-500">≈ {Math.round((total * pct[k]) / 100)} questions</span>
                  </div>
                ))}
                <p className={`text-sm font-semibold ${pctSum === 100 ? "text-emerald-700" : "text-rose-700"}`}>
                  Total {pctSum}% {pctSum === 100 ? "✓" : "— must be 100%"}
                </p>
              </div>
            )}
          </Card>

          {/* 7. Types */}
          <Card
            n="4c"
            title="Question types"
            hint={`${formats.length ? `${formats.length} chosen` : "None chosen = every type"}${(opts?.formats || []).includes("numerical") ? "" : " · Multiple correct and numerical are for JEE only"}`}
          >
            <QuestionTypeCounts
              options={opts?.formats || Object.keys(FORMAT_LABELS).filter((f) => !JEE_ONLY.includes(f))}
              chosen={formats}
              onChosen={setFormats}
              counts={formatCounts}
              onCounts={setFormatCounts}
              total={total}
            />
          </Card>

          </>)}
          </>)}

          {step === 5 && (<>
          <PaperPreview rows={paperRows} />
          {/* 8. Who & when */}
          <Card n="5" title="Name, students & due date" hint="No timer. Students can answer any time before the due date.">
            <div className="mb-4">
              <label className="block">
                <span className="gp-label">Title (optional)</span>
                <input className={`${input} mt-1.5`} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`${subjectName || "Subject"} assignment`} maxLength={140} />
              </label>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="gp-label">College</span>
                <select className={`${input} mt-1.5`} value={college} onChange={(e) => setCollege(e.target.value)}>
                  {(opts?.colleges || ["MBPU"]).map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="gp-label">Due date</span>
                <input type="datetime-local" className={`${input} mt-1.5`} value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
              </label>
            </div>
            <div className="mt-4">
              <span className="gp-label">Sections</span>
              <div className="mt-1.5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSections([])}
                  className={`rounded-xl border px-4 py-2 text-sm font-bold transition ${!sections.length ? "border-[#17140f] bg-[#17140f] text-[#e5c372]" : "border-[#e7dcc3] bg-white text-slate-700 hover:border-[#c9a24a]"}`}
                >
                  All sections
                </button>
                {(opts?.sections || ["A", "B", "C", "D"]).map((s) => {
                  const on = sections.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggle(sections, setSections, s)}
                      className={`h-10 w-12 rounded-xl border text-sm font-bold transition ${on ? "border-[#17140f] bg-[#17140f] text-[#e5c372]" : "border-[#e7dcc3] bg-white text-slate-700 hover:border-[#c9a24a]"}`}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
            <label className="mt-4 block">
              <span className="gp-label">Instructions (optional)</span>
              <textarea className={`${input} mt-1.5 min-h-[84px]`} value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="e.g. Revise the formulae before you start." maxLength={2000} />
            </label>
          </Card>
          </>)}

          {/* Back / Proceed, like a real step-by-step form */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            {step > 1 ? (
              <button type="button" onClick={() => goTo(step - 1)} className="text-sm font-semibold text-slate-600 hover:text-slate-900">
                ← Back to {STEPS[step - 2][0]}
              </button>
            ) : (
              <span />
            )}
            {step < 5 ? (
              <button type="button" onClick={() => goTo(step + 1)} className="gp-btn gp-btn-dark px-6 py-3.5 text-sm uppercase tracking-wide">
                Proceed to {STEPS[step][0]} (step {step + 1}) →
              </button>
            ) : (
              <button type="button" onClick={create} disabled={saving} className="gp-btn gp-btn-gold px-6 py-3.5 text-sm">
                {saving ? <><span className="gp-spinner" />{manual ? "Saving…" : "Picking questions…"}</> : manual ? "Save & choose questions →" : "Create & review →"}
              </button>
            )}
          </div>
        </div>
        </div>
      </main>

      {modeOpen && (
        <ModeModal
          label={`${subjectName || "Subject"} · ${opts?.exams?.find((e) => String(e._id) === examId)?.code || ""}`}
          current={pickMode}
          onPick={(v) => {
            setPickMode(v);
            setModeAsked(true);
            setModeOpen(false);
          }}
          onClose={() => {
            setModeAsked(true);
            setModeOpen(false);
          }}
        />
      )}

    </LecturerLayout>
  );
}
