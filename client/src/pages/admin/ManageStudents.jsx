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

    useEffect(() => {
        api
            .get("/admin/students", { params: query ? { search: query } : {} })
            .then((res) => {
                setStudents(res.data.students);
                setError("");
            })
            .catch((err) => setError(getErrorMessage(err)))
            .finally(() => setLoading(false));
    }, [query]);

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
            <form onSubmit={runSearch} className="mt-6 flex gap-2 max-w-md">
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
                                <td colSpan="6" className="px-4 py-6 text-center text-slate-500">Loading...</td>
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
                                        <Link to={`/admin/students/${s._id}`} className="mr-4 inline-flex items-center rounded-lg bg-slate-900 px-3.5 py-1.5 text-sm font-semibold text-amber-200 hover:bg-black">
                                            View details →
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
                                <td colSpan="6" className="px-4 py-6 text-center text-slate-500">No students found.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </AdminLayout>
    );
}