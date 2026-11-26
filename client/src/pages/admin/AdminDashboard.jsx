import QuestionBreakdown from "../../components/QuestionBreakdown";
import SupabaseSyncPanel from "../../components/SupabaseSyncPanel";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { getErrorMessage } from "../../api/axios";
import AdminLayout from "../../components/AdminLayout";

const TILES = [
    { key: "students", label: "Students", to: "/admin/students" },
    { key: "questions", label: "Published questions", to: "/admin/questions" },
    { key: "drafts", label: "Draft questions", to: "/admin/drafts" },
    { key: "tests", label: "Mock tests", to: "/admin/tests" },
    { key: "attemptsToday", label: "Attempts today", to: null },
];

const ACTIONS = [
    { to: "/admin/questions/new", title: "Add a question", text: "Write a new question with options and an explanation." },
    { to: "/admin/syllabus", title: "Manage syllabus", text: "Add chapters and topics for each subject." },
    { to: "/admin/tests", title: "Create a mock test", text: "Build a timed test from the question bank." },
];

export default function AdminDashboard() {
    const [data, setData] = useState(null);
    const [error, setError] = useState("");

    useEffect(() => {
        api
            .get("/admin/overview")
            .then((res) => setData(res.data))
            .catch((err) => setError(getErrorMessage(err)));
    }, []);

    return (
        <AdminLayout title="Overview">
            {error && <div className="mt-6 rounded-lg bg-red-50 text-red-700 text-sm px-4 py-3">{error}</div>}
            {!data && !error && <p className="mt-6 text-slate-500">Loading...</p>}

            {data && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
                    {TILES.map((t) => {
                        const box = (
                            <div className="bg-white rounded-xl border border-slate-200 p-5 h-full hover:border-indigo-300">
                                <p className="text-sm text-slate-500">{t.label}</p>
                                <p className="text-3xl font-bold text-slate-900 mt-1">{Number(data[t.key] || 0).toLocaleString("en-IN")}</p>
                            </div>
                        );
                        return t.to ? (
                            <Link key={t.key} to={t.to}>
                                {box}
                            </Link>
                        ) : (
                            <div key={t.key}>{box}</div>
                        );
                    })}
                </div>
            )}

            <h2 className="font-semibold text-slate-900 mt-8">Quick actions</h2>
            <div className="grid md:grid-cols-3 gap-4 mt-3">
                {ACTIONS.map((a) => (
                    <Link key={a.to} to={a.to} className="bg-white rounded-xl border border-slate-200 p-5 hover:border-indigo-400">
                        <p className="font-semibold text-indigo-700">{a.title} →</p>
                        <p className="text-sm text-slate-500 mt-1">{a.text}</p>
                    </Link>
                ))}
            </div>
        <QuestionBreakdown />
        <SupabaseSyncPanel />
      </AdminLayout>
    );
}