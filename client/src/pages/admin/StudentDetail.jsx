import { useEffect, useState } from "react";
import BackLink from "../../components/BackLink";
import { Link, useParams } from "react-router-dom";
import api, { getErrorMessage } from "../../api/axios";
import AdminLayout from "../../components/AdminLayout";
import LiveResultsBrowser from "../../components/LiveResultsBrowser";
import { fmtDateTime, fmtDuration } from "../../components/liveHelpers";
import { useReportPrinter } from "../../components/ReportPrinter";
import Loading from "../../components/Loading";


// Admin view of one student: details plus the same Analytics the student sees
const formatDate = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Never");

export default function StudentDetail() {
    const { id } = useParams();
    const [info, setInfo] = useState(null);
    const [error, setError] = useState("");

    useEffect(() => {
        api
            .get(`/admin/students/${id}`)
            .then((res) => {
                setInfo(res.data);
            })
            .catch((err) => setError(getErrorMessage(err)));
    }, [id]);

    const student = info?.student;

    return (
        <AdminLayout title={student ? student.name : "Student"}>
            <BackLink to="/admin/students">All students</BackLink>

            {error && <div className="mt-4 rounded-lg bg-red-50 text-red-700 text-sm px-4 py-3">{error}</div>}
            {!info && !error && <Loading />}

            {student && (
                <>
                    <div className="mt-4 grid gap-3 sm:grid-cols-4">
                        <Info label="Email" value={student.email} />
                        <Info label="Joined" value={formatDate(student.createdAt)} />
                        <Info label="Last login" value={formatDate(student.lastLoginAt)} />
                        <Info
                            label="Status"
                            value={
                                <span
                                    className={`px-2 py-0.5 rounded-md text-xs font-medium ${student.status === "active" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}
                                >
                                    {student.status}
                                </span>
                            }
                        />
                    </div>

                    {student.college && (
                        <p className="mt-3 text-sm text-slate-600">
                            {student.college}
                            {student.section ? ` · Section ${student.section}` : ""}
                        </p>
                    )}
                    <StudentResults id={id} name={student.name} />

                </>
            )}
        </AdminLayout>
    );
}

function Info({ label, value }) {
    return (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="mt-1 text-sm font-medium text-slate-900 break-all">{value}</p>
        </div>
    );
}

function StudentLive({ id }) {
    const [data, setData] = useState(null);
    useEffect(() => {
        api.get(`/admin/students/${id}/live-results`).then((res) => setData(res.data)).catch(() => setData({ exams: [], tests: [] }));
    }, [id]);
    if (!data) return <Loading />;
    return <LiveResultsBrowser data={data} reportLink={(t) => `/admin/attempts/${t.attemptId}`} empty="No live tests taken for this exam." />;
}

const KINDS = [
    ["live", "Live tests", null],
    ["assignment", "Assignments", ["assignment"]],
    ["practice", "Practice", ["practice", "wrong_answer_practice", "bookmark_practice"]],
    ["mock", "Mock tests", ["mock"]],
];
const DONE = ["submitted", "auto_submitted"];

// Every kind of result for one student, in tabs
function StudentResults({ id, name = "Student" }) {
    const [tab, setTab] = useState("live");
    const printer = useReportPrinter();
    const [attempts, setAttempts] = useState(null);
    const [error, setError] = useState("");
    useEffect(() => {
        api.get(`/admin/students/${id}/attempts`)
            .then((res) => setAttempts(res.data.attempts))
            .catch((err) => setError(getErrorMessage(err)));
    }, [id]);
    const countOf = (modes) => (attempts || []).filter((a) => (modes || ["live"]).includes(a.mode)).length;
    const kind = KINDS.find((x) => x[0] === tab);
    const finishedHere = (attempts || []).filter((a) => (kind[2] || ["live"]).includes(a.mode) && DONE.includes(a.status));

    return (
        <div className="mt-8">
            <div className="flex flex-wrap gap-2 rounded-2xl bg-[#f3ecdc] p-1.5" role="tablist" aria-label="Results">
                {KINDS.map(([k, label, modes]) => (
                    <button
                        key={k}
                        role="tab"
                        aria-selected={tab === k}
                        onClick={() => setTab(k)}
                        className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-bold transition ${tab === k ? "bg-[#17140f] text-[#e5c372] shadow" : "text-slate-600 hover:text-slate-900"}`}
                    >
                        {label}
                        {attempts && <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${tab === k ? "bg-[#e5c372] text-[#17140f]" : "bg-white text-slate-600"}`}>{countOf(modes)}</span>}
                    </button>
                ))}
            </div>
            {printer.node}
            {attempts && (
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-slate-600">
                        <b className="font-display text-lg text-slate-900">{finishedHere.length}</b> {kind[1].toLowerCase()} attended
                    </p>
                    <button
                        type="button"
                        onClick={() => printer.printReports(finishedHere.map((r) => r.attemptId), "all", `${name}_${kind[1]}`)}
                        disabled={!finishedHere.length || Boolean(printer.busy)}
                        className="gp-gold-btn inline-flex items-center gap-2 px-5 py-2.5 text-sm disabled:opacity-50"
                    >
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
                    </svg>
                        {printer.busy === "all" ? `Preparing ${printer.progress}…` : "Download result"}
                    </button>
                </div>
            )}
            <div className="mt-4">
                {tab === "live" ? (
                    <StudentLive id={id} />
                ) : error ? (
                    <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
                ) : !attempts ? (
                    <div className="gp-card h-40 animate-pulse bg-white/60" />
                ) : (
                    <AttemptList rows={attempts.filter((a) => kind[2].includes(a.mode))} kind={kind[1]} />
                )}
            </div>
        </div>
    );
}

function AttemptList({ rows, kind }) {
    const [exam, setExam] = useState("All");
    const exams = ["All", ...new Set(rows.map((r) => r.exam).filter(Boolean))];
    const shown = exam === "All" ? rows : rows.filter((r) => r.exam === exam);
    const done = shown.filter((r) => DONE.includes(r.status));
    const avg = done.length ? Math.round(done.reduce((n, r) => n + (r.percentage || 0), 0) / done.length) : null;
    const best = done.length ? Math.round(Math.max(...done.map((r) => r.percentage || 0))) : null;

    if (!rows.length) return <p className="gp-card px-5 py-12 text-center text-sm text-slate-500">No {kind.toLowerCase()} taken yet.</p>;

    return (
        <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
                {exams.length > 2 ? (
                    <div className="inline-flex rounded-full bg-white p-1 ring-1 ring-[#e7dcc3]">
                        {exams.map((e) => (
                            <button key={e} onClick={() => setExam(e)} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${exam === e ? "bg-[#17140f] text-[#e5c372]" : "text-slate-600"}`}>
                                {e}
                            </button>
                        ))}
                    </div>
                ) : (
                    <span />
                )}
                <div className="flex gap-3 text-sm">
                    {avg !== null && (
                        <span className="rounded-xl bg-white px-3 py-1.5 ring-1 ring-[#e7dcc3]">
                            <b className="font-display text-slate-900">{avg}%</b> <span className="text-slate-500">average</span>
                        </span>
                    )}
                    {best !== null && (
                        <span className="rounded-xl bg-white px-3 py-1.5 ring-1 ring-[#e7dcc3]">
                            <b className="font-display text-slate-900">{best}%</b> <span className="text-slate-500">best</span>
                        </span>
                    )}
                </div>
            </div>

            <div className="mt-4 space-y-3">
                {shown.map((r, i) => {
                    const finished = DONE.includes(r.status);
                    const p = Math.round(r.percentage || 0);
                    const tone = p >= 75 ? "text-emerald-700" : p >= 50 ? "text-amber-700" : "text-rose-700";
                    const bar = p >= 75 ? "bg-emerald-500" : p >= 50 ? "bg-amber-500" : "bg-rose-500";
                    return (
                        <Link key={r.attemptId} to={finished ? `/admin/attempts/${r.attemptId}` : "#"} onClick={(e) => !finished && e.preventDefault()} className={`gp-card flex items-center gap-4 p-4 md:p-5 ${finished ? "gp-card-hover" : "opacity-75"}`}>
                            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#17140f] font-display text-sm font-bold text-[#e5c372]">{shown.length - i}</span>
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    {r.exam && <span className="gp-chip">{r.exam}</span>}
                                    {r.mode !== "practice" && r.mode !== "assignment" && r.mode !== "mock" && <span className="gp-chip">{r.modeLabel}</span>}
                                    {!finished && <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">Not finished</span>}
                                </div>
                                <p className="mt-1 truncate font-bold text-slate-900">{r.title}</p>
                                <p className="text-xs text-slate-500">
                                    {fmtDateTime(r.submittedAt || r.startedAt)} · {r.questions} questions
                                    {finished && r.timeTakenSec ? ` · ${fmtDuration(r.timeTakenSec)}` : ""}
                                </p>
                                {finished && (
                                    <div className="mt-2 h-1.5 max-w-xs overflow-hidden rounded-full bg-[#f3ecdc]">
                                        <div className={`h-full ${bar}`} style={{ width: `${Math.max(0, Math.min(100, p))}%` }} />
                                    </div>
                                )}
                            </div>
                            {finished && (
                                <div className="hidden shrink-0 text-center text-xs sm:block">
                                    <span className="text-emerald-700">{r.correct} ✓</span> · <span className="text-rose-700">{r.wrong} ✗</span> · <span className="text-slate-500">{r.unanswered} –</span>
                                </div>
                            )}
                            <div className="shrink-0 text-right">
                                {finished ? (
                                    <>
                                        <p className="font-display text-xl font-extrabold tabular-nums text-slate-900">
                                            {r.score}
                                            <span className="text-xs font-semibold text-slate-400">/{r.maxScore}</span>
                                        </p>
                                        <p className={`text-xs font-bold ${tone}`}>{p}%</p>
                                    </>
                                ) : (
                                    <p className="text-xs text-slate-400">—</p>
                                )}
                            </div>
                            {finished && <span className="hidden shrink-0 text-sm font-semibold text-[#b8862b] md:block">View →</span>}
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}

