import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useReportPrinter } from "./ReportPrinter";
import { Link } from "react-router-dom";
import api, { getErrorMessage } from "../api/axios";
import { fmtDateTime } from "./liveHelpers";
import { RankList } from "./AdminTestResult";
import Loading from "./Loading";

const EXAMS = ["NEET", "JEE", "KCET"];
const pctOf = (r) => (r.maxScore ? Math.round((r.score / r.maxScore) * 100) : 0);
const audience = (a) => `${a.college}${a.sections?.length ? ` · Sec ${a.sections.join(", ")}` : " · All sections"}`;

function Back({ onClick, children }) {
  return (
    <button type="button" onClick={onClick} className="group mb-4 inline-flex items-center gap-2.5 text-sm font-medium text-slate-600 hover:text-slate-900 print:hidden">
      <span className="grid h-8 w-8 place-items-center rounded-full bg-white shadow-sm ring-1 ring-[#e7dcc3] transition group-hover:bg-[#17140f] group-hover:text-[#e5c372]">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </span>
      {children}
    </button>
  );
}

// Admin → Results → Assignments: exam → assignments → one assignment's ranks
export default function AdminAssignmentResults({ onDetail }) {
  const [list, setList] = useState(null);
  const [error, setError] = useState("");
  const [exam, setExam] = useState("NEET");
  const [subject, setSubject] = useState("");
  const [lecturer, setLecturer] = useState("");
  const [openId, setOpenId] = useState(null);
  useEffect(() => onDetail?.(Boolean(openId)), [openId, onDetail]);

  useEffect(() => {
    api
      .get("/lecturer/assignments", { params: { stats: "1", published: "1" } })
      .then((res) => {
        setList(res.data.assignments);
        const first = EXAMS.find((e) => res.data.assignments.some((a) => a.exam === e));
        if (first) setExam(first);
      })
      .catch((err) => setError(getErrorMessage(err)));
  }, []);

  const ofExam = (list || []).filter((a) => a.exam === exam);
  const shown = ofExam.filter((a) => (!subject || a.subject === subject) && (!lecturer || a.createdBy === lecturer));
  const totals = useMemo(() => {
    const students = shown.reduce((n, a) => n + (a.students || 0), 0);
    const done = shown.reduce((n, a) => n + a.submitted, 0);
    const withAvg = shown.filter((a) => a.avgPct != null);
    const avg = withAvg.length ? Math.round(withAvg.reduce((n, a) => n + a.avgPct * a.submitted, 0) / Math.max(1, withAvg.reduce((n, a) => n + a.submitted, 0))) : null;
    return { students, done, avg, missing: Math.max(0, students - done) };
  }, [shown]);

  if (openId) return <AssignmentResult id={openId} onBack={() => setOpenId(null)} backLabel={`${exam} assignments`} />;

  return (
    <div>
      {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {!list && !error && <Loading />}
      {list && (
        <>
          <div className="grid grid-cols-3 gap-3">
            {EXAMS.map((code) => {
              const n = list.filter((a) => a.exam === code).length;
              const on = code === exam;
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => {
                    setExam(code);
                    setSubject("");
                    setLecturer("");
                  }}
                  className={`rounded-2xl px-5 py-4 text-left transition ${on ? "bg-[#17140f] text-white shadow-lg" : "bg-white ring-1 ring-[#e7dcc3] hover:ring-[#c9a24a]"}`}
                >
                  <p className={`font-display text-2xl font-extrabold ${on ? "text-[#e5c372]" : "text-slate-900"}`}>{code}</p>
                  <p className={`text-sm ${on ? "text-white/70" : "text-slate-500"}`}>
                    {n} assignment{n === 1 ? "" : "s"}
                  </p>
                </button>
              );
            })}
          </div>

          {ofExam.length > 0 && (
            <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
              {[
                ["Assignments", shown.length, `given in ${exam}`],
                ["Handed in", totals.done, `of ${totals.students} students`],
                ["Average", totals.avg == null ? "—" : `${totals.avg}%`, "of the marks"],
                ["Not handed in", totals.missing, "students"],
              ].map(([l, v, s]) => (
                <div key={l} className="gp-card p-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{l}</p>
                  <p className="mt-1 font-display text-3xl font-extrabold tabular-nums text-slate-900">{v}</p>
                  <p className="text-xs text-slate-500">{s}</p>
                </div>
              ))}
            </div>
          )}

          <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">{exam} assignments</h2>
            {ofExam.length > 0 && (
              <div className="flex gap-2">
                <select value={subject} onChange={(e) => setSubject(e.target.value)} className="rounded-xl border border-[#e7dcc3] bg-white px-3 py-2 text-sm" aria-label="Subject">
                  <option value="">All subjects</option>
                  {[...new Set(ofExam.map((a) => a.subject))].map((s) => <option key={s}>{s}</option>)}
                </select>
                <select value={lecturer} onChange={(e) => setLecturer(e.target.value)} className="rounded-xl border border-[#e7dcc3] bg-white px-3 py-2 text-sm" aria-label="Lecturer">
                  <option value="">All lecturers</option>
                  {[...new Set(ofExam.map((a) => a.createdBy).filter(Boolean))].map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
            )}
          </div>

          {!shown.length ? (
            <p className="mt-3 rounded-2xl bg-white px-6 py-10 text-center text-sm text-slate-500 ring-1 ring-[#e7dcc3]">No published {exam} assignments{subject || lecturer ? " match these filters" : " yet"}.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {shown.map((a, i) => {
                const open = new Date(a.dueAt) > new Date();
                const pct = a.students ? Math.round((a.submitted / a.students) * 100) : 0;
                return (
                  <button key={a._id} type="button" onClick={() => setOpenId(a._id)} className="gp-card gp-card-hover group flex w-full flex-wrap items-center gap-5 p-5 text-left">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#17140f] font-display font-bold text-[#e5c372]">{shown.length - i}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="gp-chip">{a.subject}</span>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${open ? "bg-amber-50 text-amber-800 ring-amber-200" : "bg-slate-100 text-slate-600 ring-slate-200"}`}>{open ? "Open" : "Closed"}</span>
                      </span>
                      <span className="mt-1 block truncate text-lg font-bold text-slate-900">{a.title}</span>
                      <span className="block text-sm text-slate-500">
                        {a.createdBy || "Lecturer"} · {audience(a)} · {a.questions} questions · due {fmtDateTime(a.dueAt)}
                      </span>
                    </span>
                    <span className="w-44 shrink-0">
                      <span className="flex justify-between text-xs">
                        <span className="text-slate-500">Handed in</span>
                        <b className="text-slate-900">
                          {a.submitted}/{a.students ?? "?"}
                        </b>
                      </span>
                      <span className="mt-1 block h-2 overflow-hidden rounded-full bg-[#f3ecdc]">
                        <span className="block h-full rounded-full bg-gradient-to-r from-[#e5c372] to-[#b8862b]" style={{ width: `${pct}%` }} />
                      </span>
                    </span>
                    <span className="w-20 shrink-0 text-right">
                      <span className="block font-display text-2xl font-extrabold text-slate-900">{a.avgPct == null ? "—" : `${a.avgPct}%`}</span>
                      <span className="block text-xs text-slate-500">average</span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold text-[#b8862b]">View →</span>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const ARIAL = { fontFamily: "Arial, Helvetica, sans-serif" };

// Printed merit list of one assignment (overall or one section)
function MeritSheet({ a, title, rows }) {
  const max = rows[0]?.maxScore ?? "—";
  return (
    <div className="gp-sheet bg-white p-10" style={ARIAL}>
      <h1 className="text-[22px] font-bold uppercase text-[#0f172a]" style={ARIAL}>
        GenPrep · {a.title}
      </h1>
      <p className="mt-1 text-[13px] text-slate-600">
        {a.exam} · {a.subject} · {title} · Merit list | {rows.length} student{rows.length === 1 ? "" : "s"} | Maximum: {max} | Due {fmtDateTime(a.dueAt)}
      </p>
      {!rows.length ? (
        <p className="py-14 text-center text-sm text-slate-500">No one has handed it in yet.</p>
      ) : (
        <table className="mt-5 w-full border-collapse text-[13px]" style={ARIAL}>
          <thead>
            <tr className="bg-[#0f172a] text-[12px] font-bold uppercase text-white">
              {["Rank", "Student name", "Sec", "Correct", "Wrong", "Skipped", "Marks", "%"].map((h) => (
                <th key={h} className={`border-r border-[#334155] px-2 py-2.5 ${h === "Student name" ? "text-left" : "text-center"}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.student._id} className={i % 2 ? "bg-[#f1f5f9]" : "bg-white"}>
                <td className="border border-slate-200 px-2 py-2 text-center font-bold">{i + 1}</td>
                <td className="border border-slate-200 px-3 py-2">
                  {r.student.name}
                  <span className="block text-[11px] text-slate-500">{r.student.email}</span>
                </td>
                <td className="border border-slate-200 px-2 py-2 text-center">{r.student.section || "—"}</td>
                <td className="border border-slate-200 px-2 py-2 text-center">{r.correct}</td>
                <td className="border border-slate-200 px-2 py-2 text-center">{r.incorrect}</td>
                <td className="border border-slate-200 px-2 py-2 text-center">{r.unanswered}</td>
                <td className="border border-slate-200 px-2 py-2 text-center font-bold">
                  {r.score} / {r.maxScore}
                </td>
                <td className="border border-slate-200 px-2 py-2 text-center">{pctOf(r)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// Prints one merit sheet (Save as PDF), then removes it
function usePrintSheet() {
  const [sheet, setSheet] = useState(null);
  useEffect(() => {
    if (!sheet) return;
    const oldTitle = document.title;
    document.title = sheet.fileName.replace(/[^\w-]+/g, "_");
    document.body.classList.add("gp-printing-batch");
    const done = () => {
      document.body.classList.remove("gp-printing-batch");
      document.title = oldTitle;
      window.removeEventListener("afterprint", done);
      setSheet(null);
    };
    window.addEventListener("afterprint", done);
    const t = setTimeout(() => window.print(), 150);
    return () => clearTimeout(t);
  }, [sheet]);
  const node = sheet ? createPortal(<div className="gp-print-batch">{sheet.content}</div>, document.body) : null;
  return { print: (content, fileName) => setSheet({ content, fileName }), node };
}

// One assignment: attendance, marks, ranks
function AssignmentResult({ id, onBack, backLabel }) {
  const [a, setA] = useState(null);
  const [sub, setSub] = useState(null);
  const [error, setError] = useState("");
  const [view, setView] = useState("all");
  const [showMissing, setShowMissing] = useState(false);
  const [menu, setMenu] = useState(false);
  const sheet = usePrintSheet();
  const printer = useReportPrinter();

  useEffect(() => {
    Promise.all([api.get(`/lecturer/assignments/${id}`), api.get(`/lecturer/assignments/${id}/submissions`)])
      .then(([one, s]) => {
        setA(one.data.assignment);
        setSub(s.data);
      })
      .catch((err) => setError(getErrorMessage(err)));
  }, [id]);

  if (error) return <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>;
  if (!a || !sub) return <Loading />;

  // Sections it was given to (none listed = every section of the college)
  const sections = (a.sections?.length ? a.sections : [...new Set(sub.rows.map((r) => r.student.section).filter(Boolean))]).slice().sort();
  const oneSection = sections.length === 1 ? sections[0] : null;
  const scope = oneSection || view; // "all" or a section letter
  const inScope = (r) => scope === "all" || r.student.section === scope;

  // Same shape as live-test rows, so the rank list looks the same
  const asRow = (r) => ({ ...r, incorrect: r.wrong ?? 0, unanswered: r.skipped ?? 0, correct: r.correct ?? 0 });
  const byRank = (x, y) => y.score - x.score || (x.timeTakenSec || 0) - (y.timeTakenSec || 0);
  const doneAll = sub.rows.filter((r) => r.status === "submitted");
  const done = doneAll.filter(inScope).sort(byRank).map(asRow);
  const missing = sub.rows.filter((r) => r.status !== "submitted" && inScope(r));
  const statsOf = (sec) => {
    const list = sub.rows.filter((r) => sec === "all" || r.student.section === sec);
    const fin = list.filter((r) => r.status === "submitted");
    const avg = fin.length ? Math.round(fin.reduce((n, r) => n + pctOf(r), 0) / fin.length) : null;
    return { total: list.length, done: fin.length, avg };
  };
  const scopeName = scope === "all" ? (a.sections?.length ? `Sections ${sections.join(" and ")}` : "All sections") : `Section ${scope}`;
  const best = done[0];
  const worst = done[done.length - 1];
  const max = done[0]?.maxScore || 0;
  const avg = done.length ? done.reduce((n, r) => n + r.score, 0) / done.length : null;
  const open = new Date(a.dueAt) > new Date();
  const buttons = oneSection ? [] : [["all", a.sections?.length ? (sections.length === 2 ? `Both (${sections.join(" + ")})` : "All of them") : "All sections"], ...sections.map((x) => [x, `Section ${x}`])];
  const st = statsOf(scope);
  const rowsFor = (sec) => doneAll.filter((r) => sec === "all" || r.student.section === sec).sort(byRank).map(asRow);
  const nameFor = (sec) => (sec === "all" ? (a.sections?.length ? `Sections ${sections.join(" and ")}` : "All sections") : `Section ${sec}`);
  const printMerit = (sec) => {
    setMenu(false);
    sheet.print(<MeritSheet a={a} title={nameFor(sec)} rows={rowsFor(sec)} />, `${a.title}_${nameFor(sec)}_merit_list`);
  };
  const printStudents = (sec) => {
    setMenu(false);
    const ids = rowsFor(sec).map((r) => r.attemptId).filter(Boolean);
    printer.printReports(ids, "all", `${a.title}_${nameFor(sec)}_student_reports`);
  };

  return (
    <div>
      {sheet.node}
      {printer.node}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Back onClick={onBack}>{backLabel}</Back>
          <div className="relative print:hidden">
          <button type="button" onClick={() => setMenu((m) => !m)} disabled={Boolean(printer.busy)} className="gp-gold-btn inline-flex items-center gap-2 px-5 py-2.5 text-sm disabled:opacity-60">
            ⤓ {printer.busy ? `Preparing ${printer.progress}…` : "Download report"} <span className="text-xs">▾</span>
          </button>
          {menu && (
            <div className="absolute right-0 z-20 mt-2 w-72 overflow-hidden rounded-2xl bg-white text-sm shadow-xl ring-1 ring-[#e7dcc3]">
              <p className="bg-[#faf6ec] px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-slate-500">Merit list (ranks)</p>
              {(oneSection ? [oneSection] : ["all", ...sections]).map((sec) => (
                <button key={sec} type="button" onClick={() => printMerit(sec)} className="block w-full px-4 py-2.5 text-left font-semibold text-slate-800 hover:bg-[#fbf5e6]">
                  {sec === "all" ? "Overall report" : `${nameFor(sec)} report`}
                  <span className="block text-xs font-normal text-slate-500">{rowsFor(sec).length} students{sec === "all" && !oneSection ? " · every section together" : ""}</span>
                </button>
              ))}
              <p className="border-t border-[#f1e9d7] bg-[#faf6ec] px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-slate-500">Student reports</p>
              <button type="button" onClick={() => printStudents(scope)} disabled={!rowsFor(scope).length} className="block w-full px-4 py-2.5 text-left font-semibold text-slate-800 hover:bg-[#fbf5e6] disabled:opacity-50">
                Every student of {scopeName}
                <span className="block text-xs font-normal text-slate-500">one scorecard page each · {rowsFor(scope).length} students</span>
              </button>
              <p className="border-t border-[#f1e9d7] px-4 py-2 text-xs text-slate-500">For one student: open their row below and click “Download report”.</p>
            </div>
          )}
        </div>
      </div>

      <section className="gp-hero p-6 md:p-7">
        <div className="relative flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-bold text-amber-100 ring-1 ring-amber-200/30">{a.exam}</span>
              <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-bold text-amber-100 ring-1 ring-amber-200/30">{a.subject}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${open ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-600"}`}>{open ? "Open" : "Closed"}</span>
            </div>
            <h1 className="mt-3 text-2xl font-extrabold text-white md:text-3xl">{a.title}</h1>
            <p className="gp-muted mt-1 text-sm">
              {a.createdBy || "Lecturer"} · {audience(a)} · {a.questions} questions · due {fmtDateTime(a.dueAt)}
            </p>
          </div>

        </div>
        <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Students", st.total],
            ["Handed in", st.done],
            ["Started", missing.filter((r) => r.status === "in_progress").length],
            ["Not started", missing.filter((r) => r.status === "not_started").length],
          ].map(([l, v]) => (
            <div key={l} className="rounded-2xl bg-white/5 p-3 ring-1 ring-amber-200/20">
              <p className="text-[11px] font-bold uppercase tracking-widest text-amber-200/70">{l}</p>
              <p className="font-display text-2xl font-extrabold text-white">{v}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Section buttons: only the sections it was given to */}
      {buttons.length > 0 && (
        <div className="mt-5 print:hidden">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Choose a section</p>
          <div className="mt-2 grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(buttons.length, 5)}, minmax(0, 1fr))` }}>
            {buttons.map(([k, label]) => {
              const on = k === view;
              const s2 = statsOf(k);
              return (
                <button key={k} type="button" onClick={() => setView(k)} className={`rounded-2xl p-4 text-left transition ${on ? "bg-[#17140f] text-white shadow-lg" : "bg-white ring-1 ring-[#e7dcc3] hover:ring-[#c9a24a]"}`}>
                  <p className={`font-display text-xl font-extrabold ${on ? "text-[#e5c372]" : "text-slate-900"}`}>{label}</p>
                  <p className={`mt-1 text-xs ${on ? "text-white/70" : "text-slate-500"}`}>
                    {s2.done}/{s2.total} handed in{s2.avg != null ? ` · avg ${s2.avg}%` : ""}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {done.length > 0 && (
        <div className="mt-5 grid grid-cols-3 gap-4">
          {[
            ["Average", `${avg.toFixed(1).replace(/\.0$/, "")} / ${max}`, `${Math.round((avg / max) * 100) || 0}%`],
            ["Highest", `${best.score} / ${max}`, best.student.name],
            ["Lowest", `${worst.score} / ${max}`, worst.student.name],
          ].map(([l, v, s3]) => (
            <div key={l} className="gp-card p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{l}</p>
              <p className="mt-1 font-display text-2xl font-extrabold text-slate-900">{v}</p>
              <p className="truncate text-xs text-slate-500">{s3}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-bold text-slate-900">
          {showMissing ? "Not handed in" : "Ranks"}{" "}
          <span className="text-sm font-normal text-slate-500">
            · {scopeName} · {showMissing ? `${missing.length} student${missing.length === 1 ? "" : "s"}` : `${done.length} student${done.length === 1 ? "" : "s"} completed`}
          </span>
        </h3>
        <button type="button" onClick={() => setShowMissing((v) => !v)} className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-slate-700 ring-1 ring-[#e7dcc3] hover:ring-[#c9a24a] print:hidden">
          {showMissing ? "Show ranks" : `Not handed in (${missing.length})`}
        </button>
      </div>

      {showMissing ? (
        <div className="gp-card mt-3 overflow-hidden">
          {!missing.length ? (
            <p className="px-5 py-10 text-center text-sm text-slate-500">Everyone handed it in.</p>
          ) : (
            <ul className="divide-y divide-[#f1e9d7]">
              {missing.map((r) => (
                <li key={r.student._id} className="flex items-center gap-3 px-5 py-3 text-sm">
                  <span className="min-w-0 flex-1">
                    <b className="text-slate-900">{r.student.name}</b> <span className="text-slate-500">· {r.student.email}</span>
                  </span>
                  <span className="text-slate-600">Sec {r.student.section || "—"}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${r.status === "in_progress" ? "bg-indigo-50 text-indigo-700 ring-indigo-200" : "bg-rose-50 text-rose-700 ring-rose-200"}`}>
                    {r.status === "in_progress" ? "Started" : "Not started"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : !done.length ? (
        <p className="mt-3 rounded-2xl bg-white px-6 py-10 text-center text-sm text-slate-500 ring-1 ring-[#e7dcc3]">No one has handed it in{scope !== "all" ? ` in section ${scope}` : ""} yet.</p>
      ) : (
        <RankList rows={done} />
      )}
    </div>
  );
}
