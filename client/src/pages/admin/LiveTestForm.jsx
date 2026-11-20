import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api, { getErrorMessage } from "../../api/axios";
import AdminLayout from "../../components/AdminLayout";
import { toast } from "../../components/Toaster";
import { fmtDateTime, fmtDuration, toLocalInput } from "../../components/liveHelpers";
import { Hero, Step } from "../../components/premium";

// Head lecturer: create a live test (or edit one before it opens) in one short form.
const input = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-amber-500 focus:outline-none";

const OPEN_FOR = [
  ["3h", "3 hours"],
  ["midnight", "Until midnight"],
  ["24h", "24 hours"],
  ["2d", "2 days"],
  ["custom", "Pick a time"],
];
const PICKERS = [
  ["auto", "Auto", "GenPrep picks the questions for you"],
  ["me", "Me", "You pick the questions yourself"],
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
const TIMES = ["06:00", "08:00", "10:00", "14:00", "17:00", "18:00", "19:00", "20:00", "20:30", "21:00"];
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
          navigate(`/admin/live-tests/${id}`, { replace: true });
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
      toast(res.data.status === "published" ? "All set. The test opens by itself at the start time." : "Saved. The test opens once every subject has its questions.");
      navigate(`/admin/live-tests/${id || res.data.testId}`);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

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
        {/* 1. When */}
        <section className="gp-card space-y-5 p-6">
          <Step n={1} title="Exam and time" hint="When students can write it" />
          <div className="flex flex-wrap gap-2">
            {exams.map((e) => (
              <button
                key={e._id}
                type="button"
                disabled={Boolean(id)}
                aria-pressed={examId === e._id} className="gp-tile px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-50"
                onClick={() => {
                  setRows([]);
                  setSplit(false);
                  setExamId(e._id);
                }}
              >
                {e.code}
              </button>
            ))}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-700">Which day?</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {DAYS.map(([o, l]) => (
                <button
                  key={o}
                  type="button"
                  aria-pressed={!otherDate && date === dayString(o)} className="gp-tile px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-50"
                  onClick={() => {
                    setOtherDate(false);
                    setDate(dayString(o));
                  }}
                >
                  {l} <span className="ml-1 text-xs font-normal opacity-70">{dayLabel(dayString(o))}</span>
                </button>
              ))}
              <button type="button" aria-pressed={otherDate} className="gp-tile px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-50" onClick={() => setOtherDate(true)}>
                Another day
              </button>
            </div>
            {otherDate && <input type="date" aria-label="Date" min={today()} className={`${input} mt-2 max-w-xs`} value={date} onChange={(e) => setDate(e.target.value)} required />}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-700">Start time</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {TIMES.map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={!otherTime && time === t} className="gp-tile px-3 text-sm font-semibold text-slate-800 disabled:opacity-50"
                  onClick={() => {
                    setOtherTime(false);
                    setTime(t);
                  }}
                >
                  {timeLabel(t)}
                </button>
              ))}
              <button type="button" aria-pressed={otherTime} className="gp-tile px-3 text-sm font-semibold text-slate-800 disabled:opacity-50" onClick={() => setOtherTime(true)}>
                Other
              </button>
            </div>
            {otherTime && <input type="time" aria-label="Start time" className={`${input} mt-2 max-w-[10rem]`} value={time} onChange={(e) => setTime(e.target.value)} required />}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-700">Students can start it for</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {OPEN_FOR.map(([v, l]) => (
                <button key={v} type="button" aria-pressed={openFor === v} className="gp-tile px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-50" onClick={() => setOpenFor(v)}>
                  {l}
                </button>
              ))}
            </div>
            {openFor === "custom" && (
              <input type="datetime-local" aria-label="Closes" className={`${input} mt-2 max-w-xs`} value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
            )}
            {startsAt && endsAt && endsAt > startsAt && (
              <p className="mt-2 text-sm text-slate-600">
                Open from <b>{fmtDateTime(startsAt)}</b> to <b>{fmtDateTime(endsAt)}</b>. Students start whenever they like in this time.
              </p>
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-700">Test length</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {[...new Set([60, 90, 120, 180, pattern?.minutes].filter(Boolean))]
                .sort((x, y) => x - y)
                .map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={!otherLength && Number(duration) === m} className="gp-tile px-3 text-sm font-semibold text-slate-800 disabled:opacity-50"
                    onClick={() => {
                      setOtherLength(false);
                      setDuration(m);
                    }}
                  >
                    {m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}` : `${m} min`}
                    {m === pattern?.minutes ? <span className="ml-1 text-xs font-normal opacity-70">(real exam)</span> : null}
                  </button>
                ))}
              <button type="button" aria-pressed={otherLength} className="gp-tile px-3 text-sm font-semibold text-slate-800 disabled:opacity-50" onClick={() => setOtherLength(true)}>
                Other
              </button>
            </div>
            {otherLength && (
              <label className="mt-2 flex items-center gap-2 text-sm text-slate-700">
                <input type="number" min={5} max={360} aria-label="Minutes" className={`${input} w-28`} value={duration} onChange={(e) => setDuration(e.target.value)} required />
                minutes
              </label>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Name
              <input
                className={`${input} mt-1`}
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
          </div>
        </section>

        {/* 2. Questions */}
        {pattern && (
          <section className="gp-card space-y-4 p-6">
            <Step n={2} title="Who picks the questions?" hint="Auto fills a subject instantly" right={<span className="gp-chip">{totalQs} questions</span>} />
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
                          <button key={v} type="button" title={hint} aria-pressed={r.picker === v} className="gp-tile px-3 py-1.5 text-sm font-semibold text-slate-800 disabled:opacity-50" onClick={() => setRow(r.key, { picker: v })}>
                            {l}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {r.include && r.picker === "lecturer" && (
                    <select aria-label={`Lecturer for ${r.name}`} className={`${input} mt-3 max-w-xs`} value={r.lecturerId} onChange={(e) => setRow(r.key, { lecturerId: e.target.value })}>
                      <option value="">Choose a lecturer...</option>
                      {lecturers.map((l) => (
                        <option key={l._id} value={l._id}>
                          {l.name}
                        </option>
                      ))}
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
          <Step n={3} title="When do students see their result?" />
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
              <p className="mt-2 text-center text-xs text-amber-100/60">It opens by itself once every subject has its questions.</p>
            </div>
          </div>
        </aside>
      </form>
    </AdminLayout>
  );
}
