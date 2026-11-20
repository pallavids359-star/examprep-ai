import { useEffect, useMemo, useState } from "react";
import api, { getErrorMessage } from "../api/axios";

// Mock test setup: full syllabus or chosen chapters, plus difficulty.
// Same look and steps as the Practice page.

const DIFFICULTIES = [
    { value: "any", label: "Any" },
    { value: "easy", label: "Easy" },
    { value: "medium", label: "Medium" },
    { value: "hard", label: "Hard" },
];

const pillClass = (selected) =>
    `px-4 py-2 rounded-lg border text-sm font-medium ${selected ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-slate-300 text-slate-700 hover:border-slate-400"}`;

const smallBtn = "text-xs font-semibold text-indigo-600 hover:underline";

const subjectKey = (name) => {
    const k = String(name || "").toLowerCase().replace(/[^a-z]/g, "");
    return k === "maths" || k === "math" ? "mathematics" : k;
};

function Tick({ checked, onChange, title }) {
    return (
        <label
            className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 cursor-pointer text-sm ${checked ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-slate-300 text-slate-700 hover:border-slate-400"}`}
        >
            <input type="checkbox" checked={checked} onChange={onChange} className="mt-0.5 h-4 w-4 shrink-0 accent-indigo-600" />
            <span className="min-w-0 font-medium">{title}</span>
        </label>
    );
}

// exam: { _id, code }, parts: [["Physics", 45], ...] from the paper pattern
export default function MockSetup({ exam, stream, parts, minutes, onBack, onContinue }) {
    const [scope, setScope] = useState("full"); // "full" | "chapters"
    const [subjects, setSubjects] = useState([]);
    const [subjectId, setSubjectId] = useState("");
    const [chaptersBySubject, setChaptersBySubject] = useState({}); // subjectId -> chapters | "loading"
    const [chapterIds, setChapterIds] = useState([]);
    const [difficulty, setDifficulty] = useState("any");
    const [error, setError] = useState("");

    // Only the subjects that are in this exam's paper (KCET depends on the stream)
    const wanted = useMemo(() => parts.map(([name]) => subjectKey(name)), [parts]);

    useEffect(() => {
        api
            .get(`/exams/${exam._id}/subjects`)
            .then((res) => {
                const list = res.data.subjects
                    .filter((s) => wanted.includes(subjectKey(s.name)))
                    .sort((a, b) => wanted.indexOf(subjectKey(a.name)) - wanted.indexOf(subjectKey(b.name)));
                setSubjects(list);
                setSubjectId((cur) => (list.some((s) => s._id === cur) ? cur : list[0]?._id || ""));
            })
            .catch((err) => setError(getErrorMessage(err)));
    }, [exam._id, wanted]);

    // Load chapters of the open subject (once)
    useEffect(() => {
        if (scope !== "chapters" || !subjectId || chaptersBySubject[subjectId]) return;
        setChaptersBySubject((p) => ({ ...p, [subjectId]: "loading" }));
        api
            .get(`/subjects/${subjectId}/chapters`)
            .then((res) => setChaptersBySubject((p) => ({ ...p, [subjectId]: res.data.chapters })))
            .catch((err) => {
                setError(getErrorMessage(err));
                setChaptersBySubject((p) => ({ ...p, [subjectId]: [] }));
            });
    }, [scope, subjectId, chaptersBySubject]);

    const chaptersOf = (sid) => (Array.isArray(chaptersBySubject[sid]) ? chaptersBySubject[sid] : []);

    const toggleChapter = (id) => setChapterIds((p) => (p.includes(id) ? p.filter((c) => c !== id) : [...p, id]));
    const setManyChapters = (ids, on) =>
        setChapterIds((p) => (on ? [...new Set([...p, ...ids])] : p.filter((c) => !ids.includes(c))));

    // Chosen chapters per subject (for the tab badges and the summary)
    const allChapters = subjects.flatMap((s) => chaptersOf(s._id).map((c) => ({ ...c, subjectId: s._id })));
    const chosen = allChapters.filter((c) => chapterIds.includes(c._id));
    const countIn = (sid) => chosen.filter((c) => c.subjectId === sid).length;
    const subjectsUsed = subjects.filter((s) => countIn(s._id) > 0);

    const chapters = chaptersOf(subjectId);
    const classes = [...new Set(chapters.map((c) => String(c.classLevel || "")))].sort();

    const partCount = (name) => (parts.find(([n]) => subjectKey(n) === subjectKey(name)) || [null, 0])[1];
    const totalQs = parts.reduce((a, [, n]) => a + n, 0);
    const perQ = minutes / totalQs;
    const maxQs = scope === "full" ? totalQs : subjectsUsed.reduce((a, s) => a + partCount(s.name), 0);
    const estMinutes = Math.max(5, Math.round(perQ * maxQs));
    const canGo = scope === "full" || chosen.length > 0;

    const go = () =>
        onContinue({
            scope,
            difficulty,
            chapterIds: scope === "full" ? [] : chapterIds,
            topicIds: [],
            maxQuestions: maxQs,
            minutes: scope === "full" ? minutes : estMinutes,
        });

    return (
        <div>
            <button type="button" onClick={onBack} className="group inline-flex items-center gap-2.5 text-sm font-medium text-slate-600 hover:text-slate-900">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-white text-slate-700 shadow-sm ring-1 ring-[#e7dcc3] transition group-hover:-translate-x-0.5 group-hover:bg-[#17140f] group-hover:text-[#e5c372]">
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M15 18l-6-6 6-6" />
                    </svg>
                </span>
                All exams
            </button>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">
                {exam.code}
                {exam.code === "KCET" ? ` (${stream})` : ""} mock test
            </h2>
            <p className="text-sm text-slate-500 mt-1">Choose what the test should cover.</p>

            {error && <div className="mt-4 rounded-lg bg-red-50 text-red-700 text-sm px-4 py-3">{error}</div>}

            {/* 1. Syllabus */}
            <section className="mt-5 bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="font-semibold text-slate-900">1. Syllabus</h3>
                <div className="flex flex-wrap gap-2 mt-3">
                    <button type="button" onClick={() => setScope("full")} className={pillClass(scope === "full")}>
                        Full syllabus
                    </button>
                    <button type="button" onClick={() => setScope("chapters")} className={pillClass(scope === "chapters")}>
                        Choose chapters
                    </button>
                </div>
                <p className="text-xs text-slate-500 mt-3">
                    {scope === "full"
                        ? "Questions from every chapter, in the real exam pattern."
                        : "Pick chapters in one or more subjects. Subjects with no chapters picked are left out."}
                </p>
            </section>

            {/* 2. Chapters */}
            {scope === "chapters" && (
                <section className="mt-4 bg-white rounded-xl border border-slate-200 p-5">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h3 className="font-semibold text-slate-900">2. Chapters</h3>
                        <span className="text-xs text-slate-500">{chosen.length} selected</span>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3">
                        {subjects.map((s) => (
                            <button key={s._id} type="button" onClick={() => setSubjectId(s._id)} className={pillClass(s._id === subjectId)}>
                                {s.name}
                                {countIn(s._id) > 0 && <span className="ml-1.5 text-xs">({countIn(s._id)})</span>}
                            </button>
                        ))}
                    </div>

                    {chaptersBySubject[subjectId] === "loading" || (subjectId && !chaptersBySubject[subjectId]) ? (
                        <p className="text-sm text-slate-500 mt-4">Loading chapters...</p>
                    ) : chapters.length === 0 ? (
                        <p className="text-sm text-slate-500 mt-4">No chapters added for this subject yet.</p>
                    ) : (
                        classes.map((cl) => {
                            const list = chapters.filter((c) => String(c.classLevel || "") === cl);
                            const ids = list.map((c) => c._id);
                            const allOn = ids.every((id) => chapterIds.includes(id));
                            return (
                                <div key={cl} className="mt-4">
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm font-semibold text-slate-700">{cl ? `Class ${cl}` : "Chapters"}</p>
                                        <button type="button" className={smallBtn} onClick={() => setManyChapters(ids, !allOn)}>
                                            {allOn ? "Clear" : "Select all"}
                                        </button>
                                    </div>
                                    <div className="grid sm:grid-cols-2 gap-2 mt-2">
                                        {list.map((c) => (
                                            <Tick key={c._id} checked={chapterIds.includes(c._id)} onChange={() => toggleChapter(c._id)} title={c.name} />
                                        ))}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </section>
            )}

            {/* Difficulty */}
            <section className="mt-4 bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="font-semibold text-slate-900">{scope === "chapters" ? "3" : "2"}. Difficulty</h3>
                <div className="flex flex-wrap gap-2 mt-3">
                    {DIFFICULTIES.map((d) => (
                        <button key={d.value} type="button" onClick={() => setDifficulty(d.value)} className={pillClass(d.value === difficulty)}>
                            {d.label}
                        </button>
                    ))}
                </div>
            </section>

            {/* Summary */}
            <section className="mt-4 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
                {scope === "full" ? (
                    <p>
                        <b>{totalQs} questions</b> in <b>{minutes} minutes</b>, real {exam.code} pattern.
                    </p>
                ) : chosen.length === 0 ? (
                    <p className="text-slate-500">Pick at least one chapter.</p>
                ) : (
                    <>
                        <p>
                            Up to <b>{maxQs} questions</b> in about <b>{estMinutes} minutes</b>:
                        </p>
                        <ul className="mt-2 space-y-1">
                            {subjectsUsed.map((s) => (
                                <li key={s._id} className="flex justify-between">
                                    <span>
                                        {s.name} · {countIn(s._id)} chapter{countIn(s._id) > 1 ? "s" : ""}
                                    </span>
                                    <span className="font-medium">up to {partCount(s.name)} Qs</span>
                                </li>
                            ))}
                        </ul>
                        <p className="text-xs text-slate-500 mt-2">If the chosen chapters have fewer questions, you get all of them and the time is shortened to match.</p>
                    </>
                )}
                {difficulty !== "any" && <p className="mt-1 text-xs text-slate-500">Only {difficulty} questions.</p>}
            </section>

            <button
                type="button"
                onClick={go}
                disabled={!canGo}
                className="mt-6 w-full rounded-lg bg-indigo-600 text-white font-semibold py-3 hover:bg-indigo-700 disabled:opacity-50"
            >
                Continue
            </button>
        </div>
    );
}
