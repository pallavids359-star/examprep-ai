import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api, { getErrorMessage } from "../../api/axios";
import AdminLayout from "../../components/AdminLayout";
import LecturerOptions from "../../components/LecturerOptions";
import { toast } from "../../components/Toaster";
import { fmtDateTime, fmtDuration, lecturersFor, toLocalInput } from "../../components/liveHelpers";
import { Hero, ICONS, Step } from "../../components/premium";

// Head lecturer: create a live test (or edit one before it opens) in one short form.
const input = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-amber-500 focus:outline-none";

const OPEN_FOR = [
  ["3h", "3 hrs"],
  ["midnight", "Till 11:59 pm"],
  ["24h", "24 hrs"],
  ["2d", "2 days"],
  ["custom", "Custom"],
];
const PICKERS = [
  ["auto", "Auto", "GenPrep picks the questions for you"],
  ["me", "Admin (me)", "You, the admin, pick the questions yourself"],
  ["lecturer", "Lecturer", "A lecturer picks them"],
];
const pad = (n) => String(n).padStart(2, "0");
const dayString = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const today = () => dayString(0);
const DAYS = [
  [0, "Today"],
  [1, "Tomorrow"],
  [2, "Day after"],
];
const SLOTS = [
  ["Morning", ["06:00", "07:00", "08:00", "09:00", "10:00", "11:00"]],
  ["Afternoon", ["12:00", "13:00", "14:00", "15:00", "16:00", "17:00"]],
  ["Evening", ["18:00", "19:00", "20:00", "20:30", "21:00", "22:00"]],
];
const ALL_SLOTS = SLOTS.flatMap(([, l]) => l);
const TIMES = ALL_SLOTS;
const WEEK = [0, 1, 2, 3, 4, 5, 6];
const LABEL = "mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500";
const EXAM_META = {
  JEE: { subjects: "Physics · Chemistry · Maths", info: "3 h · 75 questions" },
  NEET: { subjects: "Physics · Chemistry · Biology", info: "3 h · 180 questions" },
  KCET: { subjects: "Physics · Chemistry · Maths · Biology", info: "240 questions" },
};
const fmtSpan = (ms) => {
  const min = Math.round(ms / 60000);
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  const m = min % 60;
  return [d && `${d} day${d > 1 ? "s" : ""}`, h && `${h} h`, m && `${m} min`].filter(Boolean).join(" ") || "0 min";
};
const fmtMin = (m) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} m` : ""}` : `${m} min`);
const timeLabel = (t) => {
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}${m ? `:${pad(m)}` : ""} ${h < 12 ? "AM" : "PM"}`;
};
const dayLabel = (d) => new Date(`${d}T00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });

