import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { getErrorMessage } from "../../api/axios";
import LecturerLayout from "../../components/LecturerLayout";
import BackLink from "../../components/BackLink";
import { Step } from "../../components/premium";
import { toast } from "../../components/Toaster";
import { toLocalInput } from "../../components/liveHelpers";
import { CLASS_LABELS, FORMAT_LABELS, JEE_ONLY } from "../../components/assignmentHelpers";
import QuestionTypeCounts, { cleanCounts, typedTotal } from "../../components/QuestionTypeCounts";

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

function Choice({ on, onClick, children, sub, className = "" }) {
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

function Tick({ on }) {
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

function Card({ n, title, hint, right, children }) {
  return (
    <section className="gp-card p-5 md:p-6">
      <Step n={n} title={title} hint={hint} right={right} />
      <div className="mt-5">{children}</div>
    </section>
  );
}

// Lecturer: make a new assignment
export default function AssignmentForm() {
  const navigate = useNavigate();
  const [opts, setOpts] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [examId, setExamId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [title, setTitle] = useState("");
  const [pickMode, setPickMode] = useState("auto");
  const [classLevel, setClassLevel] = useState("both");
  const [chapters, setChapters] = useState(null);
  const [chapterIds, setChapterIds] = useState([]);
  const [chapterSearch, setChapterSearch] = useState("");
  const [topicIds, setTopicIds] = useState([]);
  const [topicTab, setTopicTab] = useState("");
  const [countMode, setCountMode] = useState("total");
  const [totalCount, setTotalCount] = useState(20);
  const [perChapter, setPerChapter] = useState({});
  const [diffMode, setDiffMode] = useState("equal");
  const [pct, setPct] = useState({ easy: 40, medium: 40, hard: 20 });
  const [formats, setFormats] = useState([]);
  const [formatCounts, setFormatCounts] = useState({});
  const [college, setCollege] = useState("MB PU");
  const [sections, setSections] = useState([]);
  const [dueAt, setDueAt] = useState(nextWeek());
  const [instructions, setInstructions] = useState("");

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
      .then((res) => setChapters(res.data.chapters))
      .catch((err) => setError(getErrorMessage(err)));
  }, [subjectId]);

  const inClass = useMemo(() => (chapters || []).filter((c) => classLevel === "both" || String(c.classLevel) === classLevel), [chapters, classLevel]);
  const visible = inClass.filter((c) => c.name.toLowerCase().includes(chapterSearch.trim().toLowerCase()));
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
    if (!picked.some((c) => String(c._id) === topicTab)) setTopicTab(String(picked[0]?._id || ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterIds.join(",")]);

  const toggle = (list, setList, id) => setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const allVisibleOn = visible.length > 0 && visible.every((c) => chapterIds.includes(String(c._id)));
  const toggleAllVisible = () => {
    const ids = visible.map((c) => String(c._id));
    setChapterIds(allVisibleOn ? chapterIds.filter((id) => !ids.includes(id)) : [...new Set([...chapterIds, ...ids])]);
  };

  const total = countMode === "total" ? Number(totalCount) || 0 : picked.reduce((n, c) => n + (Number(perChapter[c._id]) || 0), 0);
  const pctSum = pct.easy + pct.medium + pct.hard;
  const tabChapter = picked.find((c) => String(c._id) === topicTab);
  const conceptsIn = (c) => c.topics.filter((t) => topicIds.includes(String(t._id))).length;

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

  const subjectName = opts?.subjects?.find((s) => String(s._id) === subjectId)?.name || "";

  return (
    <LecturerLayout>
      <main className="mx-auto max-w-5xl px-4 pb-40 pt-6 md:px-8 md:pt-8">
        <BackLink to="/lecturer/assignments">Assignments</BackLink>
        <div className="mt-4">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#b8862b]">New assignment</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold text-slate-900 md:text-4xl">Build the question set</h1>
          <p className="mt-1 text-slate-500">You'll see every question before students do.</p>
        </div>

        {error && <div className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div className="mt-6 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="How to choose questions">
          {[
            ["auto", "Auto fetch", "Set the count, difficulty and types. Questions are picked for you, then you check them.", "M13 2L3 14h8l-1 8 10-12h-8z"],
            ["manual", "Choose manually", "Browse the question bank like a live test and add each question yourself.", "M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"],
          ].map(([v, l, sub, icon]) => {
            const on = pickMode === v;
            return (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setPickMode(v)}
                className={`flex items-start gap-4 rounded-3xl border p-5 text-left transition ${on ? "border-[#17140f] bg-[#17140f] text-white shadow-xl shadow-black/10" : "border-[#e7dcc3] bg-white hover:border-[#c9a24a]"}`}
              >
                <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${on ? "bg-gradient-to-b from-[#e5c372] to-[#b8862b] text-[#17140f]" : "bg-[#f3ecdc] text-[#b8862b]"}`}>
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d={icon} />
                  </svg>
                </span>
                <span>
                  <span className="block text-base font-extrabold">{l}</span>
                  <span className={`mt-0.5 block text-sm ${on ? "text-amber-50/80" : "text-slate-500"}`}>{sub}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-5 space-y-5">
          {/* 1. Subject */}
          <Card n={1} title="Exam & subject" hint="Students see the title on their list">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="gp-label">Title (optional)</span>
                <input className={`${input} mt-1.5`} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`${subjectName || "Subject"} assignment`} maxLength={140} />
              </label>
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
          <Card n={2} title="Class" hint="Which year's chapters to use">
            <div className="grid grid-cols-3 gap-3">
              {[
                ["11", "1st PUC", "Class 11"],
                ["12", "2nd PUC", "Class 12"],
                ["both", "Both", "1st + 2nd PUC"],
              ].map(([v, l, sub]) => (
                <Choice key={v} on={classLevel === v} onClick={() => setClassLevel(v)} sub={sub}>
                  {l}
                </Choice>
              ))}
            </div>
          </Card>

          {/* 3. Chapters */}
          <Card
            n={3}
            title="Chapters"
            hint={`${chapterIds.length} of ${inClass.length} ticked`}
            right={
              inClass.length > 0 && (
                <button type="button" onClick={toggleAllVisible} className="gp-ghost-btn px-3 py-1.5 text-xs font-semibold">
                  {allVisibleOn ? "Untick all" : "Tick all"}
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
                <input className={input} value={chapterSearch} onChange={(e) => setChapterSearch(e.target.value)} placeholder="Search chapters…" />
                <div className="mt-3 grid max-h-80 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                  {visible.map((c) => {
                    const on = chapterIds.includes(String(c._id));
                    return (
                      <button
                        key={c._id}
                        type="button"
                        onClick={() => toggle(chapterIds, setChapterIds, String(c._id))}
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
          </Card>

          {/* 4. Concepts */}
          <Card n={4} title="Concepts" hint={topicIds.length ? `${topicIds.length} concepts chosen` : manual ? "Optional · limits what you browse" : "Optional · leave empty to use every concept"}
            right={topicIds.length > 0 && <button type="button" onClick={() => setTopicIds([])} className="gp-ghost-btn px-3 py-1.5 text-xs font-semibold">Clear</button>}>
            {!picked.length ? (
              <p className="rounded-xl bg-[#faf6ec] px-4 py-6 text-center text-sm text-slate-500">Tick chapters first.</p>
            ) : (
              <>
                <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                  {picked.map((c) => {
                    const on = String(c._id) === topicTab;
                    const n = conceptsIn(c);
                    return (
                      <button
                        key={c._id}
                        type="button"
                        onClick={() => setTopicTab(String(c._id))}
                        className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${on ? "bg-[#17140f] text-[#e5c372]" : "bg-[#f3ecdc] text-slate-700 hover:bg-[#ece1c7]"}`}
                      >
                        {c.name}
                        {n > 0 && <span className={`ml-1.5 rounded-full px-1.5 ${on ? "bg-[#e5c372] text-[#17140f]" : "bg-white text-[#b8862b]"}`}>{n}</span>}
                      </button>
                    );
                  })}
                </div>
                {tabChapter && (
                  <div className="mt-3 rounded-2xl border border-[#efe6d2] bg-[#fffdf8] p-3">
                    {!tabChapter.topics.length ? (
                      <p className="py-3 text-center text-sm text-slate-500">This chapter has no concepts listed. All its questions will be used.</p>
                    ) : (
                      <div className="grid gap-1.5 sm:grid-cols-2">
                        {tabChapter.topics.map((t) => {
                          const on = topicIds.includes(String(t._id));
                          return (
                            <button
                              key={t._id}
                              type="button"
                              onClick={() => toggle(topicIds, setTopicIds, String(t._id))}
                              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition ${on ? "bg-[#fbf1d9] text-slate-900" : "text-slate-700 hover:bg-[#faf6ec]"}`}
                            >
                              <Tick on={on} />
                              {t.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
                {topicIds.length > 0 && (
                  <p className="mt-2 text-xs text-slate-500">Chapters where you pick no concepts use all of their concepts.</p>
                )}
              </>
            )}
          </Card>

          {!manual && (<>
          {/* 5. Count */}
          <Card n={5} title="How many questions" hint={`${total} in all`}>
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
          <Card n={6} title="Difficulty">
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
            n={7}
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

          {/* 8. Who & when */}
          <Card n={manual ? 5 : 8} title="Students & due date" hint="No timer. Students can answer any time before the due date.">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="gp-label">College</span>
                <select className={`${input} mt-1.5`} value={college} onChange={(e) => setCollege(e.target.value)}>
                  {(opts?.colleges || ["MB PU"]).map((c) => (
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
        </div>
      </main>

      {/* Summary bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[#e7dcc3] bg-[#fffdf8]/95 backdrop-blur lg:left-64">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3 md:px-8">
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-extrabold text-slate-900">
              {manual ? "Choose manually" : `${total} question${total === 1 ? "" : "s"}`}
              <span className="ml-2 text-sm font-semibold text-slate-500">
                {chapterIds.length} chapter{chapterIds.length === 1 ? "" : "s"} · {CLASS_LABELS[classLevel]}{manual ? "" : " · "}{manual ? "" : diffMode === "custom" ? `${pct.easy}/${pct.medium}/${pct.hard}` : diffMode === "equal" ? "Equal" : "Any"}{manual ? "" : " difficulty"}
              </span>
            </p>
            <p className={`truncate text-xs ${problem ? "text-rose-700" : "text-emerald-700"}`}>{problem || `Ready · ${college}${sections.length ? ` · Section ${sections.join(", ")}` : ""}`}</p>
          </div>
          <button type="button" onClick={create} disabled={saving} className="gp-gold-btn px-6 py-3 text-sm disabled:opacity-60">
            {saving ? (manual ? "Saving…" : "Picking questions…") : manual ? "Next: choose questions →" : "Create & review →"}
          </button>
        </div>
      </div>
    </LecturerLayout>
  );
}
