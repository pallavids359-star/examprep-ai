import { askConfirm } from "../../components/ConfirmDialog";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { getErrorMessage } from "../../api/axios";
import AdminLayout from "../../components/AdminLayout";

const formatDate = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Never");

export default function ManageStudents() {
    const [students, setStudents] = useState([]);
    const [search, setSearch] = useState("");
    const [query, setQuery] = useState(""); // the search actually sent to the server
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [college, setCollege] = useState(""); // "" = all students
    const [section, setSection] = useState("");
    const [colleges, setColleges] = useState(["MB PU"]);

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
                {college.toLowerCase() === "mb pu" && (
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
            <form onSubmit={runSearch} className="mt-4 flex gap-2 max-w-md">
                <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name or email"
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button className="rounded-lg bg-slate-900 text-white text-sm font-medium px-4 py-2">Search</button>
            </form>

            {error && <div className="mt-4 rounded-lg bg-red-50 text-red-700 text-sm px-4 py-3">{error}</div>}

            <div className="mt-4 bg-white rounded-xl border border-slate-200 overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-slate-500 border-b border-slate-200">
                            <th className="px-4 py-3 font-medium">Student</th>
                            <th className="px-4 py-3 font-medium">College</th>
                            <th className="px-4 py-3 font-medium">Joined</th>
                            <th className="px-4 py-3 font-medium">Last login</th>
                            <th className="px-4 py-3 font-medium">Tests taken</th>
                            <th className="px-4 py-3 font-medium">Status</th>
                            <th className="px-4 py-3" />
                        </tr>
                    </thead>
                    <tbody>
                        {loading && (
                            <tr>
                                <td colSpan="7" className="px-4 py-6 text-center text-slate-500">Loading...</td>
                            </tr>
                        )}
                        {!loading &&
                            students.map((s) => (
                                <tr key={s._id} className="border-b border-slate-100 last:border-0">
                                    <td className="px-4 py-3">
                                        <Link to={`/admin/students/${s._id}`} className="font-medium text-slate-900 hover:text-indigo-700 hover:underline">
                                            {s.name}
                                        </Link>
                                        <p className="text-xs text-slate-500">{s.email}</p>
                                    </td>
                                    <td className="px-4 py-3 text-slate-700">
                                        {s.college || "—"}
                                        {s.section && <span className="ml-1.5 rounded-md bg-[#17140f] px-1.5 py-0.5 text-xs font-bold text-[#e5c372]">{s.section}</span>}
                                    </td>
                                    <td className="px-4 py-3 text-slate-600">{formatDate(s.createdAt)}</td>
                                    <td className="px-4 py-3 text-slate-600">{formatDate(s.lastLoginAt)}</td>
                                    <td className="px-4 py-3 text-slate-700">{s.testsTaken}</td>
                                    <td className="px-4 py-3">
                                        <span
                                            className={`px-2 py-0.5 rounded-md text-xs font-medium ${s.status === "active" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                                                }`}
                                        >
                                            {s.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right whitespace-nowrap">
                                        <Link to={`/admin/students/${s._id}`} className="mr-4 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50">
                                            View
                                        </Link>
                                        <button
                                            onClick={() => toggleStatus(s)}
                                            className={s.status === "active" ? "text-red-600 hover:underline" : "text-green-700 hover:underline"}
                                        >
                                            {s.status === "active" ? "Suspend" : "Activate"}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        {!loading && students.length === 0 && (
                            <tr>
                                <td colSpan="7" className="px-4 py-6 text-center text-slate-500">No students found.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </AdminLayout>
    );
}