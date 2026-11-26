import MathText from "../../components/MathText";
import { askConfirm } from "../../components/ConfirmDialog";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api, { getErrorMessage } from "../../api/axios";
import AdminLayout from "../../components/AdminLayout";
import Loading from "../../components/Loading";

const selectClass = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-50";
const STATUS_STYLES = {
    published: "bg-green-50 text-green-700",
    draft: "bg-amber-50 text-amber-700",
    archived: "bg-slate-100 text-slate-500",
};
const QTYPES = [
    ["", "All question types"],
    ["mcq", "MCQ (single correct)"],
    ["multi", "MCQ (more than one correct)"],
    ["assertion", "Assertion and reason"],
    ["match", "Match the following"],
    ["statement", "Statement based"],
    ["numerical", "Numerical"],
];
const EMPTY = { subjectId: "", classLevel: "", chapterId: "", topicId: "", qtype: "", difficulty: "", status: "", q: "" };

export default function ManageQuestions() {
    const [exams, setExams] = useState([]);
    const [examId, setExamId] = useState(localStorage.getItem("examId") || "");
    const [tree, setTree] = useState({ subjects: [], chapters: [], topics: [] });
    const [filters, setFilters] = useState(EMPTY);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [data, setData] = useState({ questions: [], total: 0, pages: 1 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [reload, setReload] = useState(0);

    // Exams
    useEffect(() => {
        api.get("/exams")
            .then((res) => {
                setExams(res.data.exams);
                if (!examId && res.data.exams[0]) setExamId(res.data.exams[0]._id);
            })
            .catch((err) => setError(getErrorMessage(err)));
    }, []);

    // Subjects, chapters and topics of the chosen exam
    useEffect(() => {
        if (!examId) return;
        localStorage.setItem("examId", examId);
        api.get("/admin/syllabus-filters", { params: { examId } })
            .then((res) => setTree(res.data))
            .catch((err) => setError(getErrorMessage(err)));
    }, [examId]);

    // Search box waits until you stop typing
    useEffect(() => {
        const t = setTimeout(() => {
            if (search !== filters.q) change({ q: search });
        }, 400);
        return () => clearTimeout(t);
    }, [search]);

    // Questions
    useEffect(() => {
        if (!examId) return;
        const params = { page, limit: 20, examId };
        Object.entries(filters).forEach(([key, value]) => {
            if (value) params[key] = value;
        });
        api.get("/admin/questions", { params })
            .then((res) => {
                setData(res.data);
                setError("");
            })
            .catch((err) => setError(getErrorMessage(err)))
            .finally(() => setLoading(false));
    }, [examId, filters, page, reload]);

    const change = (next) => {
        setLoading(true);
        setPage(1);
        setFilters((f) => ({ ...f, ...next }));
    };

    const chapters = useMemo(
        () => tree.chapters.filter((c) => (!filters.subjectId || String(c.subjectId) === filters.subjectId) && (!filters.classLevel || c.classLevel === filters.classLevel)),
        [tree, filters.subjectId, filters.classLevel]
    );
    const topics = useMemo(() => tree.topics.filter((t) => String(t.chapterId) === filters.chapterId), [tree, filters.chapterId]);

    const remove = async (q) => {
        if (!await askConfirm("Delete this question? Students won't see it, but old results keep it.")) return;
        try {
            await api.delete(`/admin/questions/${q._id}`);
            setReload((n) => n + 1);
        } catch (err) {
            setError(getErrorMessage(err));
        }
    };

    const anyFilter = Object.values(filters).some(Boolean);

    return (
        <AdminLayout
            title="Questions"
            actions={<div className="flex gap-2"><Link to="/admin/questions/bulk" className="rounded-lg border border-indigo-200 text-indigo-700 text-sm font-medium px-4 py-2 hover:bg-indigo-50">Bulk upload</Link><Link to="/admin/questions/new" className="rounded-lg bg-indigo-600 text-white text-sm font-medium px-4 py-2 hover:bg-indigo-700">
                    + Add question
                </Link></div>}
        >
            <div className="mt-6 bg-white rounded-xl border border-slate-200 p-5 space-y-3">
                <div className="grid gap-3 sm:grid-cols-3">
                    <select value={examId} onChange={(e) => { setLoading(true); setPage(1); setFilters(EMPTY); setSearch(""); setExamId(e.target.value); }} className={selectClass} aria-label="Exam">
                        {exams.map((e) => <option key={e._id} value={e._id}>{e.code}</option>)}
                    </select>
                    <select value={filters.subjectId} onChange={(e) => change({ subjectId: e.target.value, chapterId: "", topicId: "" })} className={selectClass} aria-label="Subject">
                        <option value="">All subjects</option>
                        {tree.subjects.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
                    </select>
                    <select value={filters.classLevel} onChange={(e) => change({ classLevel: e.target.value, chapterId: "", topicId: "" })} className={selectClass} aria-label="Class">
                        <option value="">All classes</option>
                        <option value="11">Class 11</option>
                        <option value="12">Class 12</option>
                    </select>
                </div>
                <select value={filters.chapterId} onChange={(e) => change({ chapterId: e.target.value, topicId: "" })} className={selectClass} aria-label="Chapter">
                    <option value="">All chapters</option>
                    {chapters.map((c) => <option key={c._id} value={c._id}>{c.name} (Class {c.classLevel})</option>)}
                </select>
                <select value={filters.topicId} onChange={(e) => change({ topicId: e.target.value })} disabled={!filters.chapterId} className={selectClass} aria-label="Concept">
                    <option value="">{filters.chapterId ? "All concepts" : "All concepts (choose a chapter first)"}</option>
                    {topics.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
                </select>
                <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_2fr]">
                    <select value={filters.qtype} onChange={(e) => change({ qtype: e.target.value })} className={selectClass} aria-label="Question type">
                        {QTYPES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                    </select>
                    <select value={filters.difficulty} onChange={(e) => change({ difficulty: e.target.value })} className={selectClass} aria-label="Difficulty">
                        <option value="">Any difficulty</option>
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                    </select>
                    <select value={filters.status} onChange={(e) => change({ status: e.target.value })} className={selectClass} aria-label="Status">
                        <option value="">Published and drafts</option>
                        <option value="published">Published only</option>
                        <option value="draft">Drafts only</option>
                        <option value="archived">Deleted</option>
                    </select>
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search questions..." className={selectClass} aria-label="Search questions" />
                </div>
                {anyFilter && (
                    <button onClick={() => { setSearch(""); change(EMPTY); }} className="text-sm font-medium text-indigo-600 hover:underline">
                        Clear filters
                    </button>
                )}
            </div>

            {error && <div className="mt-4 rounded-lg bg-red-50 text-red-700 text-sm px-4 py-3">{error}</div>}

            <p className="mt-4 text-sm text-slate-500">{data.total.toLocaleString("en-IN")} question(s)</p>

            {loading ? (
                <Loading />
            ) : (
                <div className="mt-2 space-y-2">
                    {data.questions.map((q) => (
                        <article key={q._id} className="bg-white rounded-xl border border-slate-200 p-4 flex gap-4 items-start">
                            <div className="flex-1 min-w-0">
                                <MathText as="div" className="text-slate-900 whitespace-pre-line" text={q.text} />
                                <div className="flex flex-wrap gap-2 mt-2 text-xs">
                                    <span className={`px-2 py-0.5 rounded-md font-medium ${STATUS_STYLES[q.status] || ""}`}>{q.status}</span>
                                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 capitalize">{q.difficulty}</span>
                                    <span className="text-slate-500">
                                        Answer: {q.type === "numerical" ? q.numericalAnswer?.value : (q.correctOptionIds || []).join(", ")}
                                    </span>
                                    <span className="text-slate-500">
                                        {q.stats?.attempts
                                            ? `${Math.round((q.stats.correct / q.stats.attempts) * 100)}% correct of ${q.stats.attempts} tries`
                                            : "Not attempted yet"}
                                    </span>
                                </div>
                            </div>
                            <div className="flex gap-3 text-sm shrink-0">
                                <Link to={`/admin/questions/${q._id}`} className="text-indigo-600 hover:underline">
                                    Edit
                                </Link>
                                {q.status !== "archived" && (
                                    <button onClick={() => remove(q)} className="text-red-600 hover:underline">
                                        Delete
                                    </button>
                                )}
                            </div>
                        </article>
                    ))}
                    {data.questions.length === 0 && <p className="text-slate-500">No questions match these filters.</p>}
                </div>
            )}

            {data.pages > 1 && (
                <div className="flex items-center gap-3 mt-4 text-sm">
                    <button onClick={() => setPage((p) => p - 1)} disabled={page <= 1} className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40">
                        ← Previous
                    </button>
                    <span className="text-slate-600">
                        Page {page} of {data.pages}
                    </span>
                    <button onClick={() => setPage((p) => p + 1)} disabled={page >= data.pages} className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40">
                        Next →
                    </button>
                </div>
            )}
        </AdminLayout>
    );
}