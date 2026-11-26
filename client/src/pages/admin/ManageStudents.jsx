import { askConfirm } from "../../components/ConfirmDialog";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { rowLink } from "../../components/uiHelpers";
import api, { getErrorMessage } from "../../api/axios";
import AdminLayout from "../../components/AdminLayout";

const formatDate = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Never");

export default function ManageStudents() {
    const navigate = useNavigate();
    const [students, setStudents] = useState([]);
    const [search, setSearch] = useState("");
    const [query, setQuery] = useState(""); // the search actually sent to the server
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [college, setCollege] = useState(""); // "" = all students
    const [section, setSection] = useState("");
    const [colleges, setColleges] = useState(["MBPU"]);

    useEffect(() => {
        setLoading(true);
        api
            .get("/admin/students", { params: { ...(query ? { search: query } : {}), ...(college ? { college } : {}), ...(college && section ? { section } : {}) } })
            .then((res) => {
                setStudents(res.data.students);
                if (res.data.colleges) setColleges(res.data.colleges);
                setError("");
            })
            .catch((err) => setError(getErrorMessage(err)))
            .finally(() => setLoading(false));
    }, [query, college, section]);

    const runSearch = (e) => {
        e.preventDefault();
        setLoading(true);
        setQuery(search.trim());
    };

    const toggleStatus = async (s) => {
        const status = s.status === "active" ? "suspended" : "active";
        const verb = status === "suspended" ? "Suspend" : "Activate";
        if (!await askConfirm(`${verb} ${s.name}?`)) return;
        try {
            await api.put(`/admin/students/${s._id}/status`, { status });
            setStudents((list) => list.map((x) => (x._id === s._id ? { ...x, status } : x)));
        } catch (err) {
            setError(getErrorMessage(err));
        }
    };

    return (
        <AdminLayout title="Students">
            <div className="mt-6 flex flex-wrap items-end gap-3">
                <label className="block">
                    <span className="gp-label">College</span>
                    <select
                        value={college}
                        onChange={(e) => {
                            setCollege(e.target.value);
                            setSection("");
                        }}
                        className="mt-1.5 block min-w-[13rem] rounded-xl border border-[#e7dcc3] bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-[#c9a24a] focus:ring-4 focus:ring-[#e5c372]/30"
                    >
                        <option value="">All students</option>
                        {colleges.map((c) => (
                            <option key={c} value={c}>
                                {c}
                            </option>
                        ))}
                    </select>
                </label>
                {college.toLowerCase() === "mbpu" && (
                    <label className="block">
                        <span className="gp-label">Section</span>
                        <select
                            value={section}
                            onChange={(e) => setSection(e.target.value)}
                            className="mt-1.5 block min-w-[10rem] rounded-xl border border-[#e7dcc3] bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-[#c9a24a] focus:ring-4 focus:ring-[#e5c372]/30"
                        >
                            <option value="">All sections</option>
                            {["A", "B", "C", "D"].map((x) => (
                                <option key={x} value={x}>
                                    Section {x}
                                </option>
                            ))}
                        </select>
                    </label>
                )}
                {!loading && (
                    <span className="ml-auto pb-2.5 text-sm text-slate-500">
                        <b className="text-slate-900">{students.length}</b> student{students.length === 1 ? "" : "s"}
                    </span>
                )}
            </div>
            <form onSubmit={runSearch} className="mt-4 flex max-w-xl gap-2">
                <div className="relative flex-1">
                    <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                        <path d="M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-3.5-3.5" />
                    </svg>
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by name or email"
                        className="w-full rounded-xl border border-[#e7dcc3] bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[#c9a24a] focus:ring-4 focus:ring-[#e5c372]/30"
                    />
                </div>
                <button className="gp-btn gp-btn-dark px-5 py-2.5 text-sm">Search</button>
            </form>

            {error && <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

            {/* Column names (wide screens) */}
            <div className="mt-5 hidden grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_90px_110px_130px] gap-4 px-5 text-[11px] font-bold uppercase tracking-wider text-slate-500 lg:grid">
                <span>Student</span>
                <span>College</span>
                <span>Joined</span>
                <span>Last login</span>
                <span className="text-center">Tests</span>
                <span>Status</span>
                <span />
            </div>

            <div className="mt-2 space-y-2.5">
                {loading &&
                    [0, 1, 2, 3, 4].map((i) => <div key={i} className="h-[72px] animate-pulse rounded-2xl bg-white/70 ring-1 ring-[#efe6d2]" />)}
                {!loading &&
                    students.map((s) => {
                        const active = s.status === "active";
                        return (
                            <div
                                key={s._id}
                                {...rowLink(navigate, `/admin/students/${s._id}`)}
                                title="Open this student's results"
                                className="group grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 rounded-2xl bg-white px-4 py-3.5 shadow-sm ring-1 ring-[#efe6d2] transition hover:-translate-y-0.5 hover:shadow-md hover:ring-[#c9a24a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c9a24a] lg:grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_90px_110px_130px] lg:px-5"
                            >
                                {/* Student */}
                                <div className="col-span-2 flex min-w-0 items-center gap-3 lg:col-span-1">
                                    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full font-display text-sm font-bold ${active ? "bg-gradient-to-b from-[#e5c372] to-[#b8862b] text-[#17140f]" : "bg-slate-200 text-slate-500"}`}>
                                        {(s.name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block truncate font-semibold text-slate-900 group-hover:text-[#8a6420]">{s.name}</span>
                                        <span className="block truncate text-xs text-slate-500">{s.email}</span>
                                    </span>
                                </div>
                                {/* College */}
                                <div className="hidden items-center gap-1.5 text-sm text-slate-700 lg:flex">
                                    {s.college || "—"}
                                    {s.section && <span className="rounded-md bg-[#17140f] px-1.5 py-0.5 text-[11px] font-bold text-[#e5c372]">{s.section}</span>}
                                </div>
                                <div className="hidden text-sm text-slate-600 lg:block">{formatDate(s.createdAt)}</div>
                                <div className={`hidden text-sm lg:block ${s.lastLoginAt ? "text-slate-600" : "text-slate-400"}`}>{formatDate(s.lastLoginAt)}</div>
                                <div className="hidden text-center lg:block">
                                    <span className={`inline-grid h-8 min-w-8 place-items-center rounded-lg px-2 font-display text-sm font-bold tabular-nums ${s.testsTaken ? "bg-[#f6efdf] text-slate-900" : "text-slate-400"}`}>{s.testsTaken}</span>
                                </div>
                                <div className="hidden lg:block">
                                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${active ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-rose-50 text-rose-700 ring-rose-200"}`}>
                                        <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-rose-500"}`} />
                                        {active ? "Active" : "Suspended"}
                                    </span>
                                </div>
                                {/* Actions */}
                                <div className="flex items-center justify-end gap-1.5 lg:gap-2">
                                    <button
                                        type="button"
                                        onClick={() => toggleStatus(s)}
                                        className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${active ? "text-slate-500 hover:bg-rose-50 hover:text-rose-700" : "text-emerald-700 hover:bg-emerald-50"}`}
                                    >
                                        {active ? "Suspend" : "Activate"}
                                    </button>
                                    <span className="grid h-8 w-8 place-items-center rounded-full bg-[#f6efdf] text-[#8a6420] transition group-hover:bg-[#17140f] group-hover:text-[#e5c372]" aria-hidden="true">
                                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M9 18l6-6-6-6" />
                                        </svg>
                                    </span>
                                </div>
                                {/* Phones: the details under the name */}
                                <div className="col-span-3 flex flex-wrap items-center gap-x-3 gap-y-1 pl-[52px] text-xs text-slate-500 lg:hidden">
                                    <span>
                                        {s.college || "—"}
                                        {s.section ? ` · ${s.section}` : ""}
                                    </span>
                                    <span>{s.testsTaken} tests</span>
                                    <span>Last login {formatDate(s.lastLoginAt)}</span>
                                    <span className={active ? "text-emerald-700" : "text-rose-700"}>{active ? "Active" : "Suspended"}</span>
                                </div>
                            </div>
                        );
                    })}
                {!loading && students.length === 0 && <p className="rounded-2xl bg-white px-4 py-10 text-center text-sm text-slate-500 ring-1 ring-[#efe6d2]">No students found.</p>}
            </div>
        </AdminLayout>
    );
}