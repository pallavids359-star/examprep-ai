import { useEffect, useMemo, useRef, useState } from "react";
import QuestionTypeCounts, { cleanCounts, typedTotal } from "../../components/QuestionTypeCounts";
import BackLink from "../../components/BackLink";
import { Link, useNavigate, useParams } from "react-router-dom";
import api, { getErrorMessage } from "../../api/axios";
import AdminLayout from "../../components/AdminLayout";
import LecturerOptions from "../../components/LecturerOptions";
import { toast } from "../../components/Toaster";
import { useAuth } from "../../context/AuthContext";
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

// A new test's unfinished choices are kept in this browser, so going back by mistake loses nothing
const liveDraftKey = (user) => `gp-livetest-draft:${user?._id || user?.email || "me"}`;
const readLiveDraft = (user) => {
  try {
    const d = JSON.parse(localStorage.getItem(liveDraftKey(user)) || "null");
    return d && Date.now() - (d.savedAt || 0) < 14 * 864e5 ? d : null;
  } catch {
    return null;
  }
};

export default function LiveTestForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [draft] = useState(() => (id ? null : readLiveDraft(user)));
  const d = (k, fallback) => (draft && draft[k] !== undefined ? draft[k] : fallback);
  const keepDuration = useRef(Boolean(draft?.duration));
  const [restored, setRestored] = useState(Boolean(draft));
  const [exams, setExams] = useState([]);
  const [lecturers, setLecturers] = useState([]);
  const [pattern, setPattern] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [examId, setExamId] = useState(() => d("examId", ""));
  const [title, setTitle] = useState(() => d("title", ""));
  const [titleTouched, setTitleTouched] = useState(() => d("titleTouched", false));
  const [date, setDate] = useState(() => d("date", today()));
  const [time, setTime] = useState(() => d("time", "20:30"));
  const [openFor, setOpenFor] = useState(() => d("openFor", "custom"));
  const [endTouched, setEndTouched] = useState(() => d("endTouched", false));
  const [customEnd, setCustomEnd] = useState(() => d("customEnd", ""));
  const [duration, setDuration] = useState(() => d("duration", 180));
  const [otherDate, setOtherDate] = useState(() => d("otherDate", false));
  const [otherTime, setOtherTime] = useState(() => d("otherTime", false));
  const [otherLength, setOtherLength] = useState(() => d("otherLength", false));
  const [split, setSplit] = useState(() => d("split", false));
  const [rows, setRows] = useState(() => d("rows", [])); // { key, name, include, picker, lecturerId, mcqCount, numericalCount }
  // Auto-pick choices
  const [autoClass, setAutoClass] = useState(() => d("autoClass", "both"));
  const [autoMix, setAutoMix] = useState(() => d("autoMix", { easy: "", medium: "", hard: "" })); // typed %; empty = any difficulty
  const [autoFormats, setAutoFormats] = useState(() => d("autoFormats", []));
  const [autoFormatCounts, setAutoFormatCounts] = useState(() => d("autoFormatCounts", {}));
  const [perChapter, setPerChapter] = useState(() => d("perChapter", {})); // sectionKey -> { chapterId: count }
  const [chapterOpen, setChapterOpen] = useState(() => d("chapterOpen", {})); // sectionKey -> open
  const [showResults, setShowResults] = useState("after_submit"); // students see their result as soon as they finish
  const [college, setCollege] = useState(() => d("college", "")); // "" = every student
  const [audSections, setAudSections] = useState(() => d("audSections", [])); // none = all sections
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
          if (t.phase !== "archived") setOpenTest(t);
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
        setEndTouched(true);
        setCustomEnd(toLocalInput(t.endsAt));
        setDuration(t.durationMinutes);
        setSplit(Boolean(t.live?.splitBiology));

        setCollege(t.live?.college || "");
        const au = t.live?.auto || {};
        setAutoClass(au.classLevel || "both");
        setAutoMix(au.mix?.easy || au.mix?.medium || au.mix?.hard ? { easy: String(au.mix.easy || 0), medium: String(au.mix.medium || 0), hard: String(au.mix.hard || 0) } : { easy: "", medium: "", hard: "" });
        setAutoFormats(au.formats || []);
        setAutoFormatCounts(Object.fromEntries(Object.entries(au.formatCounts || {}).map(([f, n]) => [f, String(n)])));
        const pc = {};
        (au.perChapter || []).forEach((x) => ((pc[x.sectionKey] = pc[x.sectionKey] || {})[x.chapterId] = String(x.count)));
        setPerChapter(pc);
        setChapterOpen(Object.fromEntries(Object.keys(pc).map((k) => [k, true])));
        setAudSections(t.live?.sections || []);
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
        if (!id && !keepDuration.current) setDuration(res.data.minutes);
        keepDuration.current = false;
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

  // Save every change to a new test (not when editing one that already exists)
  useEffect(() => {
    if (id || !rows.length) return;
    const data = { examId, title, titleTouched, date, time, openFor, endTouched, customEnd, duration, otherDate, otherTime, otherLength, split, rows, autoClass, autoMix, autoFormats, autoFormatCounts, perChapter, chapterOpen, college, audSections };
    try {
      localStorage.setItem(liveDraftKey(user), JSON.stringify({ ...data, savedAt: Date.now() }));
    } catch {
      /* storage full or blocked */
    }
  }, [id, user, examId, title, titleTouched, date, time, openFor, endTouched, customEnd, duration, otherDate, otherTime, otherLength, split, rows, autoClass, autoMix, autoFormats, autoFormatCounts, perChapter, chapterOpen, college, audSections]);
  const startOver = () => {
    try {
      localStorage.removeItem(liveDraftKey(user));
    } catch {
      /* ignore */
    }
    window.location.reload();
  };

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

  // Until the end is changed by hand, it stays 24 hours after the start
  useEffect(() => {
    if (endTouched || !startsAt || Number.isNaN(startsAt.getTime())) return;
    setCustomEnd(toLocalInput(new Date(startsAt.getTime() + 24 * 3600e3)));
  }, [startsAt, endTouched]);

  const setRow = (key, patch) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const chapterSum = (key) => Object.values(perChapter[key] || {}).reduce((a, c) => a + (Number(c) || 0), 0);
  const anyAuto = rows.some((r) => r.include && r.picker === "auto");
  // the smallest auto subject: type counts apply to every subject
  const smallestAuto = Math.min(...rows.filter((r) => r.include && r.picker === "auto").map((r) => (chapterSum(r.key) > 0 ? chapterSum(r.key) : Number(r.mcqCount) || 0)), 9999);
  const mixTotal = (Number(autoMix.easy) || 0) + (Number(autoMix.medium) || 0) + (Number(autoMix.hard) || 0);
  const subjectKeyOf = (key) => [...(pattern?.sections || []), ...(pattern?.splitSections || [])].find((d) => d.key === key)?.subjectKey || key;
  const chaptersOf = (key) => (pattern?.chapters?.[subjectKeyOf(key)] || []).filter((c) => autoClass === "both" || String(c.classLevel) === autoClass);
  const setChapterCount = (key, chapterId, value) => {
    const next = { ...(perChapter[key] || {}), [chapterId]: value };
    setPerChapter((p) => ({ ...p, [key]: next }));
    const sum = Object.values(next).reduce((a, c) => a + (Number(c) || 0), 0);
    if (sum > 0) setRow(key, { mcqCount: sum });
  };
  const included = rows.filter((r) => r.include);
  const totalQs = included.reduce((a, r) => a + (r.picker === "auto" && chapterSum(r.key) > 0 ? chapterSum(r.key) : Number(r.mcqCount || 0)) + Number(r.numericalCount || 0), 0);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!included.length) return setError("Include at least one subject");
    if (included.some((r) => r.picker === "lecturer" && !r.lecturerId)) return setError("Choose a lecturer for each subject marked 'Lecturer'");
    if (!startsAt || !endsAt) return setError("Choose when the test opens and closes");
    if (anyAuto && typedTotal(autoFormats, autoFormatCounts) > smallestAuto) return setError(`The question types add up to ${typedTotal(autoFormats, autoFormatCounts)}, more than the ${smallestAuto} questions in a subject.`);
    if (anyAuto && mixTotal && mixTotal !== 100) return setError(`Difficulty adds up to ${mixTotal}%. Easy + medium + hard must be 100%.`);
    if (endsAt <= startsAt) return setError("The test must close after it opens");
    setSaving(true);
    const body = {
      examId,
      title,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      durationMinutes: Number(duration),
      splitBiology: split,
      showResults: "after_submit",
      shuffle: true,
      auto: {
        classLevel: autoClass,
        mix: mixTotal ? { easy: Number(autoMix.easy) || 0, medium: Number(autoMix.medium) || 0, hard: Number(autoMix.hard) || 0 } : null,
        formats: autoFormats,
        formatCounts: cleanCounts(autoFormats, autoFormatCounts),
        perChapter: Object.entries(perChapter).flatMap(([sectionKey, m]) =>
          included.some((r) => r.key === sectionKey && r.picker === "auto") ? Object.entries(m).filter(([, c]) => Number(c) > 0).map(([chapterId, c]) => ({ sectionKey, chapterId, count: Number(c) })) : []
        ),
      },
      college,
      audienceSections: college ? audSections : [],
      sections: included.map((r) => ({
        key: r.key,
        picker: r.picker,
        lecturerId: r.picker === "lecturer" ? r.lecturerId : undefined,
        mcqCount: r.picker === "auto" && chapterSum(r.key) > 0 ? chapterSum(r.key) : Number(r.mcqCount),
        numericalCount: Number(r.numericalCount),
      })),
    };
    try {
      const res = id ? await api.put(`/admin/live-tests/${id}`, body) : await api.post("/admin/live-tests", body);
      (res.data.notes || []).forEach((n) => toast(n, "error"));
      if (!id) {
        try {
          localStorage.removeItem(liveDraftKey(user)); // made: the unfinished copy is no longer needed
        } catch {
          /* ignore */
        }
      }
      toast(res.data.status === "published" ? "Saved. The test is published." : "Saved. When every subject is ready, open the test and press Publish.");
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
      <BackLink to={id ? `/admin/live-tests/${id}` : "/admin/live-tests"}>{id ? "Back to the test" : "All live tests"}</BackLink>
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
        <section className="gp-card space-y-5 p-6">
          <Step n={2} title="Date and time" />

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

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <span className={LABEL}>Starts</span>
              <div className="grid grid-cols-2 gap-2">
                <input type="date" aria-label="Start date" className={input} value={date} onChange={(e) => setDate(e.target.value)} required />
                <input type="time" aria-label="Start time" className={input} value={time} onChange={(e) => setTime(e.target.value)} required />
              </div>
            </div>
            <div>
              <span className={LABEL}>Ends</span>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  aria-label="End date"
                  className={input}
                  value={customEnd.slice(0, 10)}
                  onChange={(e) => {
                    setEndTouched(true);
                    setCustomEnd(`${e.target.value}T${customEnd.slice(11, 16) || "23:59"}`);
                  }}
                  required
                />
                <input
                  type="time"
                  aria-label="End time"
                  className={input}
                  value={customEnd.slice(11, 16)}
                  onChange={(e) => {
                    setEndTouched(true);
                    setCustomEnd(`${customEnd.slice(0, 10) || date}T${e.target.value}`);
                  }}
                  required
                />
              </div>
            </div>
          </div>

          <label className="block max-w-xs">
            <span className={LABEL}>Exam duration (minutes)</span>
            <input type="number" min={5} max={600} className={input} value={duration} onChange={(e) => setDuration(e.target.value)} required />
            {pattern?.minutes && <span className="mt-1 block text-xs text-slate-500">Real {exam?.code} exam: {pattern.minutes} minutes</span>}
          </label>

          {startsAt && endsAt && endsAt <= startsAt && (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">The end time must be after the start time.</p>
          )}
        </section>

        {/* 2. Questions */}
        {pattern && (
          <section className="gp-card space-y-4 p-6">
            <Step n={3} title="Who sets the questions?" right={<span className="gp-chip">{totalQs} questions</span>} />
            <div className="grid grid-cols-3 gap-3">
              {[
                ["me", "Myself"],
                ["lecturer", "Lecturer"],
                ["auto", "Auto"],
              ].map(([v, l]) => {
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
                    className={`rounded-2xl border px-4 py-4 text-center text-base font-bold transition ${all ? "border-[#17140f] bg-[#17140f] text-[#e5c372] shadow-lg shadow-black/10" : "border-[#e7dcc3] bg-white text-slate-800 hover:border-[#c9a24a]"}`}
                  >
                    {l}
                  </button>
                );
              })}
            </div>
            {pattern.canSplitBiology && (
              <label className="flex items-center gap-3 text-sm text-slate-800">
                <input type="checkbox" className="h-4 w-4 accent-amber-600" checked={split} onChange={(e) => setSplit(e.target.checked)} />
                Split Biology into Botany and Zoology
              </label>
            )}
            {anyAuto && (
              <div className="space-y-4 rounded-2xl border border-[#e7dcc3] bg-[#fffdf8] p-4">
                <p className="text-sm font-bold text-slate-900">Auto-pick settings</p>
                <div>
                  <p className="gp-label">Class</p>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {[["11", "1st PUC"], ["12", "2nd PUC"], ["both", "Both"]].map(([v, l]) => (
                      <button key={v} type="button" aria-pressed={autoClass === v} className="gp-tile px-4 py-2 text-sm font-semibold text-slate-800" onClick={() => setAutoClass(v)}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="gp-label">Difficulty (%)</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-3">
                    {[["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"]].map(([k, l]) => (
                      <label key={k} className="flex items-center gap-2 text-sm text-slate-700">
                        {l}
                        <input type="number" min={0} max={100} placeholder="%" className="w-20 rounded-lg border border-[#e7dcc3] bg-white px-2 py-1.5 text-center" value={autoMix[k]} onChange={(e) => setAutoMix({ ...autoMix, [k]: e.target.value })} />
                      </label>
                    ))}
                    <span className={`text-sm font-semibold ${!mixTotal ? "text-slate-500" : mixTotal === 100 ? "text-emerald-700" : "text-rose-700"}`}>
                      {!mixTotal ? "Empty = any difficulty" : mixTotal === 100 ? "Total 100% ✓" : `Total ${mixTotal}% — must be 100%`}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="gp-label">Types of questions (in each subject)</p>
                  <div className="mt-1.5">
                    <QuestionTypeCounts
                      options={(pattern?.formats || []).filter((f) => f !== "numerical")}
                      chosen={autoFormats}
                      onChosen={setAutoFormats}
                      counts={autoFormatCounts}
                      onCounts={setAutoFormatCounts}
                      total={smallestAuto < 9999 ? smallestAuto : 0}
                      per=" in a subject"
                    />
                  </div>
                </div>
              </div>
            )}
            <div className="space-y-3">
              {rows.map((r) => (
                <div key={r.key} className={`rounded-2xl border p-4 transition ${r.include ? "border-slate-200 bg-white" : "border-dashed border-slate-200 opacity-60"}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="flex items-center gap-2 font-semibold text-slate-900">
                      <input type="checkbox" className="h-4 w-4 accent-amber-600" checked={r.include} onChange={(e) => setRow(r.key, { include: e.target.checked })} />
                      {r.name}
                      <span className="text-sm font-normal text-slate-500">
                        · {r.picker === "auto" && chapterSum(r.key) > 0 ? chapterSum(r.key) : r.mcqCount} MCQ{Number(r.numericalCount) ? ` + ${r.numericalCount} numerical` : ""}
                      </span>
                    </label>
                    {r.include && !included.every((x) => x.picker === r.picker) && (
                      <span className="text-xs font-semibold text-slate-500">{r.picker === "me" ? "Myself" : r.picker === "lecturer" ? "Lecturer" : "Auto"}</span>
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
                      or choose Myself / Auto.
                    </p>
                  )}
                  {r.include && (() => {
                    const pcSum = Object.values(perChapter[r.key] || {}).reduce((a, c) => a + (Number(c) || 0), 0);
                    const byChapter = r.picker === "auto" && pcSum > 0;
                    return (
                      <>
                        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                          <label className="flex items-center gap-2 text-slate-700">
                            Number of questions
                            <input type="number" min={0} max={200} className={`${input} w-24`} value={byChapter ? pcSum : r.mcqCount} disabled={byChapter} onChange={(e) => setRow(r.key, { mcqCount: e.target.value })} />
                          </label>
                          {(Number(r.numericalCount) > 0 || exam?.code === "JEE") && (
                            <label className="flex items-center gap-2 text-slate-700">
                              Numerical
                              <input type="number" min={0} max={50} className={`${input} w-24`} value={r.numericalCount} onChange={(e) => setRow(r.key, { numericalCount: e.target.value })} />
                            </label>
                          )}
                          {r.picker === "auto" && (
                            <button type="button" onClick={() => setChapterOpen((o) => ({ ...o, [r.key]: !o[r.key] }))} className="font-semibold text-amber-800 hover:underline">
                              {chapterOpen[r.key] ? "Hide chapters" : "Questions per chapter"}
                            </button>
                          )}
                        </div>
                        {r.picker === "auto" && chapterOpen[r.key] && (
                          <div className="mt-3 rounded-xl border border-[#efe6d2] bg-[#fffdf8] p-3">
                            <p className="mb-2 text-xs text-slate-500">Type how many questions from each chapter. Leave at 0 to skip it. {byChapter ? `Total: ${pcSum}` : "Leave all empty to use every chapter."}</p>
                            <div className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
                              {chaptersOf(r.key).map((c) => (
                                <label key={c._id} className="flex items-center justify-between gap-3 text-sm text-slate-800">
                                  <span className="min-w-0 truncate">{c.name}</span>
                                  <input type="number" min={0} max={100} placeholder="0" className="w-16 rounded-lg border border-[#e7dcc3] bg-white px-2 py-1 text-center" value={perChapter[r.key]?.[c._id] ?? ""} onChange={(e) => setChapterCount(r.key, c._id, e.target.value)} />
                                </label>
                              ))}
                              {!chaptersOf(r.key).length && <p className="text-sm text-slate-500">No chapters for this class.</p>}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 5. Who */}
        <section className="gp-card space-y-4 p-6">
          <Step n={4} title="Who can write it?" hint="Students only see tests meant for their college and section" />
          <div className="flex flex-wrap gap-2">
            {[["", "All students"], ...[...new Set(["MBPU", ...(pattern?.colleges || []), ...(college ? [college] : [])])].map((c) => [c, c])].map(([v, l]) => (
              <button
                key={v || "all"}
                type="button"
                aria-pressed={college === v}
                className="gp-tile px-4 py-2 text-sm font-semibold text-slate-800"
                onClick={() => {
                  setCollege(v);
                  if (!v) setAudSections([]);
                }}
              >
                {l}
              </button>
            ))}
          </div>
          {college && (
            <div>
              <p className="gp-label">Sections</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" aria-pressed={!audSections.length} className="gp-tile px-4 py-2 text-sm font-semibold text-slate-800" onClick={() => setAudSections([])}>
                  All sections
                </button>
                {["A", "B", "C", "D"].map((x) => {
                  const on = audSections.includes(x);
                  return (
                    <button
                      key={x}
                      type="button"
                      aria-pressed={on}
                      className="gp-tile h-10 w-12 text-sm font-bold text-slate-800"
                      onClick={() => setAudSections(on ? audSections.filter((y) => y !== x) : [...audSections, x].sort())}
                    >
                      {x}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {audSections.length ? `Only ${college} section ${audSections.join(", ")} students will see this test.` : `Every ${college} student will see this test.`}
              </p>
            </div>
          )}
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
                  ["Students", college ? `${college} · ${audSections.length ? `Sec ${audSections.join(", ")}` : "All sections"}` : "All students"],
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
              <p className="mt-2 text-center text-xs text-amber-100/60">When every subject is ready, press Publish. Students only see it after that.</p>
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

// Students have already started the test: rename it or move its closing time (as often as needed)
function OpenTestEdit({ test }) {
  const navigate = useNavigate();
  const [title, setTitle] = useState(test.title);
  const [end, setEnd] = useState(toLocalInput(test.endsAt));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const oldEnd = new Date(test.endsAt);
  const newEnd = end ? new Date(end) : null;
  const addHours = (h) => setEnd(toLocalInput(new Date(Math.max(Date.now(), (newEnd || oldEnd).getTime()) + h * 3600e3)));

  const save = async (e) => {
    e.preventDefault();
    setError("");
    if (!newEnd) return setError("Choose the closing time");
    if (newEnd.getTime() !== oldEnd.getTime() && newEnd <= new Date()) return setError("Choose a closing time in the future");
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
      <BackLink to={`/admin/live-tests/${test._id}`}>Back to the test</BackLink>
      <div className="mt-3">
        <Hero eyebrow="Edit live test" title={test.title} subtitle="Students have already started this test, so its start time, length and questions are fixed. You can rename it and change the closing time as many times as you need." />
      </div>
      <form onSubmit={save} className="gp-card mt-6 max-w-2xl space-y-6 p-6">
        <label className="block">
          <span className={LABEL}>Test name</span>
          <input className={input} value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} maxLength={140} />
        </label>
        <div>
          <span className={LABEL}>Closes</span>
          <div className="flex flex-wrap items-center gap-2">
            <input type="datetime-local" aria-label="Closing time" className={`${input} max-w-xs`} value={end} onChange={(e) => setEnd(e.target.value)} />
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