export default function LiveTestForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [exams, setExams] = useState([]);
  const [lecturers, setLecturers] = useState([]);
  const [pattern, setPattern] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [examId, setExamId] = useState("");
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [date, setDate] = useState(today());
  const [time, setTime] = useState("20:30");
  const [openFor, setOpenFor] = useState("24h");
  const [customEnd, setCustomEnd] = useState("");
  const [duration, setDuration] = useState(180);
  const [otherDate, setOtherDate] = useState(false);
  const [otherTime, setOtherTime] = useState(false);
  const [otherLength, setOtherLength] = useState(false);
  const [split, setSplit] = useState(false);
  const [rows, setRows] = useState([]); // { key, name, include, picker, lecturerId, mcqCount, numericalCount }
  const [editCounts, setEditCounts] = useState(false);
  const [showResults, setShowResults] = useState("after_close");
  const [loadedSections, setLoadedSections] = useState(null);
  const [openTest, setOpenTest] = useState(null); // test already open: only its name and closing time can change

  useEffect(() => {
    Promise.all([api.get("/exams"), api.get("/admin/lecturers")])
      .then(([e, l]) => {
        setExams(e.data.exams);
        setLecturers(l.data.lecturers.filter((x) => x.status === "active" && x.role === "lecturer"));
        if (!id && e.data.exams[0]) setExamId((cur) => cur || e.data.exams[0]._id);
      })
      .catch((err) => setError(getErrorMessage(err)));
    if (!id) return;
    api
      .get(`/admin/live-tests/${id}`)
      .then((res) => {
        const t = res.data.test;
        if (!t.editable) {
          if (t.phase === "open") setOpenTest(t);
          else navigate(`/admin/live-tests/${id}`, { replace: true });
          return;
        }
        const s = new Date(t.startsAt);
        setExamId(t.examId);
        setTitle(t.title);
        setTitleTouched(true);
        setDate(`${s.getFullYear()}-${pad(s.getMonth() + 1)}-${pad(s.getDate())}`);
        const tm = `${pad(s.getHours())}:${pad(s.getMinutes())}`;
        setTime(tm);
        setOtherTime(!TIMES.includes(tm));
        const ds = `${s.getFullYear()}-${pad(s.getMonth() + 1)}-${pad(s.getDate())}`;
        setOtherDate(!DAYS.some(([o]) => dayString(o) === ds));
        setOpenFor("custom");
        setCustomEnd(toLocalInput(t.endsAt));
        setDuration(t.durationMinutes);
        setSplit(Boolean(t.live?.splitBiology));
        setShowResults(t.live?.showResults || "after_close");
        setLoadedSections(t.sections);
      })
      .catch((err) => setError(getErrorMessage(err)));
  }, [id, navigate]);

  // The exam's subjects and usual time
  useEffect(() => {
    if (!examId) return;
    setError("");
    api
      .get("/admin/live-tests/pattern", { params: { examId } })
      .then((res) => {
        setPattern(res.data);
        if (!id) setDuration(res.data.minutes);
      })
      .catch((err) => {
        setPattern(null);
        setError(getErrorMessage(err));
      });
  }, [examId, id]);

  // Subject rows: rebuilt when the exam or the Biology split changes, keeping choices made
  useEffect(() => {
    if (!pattern) return;
    const defs = split && pattern.splitSections ? pattern.splitSections : pattern.sections;
    setRows((prev) =>
      defs.map((d) => {
        const old = prev.find((p) => p.key === d.key);
        if (old) return old;
        const saved = loadedSections?.find((s) => s.key === d.key);
        if (saved) return { key: d.key, name: d.name, include: true, picker: saved.picker || "lecturer", lecturerId: saved.lecturer?._id || "", mcqCount: saved.mcqCount, numericalCount: saved.numericalCount };
        return { key: d.key, name: d.name, include: !loadedSections, picker: "auto", lecturerId: "", mcqCount: d.mcqCount, numericalCount: d.numericalCount };
      })
    );
  }, [pattern, split, loadedSections]);

  const exam = exams.find((e) => e._id === examId);
  const dateRef = useRef(null);
  const inWeek = WEEK.some((o) => dayString(o) === date);
  const lengths = [...new Set([60, 90, 120, 180, pattern?.minutes].filter(Boolean))].sort((x, y) => x - y);
  // Suggested name until the admin types one
  useEffect(() => {
    if (titleTouched || !exam || !date) return;
    const d = new Date(`${date}T00:00`);
    setTitle(`${exam.code} Live Test – ${d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`);
  }, [exam, date, titleTouched]);

  const startsAt = useMemo(() => (date && time ? new Date(`${date}T${time}`) : null), [date, time]);
  const endsAt = useMemo(() => {
    if (!startsAt) return null;
    const t = startsAt.getTime();
    if (openFor === "3h") return new Date(t + 3 * 3600e3);
    if (openFor === "24h") return new Date(t + 24 * 3600e3);
    if (openFor === "2d") return new Date(t + 48 * 3600e3);
    if (openFor === "midnight") return new Date(`${date}T23:59`);
    return customEnd ? new Date(customEnd) : null;
  }, [startsAt, openFor, date, customEnd]);

  const setRow = (key, patch) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const included = rows.filter((r) => r.include);
  const totalQs = included.reduce((a, r) => a + Number(r.mcqCount || 0) + Number(r.numericalCount || 0), 0);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!included.length) return setError("Include at least one subject");
    if (included.some((r) => r.picker === "lecturer" && !r.lecturerId)) return setError("Choose a lecturer for each subject marked 'Lecturer'");
    if (!startsAt || !endsAt) return setError("Choose when the test opens and closes");
    if (endsAt <= startsAt) return setError("The test must close after it opens");
    setSaving(true);
    const body = {
      examId,
      title,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      durationMinutes: Number(duration),
      splitBiology: split,
      showResults,
      shuffle: true,
      sections: included.map((r) => ({
        key: r.key,
        picker: r.picker,
        lecturerId: r.picker === "lecturer" ? r.lecturerId : undefined,
        mcqCount: Number(r.mcqCount),
        numericalCount: Number(r.numericalCount),
      })),
    };
    try {
      const res = id ? await api.put(`/admin/live-tests/${id}`, body) : await api.post("/admin/live-tests", body);
      (res.data.notes || []).forEach((n) => toast(n, "error"));
      toast(res.data.status === "published" ? "All set. The test opens by itself at the start time." : "Saved. Lecturers can start picking. The test opens once every subject is ready.");
      navigate(`/admin/live-tests/${id || res.data.testId}`);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (openTest) return <OpenTestEdit test={openTest} />;

  return (
    <AdminLayout>
      <Link to={id ? `/admin/live-tests/${id}` : "/admin/live-tests"} className="text-sm font-semibold text-amber-800 hover:underline">
        ← Back
      </Link>
      <div className="mt-3">
        <Hero
          eyebrow={id ? "Edit live test" : "New live test"}
          title={id ? "Change the plan" : "Set up a live test"}
          subtitle="Three quick choices. Everything has a sensible default, so you can create it straight away."
        />
      </div>
      <form onSubmit={submit} className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
       <div className="min-w-0 space-y-5">
        {/* 1. Exam */}
        <section className="gp-card space-y-4 p-6">
          <Step n={1} title="Which exam?" hint={id ? "The exam can't change after creating the test" : "Subjects and question counts follow the real exam"} />
          <div className="grid gap-3 sm:grid-cols-3">
            {exams.map((e) => {
              const meta = EXAM_META[e.code] || { subjects: e.name, info: "" };
              const on = examId === e._id;
              return (
                <button
                  key={e._id}
                  type="button"
                  disabled={Boolean(id) && !on}
                  aria-pressed={on}
                  className="gp-tile relative p-4 text-left disabled:opacity-40"
                  onClick={() => {
                    if (on) return;
                    setRows([]);
                    setSplit(false);
                    setExamId(e._id);
                  }}
                >
                  {on && <span className="absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full bg-slate-900 text-[11px] text-amber-200">✓</span>}
                  <span className="font-display text-2xl font-extrabold text-slate-900">{e.code}</span>
                  <span className="mt-1 block text-xs text-slate-600">{meta.subjects}</span>
                  {meta.info && <span className="mt-2 block text-xs font-semibold text-amber-800">{meta.info}</span>}
                </button>
              );
            })}
          </div>
        </section>

        {/* 2. When */}
        <section className="gp-card space-y-6 p-6">
          <Step n={2} title="When can students write it?" hint="They start any time inside this window" />

          <div>
            <p className={LABEL}>Day</p>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {WEEK.map((o) => {
                const d = dayString(o);
                const x = new Date(`${d}T00:00`);
                const on = date === d;
                return (
                  <button
                    key={o}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setDate(d)}
                    className="gp-tile flex w-[72px] shrink-0 flex-col items-center py-2.5"
                  >
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${on ? "text-amber-800" : "text-slate-500"}`}>
                      {o === 0 ? "Today" : o === 1 ? "Tmrw" : x.toLocaleDateString("en-IN", { weekday: "short" })}
                    </span>
                    <span className="font-display text-2xl font-extrabold leading-tight text-slate-900">{x.getDate()}</span>
                    <span className="text-[11px] text-slate-500">{x.toLocaleDateString("en-IN", { month: "short" })}</span>
                  </button>
                );
              })}
              <label
                aria-pressed={!inWeek}
                className="gp-tile relative flex w-[96px] shrink-0 cursor-pointer flex-col items-center justify-center py-2.5 text-center"
                onClick={() => dateRef.current?.showPicker?.()}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5 text-amber-700" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d={ICONS.calendar} />
                </svg>
                <span className="mt-1 text-xs font-semibold text-slate-800">{inWeek ? "Other date" : dayLabel(date)}</span>
                <input
                  ref={dateRef}
                  type="date"
                  aria-label="Pick another date"
                  min={today()}
                  value={date}
                  onChange={(e) => e.target.value && setDate(e.target.value)}
                  className="absolute inset-0 cursor-pointer opacity-0"
                />
              </label>
            </div>
          </div>

          <div>
            <p className={LABEL}>Start time</p>
            <div className="space-y-2">
              {SLOTS.map(([part, list]) => (
                <div key={part} className="flex items-center gap-3">
                  <span className="w-20 shrink-0 text-xs font-semibold text-slate-500">{part}</span>
                  <div className="grid flex-1 grid-cols-3 gap-2 sm:grid-cols-6">
                    {list.map((t) => (
                      <button
                        key={t}
                        type="button"
                        aria-pressed={time === t}
                        onClick={() => setTime(t)}
                        className="gp-tile py-2 text-sm font-semibold tabular-nums text-slate-800"
                      >
                        {timeLabel(t)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-3">
                <span className="w-20 shrink-0 text-xs font-semibold text-slate-500">Exact</span>
                <input
                  type="time"
                  aria-label="Exact start time"
                  value={time}
                  onChange={(e) => e.target.value && setTime(e.target.value)}
                  className={`${input} max-w-[9rem] ${ALL_SLOTS.includes(time) ? "" : "border-amber-500 ring-2 ring-amber-200"}`}
                />
              </div>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <p className={LABEL}>Students can start it for</p>
              <Segmented value={openFor} onChange={setOpenFor} options={OPEN_FOR} />
              {openFor === "custom" && (
                <input type="datetime-local" aria-label="Closes" className={`${input} mt-2`} value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
              )}
            </div>
            <div>
              <p className={LABEL}>Each student gets</p>
              <Segmented
                value={lengths.includes(Number(duration)) && !otherLength ? Number(duration) : "other"}
                onChange={(v) => {
                  if (v === "other") return setOtherLength(true);
                  setOtherLength(false);
                  setDuration(v);
                }}
                options={[...lengths.map((m) => [m, fmtMin(m), m === pattern?.minutes ? "real exam" : ""]), ["other", "Other"]]}
              />
              {(otherLength || !lengths.includes(Number(duration))) && (
                <label className="mt-2 flex items-center gap-2 text-sm text-slate-700">
                  <input type="number" min={5} max={360} aria-label="Minutes" className={`${input} w-28`} value={duration} onChange={(e) => setDuration(e.target.value)} required />
                  minutes
                </label>
              )}
            </div>
          </div>

          {/* Timeline */}
          {startsAt && endsAt && endsAt > startsAt ? (
            <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-white p-4 ring-1 ring-amber-200/70">
              <div className="flex items-center gap-3">
                <TimePoint label="Opens" d={startsAt} />
                <div className="relative flex-1">
                  <div className="h-1.5 rounded-full bg-gradient-to-r from-amber-300 via-amber-500 to-slate-900" />
                  <p className="mt-2 text-center text-xs text-slate-600">
                    Open for <b>{fmtSpan(endsAt - startsAt)}</b> · each student gets <b>{fmtMin(Number(duration) || 0)}</b>
                  </p>
                </div>
                <TimePoint label="Closes" d={endsAt} right />
              </div>
            </div>
          ) : (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">The closing time must be after the opening time.</p>
          )}

          <label className="block">
            <span className={LABEL}>Test name</span>
            <input
              className={input}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setTitleTouched(true);
              }}
              required
              minLength={3}
              maxLength={140}
            />
          </label>
        </section>

        {/* 2. Questions */}
        {pattern && (
          <section className="gp-card space-y-4 p-6">
            <Step n={3} title="Who sets the questions?" hint="For the whole test, or subject by subject below" right={<span className="gp-chip">{totalQs} questions</span>} />
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ["me", "I'll set it myself", "As admin, you pick every subject's questions", "A"],
                ["lecturer", "Give to lecturers", "Each subject's lecturer picks and sends it", "L"],
                ["auto", "Auto-pick everything", "GenPrep fills all subjects now; change any later", "⚡"],
              ].map(([v, l, hint, icon]) => {
                const all = included.length > 0 && included.every((r) => r.picker === v);
                return (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={all}
                    onClick={() =>
                      setRows((rs) =>
                        rs.map((r) =>
                          r.include ? { ...r, picker: v, lecturerId: v === "lecturer" ? r.lecturerId || lecturersFor(lecturers, r.key).match[0]?._id || "" : r.lecturerId } : r
                        )
                      )
                    }
                    className="gp-tile flex items-start gap-3 p-4 text-left"
                  >
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl font-display text-sm font-extrabold ${all ? "bg-slate-900 text-amber-200" : "bg-amber-50 text-amber-800"}`}>{icon}</span>
                    <span className="min-w-0">
                      <span className="block font-bold text-slate-900">{l}</span>
                      <span className="block text-xs text-slate-500">{hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Or choose per subject</p>
            {pattern.canSplitBiology && (
              <label className="flex items-center gap-3 text-sm text-slate-800">
                <input type="checkbox" className="h-4 w-4 accent-amber-600" checked={split} onChange={(e) => setSplit(e.target.checked)} />
                Split Biology into Botany and Zoology
              </label>
            )}
            <div className="space-y-3">
              {rows.map((r) => (
                <div key={r.key} className={`rounded-2xl border p-4 transition ${r.include ? "border-slate-200 bg-white" : "border-dashed border-slate-200 opacity-60"}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="flex items-center gap-2 font-semibold text-slate-900">
                      <input type="checkbox" className="h-4 w-4 accent-amber-600" checked={r.include} onChange={(e) => setRow(r.key, { include: e.target.checked })} />
                      {r.name}
                      <span className="text-sm font-normal text-slate-500">
                        · {r.mcqCount} MCQ{Number(r.numericalCount) ? ` + ${r.numericalCount} numerical` : ""}
                      </span>
                    </label>
                    {r.include && (
                      <div className="flex gap-1.5" role="group" aria-label={`Who picks ${r.name} questions`}>
                        {PICKERS.map(([v, l, hint]) => (
                          <button key={v} type="button" title={hint} aria-pressed={r.picker === v} className="gp-tile px-3 py-1.5 text-sm font-semibold text-slate-800 disabled:opacity-50" onClick={() => setRow(r.key, { picker: v, ...(v === "lecturer" && !r.lecturerId ? { lecturerId: lecturersFor(lecturers, r.key).match[0]?._id || "" } : {}) })}>
                            {l}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {r.include && r.picker === "lecturer" && (
                    <select aria-label={`Lecturer for ${r.name}`} className={`${input} mt-3 max-w-xs`} value={r.lecturerId} onChange={(e) => setRow(r.key, { lecturerId: e.target.value })}>
                      <LecturerOptions list={lecturers} sectionKey={r.key} />
                    </select>
                  )}
                  {r.include && r.picker === "lecturer" && lecturers.length === 0 && (
                    <p className="mt-2 text-sm text-amber-800">
                      No lecturers yet.{" "}
                      <Link to="/admin/lecturers" className="font-semibold underline">
                        Add one
                      </Link>{" "}
                      or choose Auto / Me.
                    </p>
                  )}
                  {r.include && editCounts && (
                    <div className="mt-3 flex flex-wrap gap-3 text-sm">
                      <label className="flex items-center gap-2">
                        MCQ
                        <input type="number" min={0} max={200} className={`${input} w-24`} value={r.mcqCount} onChange={(e) => setRow(r.key, { mcqCount: e.target.value })} />
                      </label>
                      <label className="flex items-center gap-2">
                        Numerical
                        <input type="number" min={0} max={50} className={`${input} w-24`} value={r.numericalCount} onChange={(e) => setRow(r.key, { numericalCount: e.target.value })} />
                      </label>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <p className="text-sm text-slate-500">
              <b>Auto</b> picks a mix from the whole syllabus right away, including diagram questions; you can change them later.{" "}
              <button type="button" className="font-semibold text-amber-800 hover:underline" onClick={() => setEditCounts((v) => !v)}>
                {editCounts ? "Hide question counts" : "Change number of questions"}
              </button>
            </p>
          </section>
        )}

        {/* 3. Results */}
        <section className="gp-card space-y-4 p-6">
          <Step n={4} title="When do students see their result?" />
          <div className="flex flex-wrap gap-2">
            <button type="button" aria-pressed={showResults === "after_close"} className="gp-tile px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-50" onClick={() => setShowResults("after_close")}>
              After the test closes (with rank)
            </button>
            <button type="button" aria-pressed={showResults === "after_submit"} className="gp-tile px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-50" onClick={() => setShowResults("after_submit")}>
              Right after they submit
            </button>
          </div>
        </section>

       </div>

        {/* Summary */}
        <aside className="lg:sticky lg:top-6">
          <div className="gp-hero p-6">
            <div className="relative">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-200/80">Summary</p>
              <p className="mt-2 truncate font-display text-xl font-extrabold text-white">{title || "Live test"}</p>
              <dl className="mt-4 space-y-3 text-sm">
                {[
                  ["Exam", exam?.code || "—"],
                  ["Opens", startsAt ? fmtDateTime(startsAt) : "—"],
                  ["Closes", endsAt && startsAt && endsAt > startsAt ? fmtDateTime(endsAt) : "—"],
                  ["Length", duration ? fmtDuration(Number(duration) * 60) : "—"],
                  ["Questions", totalQs || "—"],
                  ["Results", showResults === "after_close" ? "After it closes" : "Right after submit"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 border-b border-white/10 pb-2">
                    <dt className="text-amber-100/70">{k}</dt>
                    <dd className="text-right font-semibold text-white">{v}</dd>
                  </div>
                ))}
              </dl>
              {included.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {included.map((r) => (
                    <span key={r.key} className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-amber-100">
                      {r.name} · {r.picker === "auto" ? "Auto" : r.picker === "me" ? "You" : lecturers.find((l) => l._id === r.lecturerId)?.name || "Lecturer"}
                    </span>
                  ))}
                </div>
              )}
              {error && <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
              <button type="submit" disabled={saving || !examId || !pattern} className="gp-gold-btn mt-5 w-full px-6 py-3.5 text-sm disabled:opacity-50">
                {saving ? "Saving..." : id ? "Save changes" : "Create live test"}
              </button>
              <p className="mt-2 text-center text-xs text-amber-100/60">It opens by itself once every subject is ready (lecturers send theirs to you).</p>
            </div>
          </div>
        </aside>
      </form>
    </AdminLayout>
  );
}

// Equal-width options in one bar
function Segmented({ value, onChange, options }) {
  return (
    <div className="grid gap-1 rounded-2xl bg-amber-50/70 p-1 ring-1 ring-amber-200/70" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }} role="radiogroup">
      {options.map(([v, l, sub]) => {
        const on = value === v;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(v)}
            className={`rounded-xl px-1 py-2 text-center text-[13px] font-semibold leading-tight transition ${on ? "bg-slate-900 text-amber-200 shadow-md" : "text-slate-700 hover:bg-white"}`}
          >
            {l}
            {sub && <span className={`block text-[10px] font-medium ${on ? "text-amber-200/70" : "text-slate-400"}`}>{sub}</span>}
          </button>
        );
      })}
    </div>
  );
}

function TimePoint({ label, d, right = false }) {
  return (
    <div className={`shrink-0 ${right ? "text-right" : ""}`}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-amber-800">{label}</p>
      <p className="font-display text-lg font-extrabold leading-tight text-slate-900">{d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</p>
      <p className="text-xs text-slate-500">{d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}</p>
    </div>
  );
}

// The test is already open (students may be writing it): rename it or keep it open longer
function OpenTestEdit({ test }) {
  const navigate = useNavigate();
  const [title, setTitle] = useState(test.title);
  const [end, setEnd] = useState(toLocalInput(test.endsAt));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const oldEnd = new Date(test.endsAt);
  const newEnd = end ? new Date(end) : null;
  const addHours = (h) => setEnd(toLocalInput(new Date(Math.max(oldEnd.getTime(), (newEnd || oldEnd).getTime()) + h * 3600e3)));

  const save = async (e) => {
    e.preventDefault();
    setError("");
    if (!newEnd || newEnd < oldEnd) return setError("While the test is open, the closing time can only move later");
    setSaving(true);
    try {
      await api.put(`/admin/live-tests/${test._id}`, { title, endsAt: newEnd.toISOString() });
      toast("Saved");
      navigate(`/admin/live-tests/${test._id}`);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout>
      <Link to={`/admin/live-tests/${test._id}`} className="text-sm font-semibold text-amber-800 hover:underline">
        ← Back
      </Link>
      <div className="mt-3">
        <Hero eyebrow="Edit live test" title={test.title} subtitle="This test is open now, so students may be writing it. You can rename it or keep it open for longer. The start time, length and questions are fixed." />
      </div>
      <form onSubmit={save} className="gp-card mt-6 max-w-2xl space-y-6 p-6">
        <label className="block">
          <span className={LABEL}>Test name</span>
          <input className={input} value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} maxLength={140} />
        </label>
        <div>
          <span className={LABEL}>Closes</span>
          <div className="flex flex-wrap items-center gap-2">
            <input type="datetime-local" aria-label="Closing time" className={`${input} max-w-xs`} value={end} min={toLocalInput(test.endsAt)} onChange={(e) => setEnd(e.target.value)} />
            {[
              [1, "+1 hour"],
              [3, "+3 hours"],
              [24, "+1 day"],
            ].map(([h, l]) => (
              <button key={h} type="button" onClick={() => addHours(h)} className="gp-tile px-3 py-2 text-sm font-semibold text-slate-800">
                {l}
              </button>
            ))}
          </div>
          <p className="mt-2 text-sm text-slate-500">
            Now closes {fmtDateTime(oldEnd)}
            {newEnd && newEnd.getTime() !== oldEnd.getTime() ? (
              <>
                {" "}
                → <b className="text-slate-900">{fmtDateTime(newEnd)}</b>
              </>
            ) : null}
          </p>
        </div>
        {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        <div className="flex justify-end">
          <button type="submit" disabled={saving} className="gp-gold-btn px-6 py-3 text-sm disabled:opacity-50">
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </form>
    </AdminLayout>
  );
}
