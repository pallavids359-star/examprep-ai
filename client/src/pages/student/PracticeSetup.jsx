import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PageHeader } from "../../components/ui";
import api, { getErrorMessage } from "../../api/axios";
import DifficultyPicker, { mixValid } from "../../components/DifficultyPicker";

const COUNTS = [10, 20, 30];

// Style for the choice buttons: highlighted when selected
const pillClass = (selected) =>
    `px-4 py-2 rounded-lg border text-sm font-medium ${selected
        ? "border-indigo-600 bg-indigo-50 text-indigo-700"
        : "border-slate-300 text-slate-700 hover:border-slate-400"
    }`;

// A tick box row (chapter or concept)
function Tick({ checked, onChange, title, sub }) {
    return (
        <label
            className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 cursor-pointer text-sm ${checked
                ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                : "border-slate-300 text-slate-700 hover:border-slate-400"
            }`}
        >
            <input type="checkbox" checked={checked} onChange={onChange} className="mt-0.5 h-4 w-4 shrink-0 accent-indigo-600" />
            <span className="min-w-0">
                <span className="block font-medium">{title}</span>
                {sub && <span className="block text-xs font-normal text-slate-500 mt-0.5">{sub}</span>}
            </span>
        </label>
    );
}

const smallBtn = "text-xs font-semibold text-indigo-600 hover:underline";

export default function PracticeSetup() {
    const navigate = useNavigate();
    const examId = localStorage.getItem("examId"); // chosen on the dashboard

    const [examCode, setExamCode] = useState("");
    const [subjects, setSubjects] = useState([]);
    const [subjectId, setSubjectId] = useState("");
    const [chapters, setChapters] = useState([]);
    const [chapterIds, setChapterIds] = useState([]); // ticked chapters
    const [topicsByChapter, setTopicsByChapter] = useState({}); // chapterId -> topics
    const [topicIds, setTopicIds] = useState([]); // ticked concepts (none = whole chapter)
    const [classLevel, setClassLevel] = useState("both");
    const [difficulty, setDifficulty] = useState("any");
    const [mix, setMix] = useState({ easy: 40, medium: 40, hard: 20 });
    const [count, setCount] = useState(20);
    const [loadingChapters, setLoadingChapters] = useState(false);
    const [starting, setStarting] = useState(false);
    const [error, setError] = useState("");

    // Load the exam name and its subjects
    useEffect(() => {
        if (!examId) return;
        api
            .get("/exams")
            .then((res) => {
                const exam = res.data.exams.find((e) => e._id === examId);
                setExamCode(exam ? exam.code : "");
            })
            .catch(() => { });
        api
            .get(`/exams/${examId}/subjects`)
            .then((res) => setSubjects(res.data.subjects))
            .catch((err) => setError(getErrorMessage(err)));
    }, [examId]);

    // Load the concepts of every ticked chapter (once each)
    useEffect(() => {
        chapterIds
            .filter((id) => !topicsByChapter[id])
            .forEach((id) => {
                setTopicsByChapter((prev) => ({ ...prev, [id]: "loading" }));
                api
                    .get(`/chapters/${id}/topics`)
                    .then((res) => setTopicsByChapter((prev) => ({ ...prev, [id]: res.data.topics })))
                    .catch(() => setTopicsByChapter((prev) => ({ ...prev, [id]: [] })));
            });
    }, [chapterIds, topicsByChapter]);

    // When a subject is clicked, load its chapters
    const chooseSubject = (id) => {
        if (id === subjectId) return;
        setSubjectId(id);
        setChapterIds([]);
        setTopicIds([]);
        setChapters([]);
        setError("");
        setLoadingChapters(true);
        api
            .get(`/subjects/${id}/chapters`)
            .then((res) => setChapters(res.data.chapters))
            .catch((err) => setError(getErrorMessage(err)))
            .finally(() => setLoadingChapters(false));
    };

    const topicsOf = (chapterId) => (Array.isArray(topicsByChapter[chapterId]) ? topicsByChapter[chapterId] : []);

    const toggleChapter = (id) => {
        if (chapterIds.includes(id)) {
            // Un-ticking a chapter also un-ticks its concepts
            const gone = new Set(topicsOf(id).map((t) => t._id));
            setTopicIds((prev) => prev.filter((t) => !gone.has(t)));
            setChapterIds((prev) => prev.filter((c) => c !== id));
        } else setChapterIds((prev) => [...prev, id]);
    };
    const setManyChapters = (ids, on) => {
        if (on) setChapterIds((prev) => [...new Set([...prev, ...ids])]);
        else {
            const gone = new Set(ids.flatMap((id) => topicsOf(id).map((t) => t._id)));
            setTopicIds((prev) => prev.filter((t) => !gone.has(t)));
            setChapterIds((prev) => prev.filter((c) => !ids.includes(c)));
        }
    };
    const toggleTopic = (id) =>
        setTopicIds((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
    const setChapterTopics = (chapterId, on) => {
        const ids = topicsOf(chapterId).map((t) => t._id);
        setTopicIds((prev) => (on ? [...new Set([...prev, ...ids])] : prev.filter((t) => !ids.includes(t))));
    };

    // Ask the backend for random questions, then open the test screen
    const startPractice = async () => {
        setError("");
        if (!mixValid(difficulty, mix)) return setError("Easy + medium + hard must add up to 100%");
        setStarting(true);
        try {
            const ok = chapters.filter((c) => chapterIds.includes(c._id) && (classLevel === "both" || String(c.classLevel || "") === classLevel));
            const okIds = ok.map((c) => c._id);
            const okTopics = topicIds.filter((t) => okIds.some((cid) => topicsOf(cid).some((x) => x._id === t)));
            const res = await api.post("/attempts/practice", { chapterIds: okIds, topicIds: okTopics, difficulty, mix, count });
            navigate(`/attempt/${res.data.attemptId}`);
        } catch (err) {
            setError(getErrorMessage(err));
            setStarting(false);
        }
    };

    if (!examId) {
        return (
            <div className="bg-slate-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl border border-slate-200 p-6 text-center">
                    <p className="text-slate-700">Choose an exam on your dashboard first.</p>
                    <Link to="/dashboard" className="inline-block mt-4 text-indigo-600 font-medium hover:underline">
                        Go to dashboard
                    </Link>
                </div>
            </div>
        );
    }

    const inClass = (c) => classLevel === "both" || String(c.classLevel || "") === classLevel;
    const classes = [...new Set(chapters.filter(inClass).map((c) => String(c.classLevel || "")))].sort();
    const chosenChapters = chapters.filter((c) => chapterIds.includes(c._id) && inClass(c));

    return (
        <div className="bg-slate-50">
            <main className="max-w-3xl mx-auto px-4 py-8">
                <PageHeader eyebrow={`${examCode} practice`} title="Practice" subtitle="Pick one or more chapters, the concepts you want, and how many questions." />

                {error && <div className="mt-5 rounded-lg bg-red-50 text-red-700 text-sm px-4 py-3">{error}</div>}

                {/* Step 1: subject */}
                <section className="mt-6 bg-white rounded-xl border border-slate-200 p-5">
                    <h2 className="font-semibold text-slate-900">1. Subject</h2>
                    <div className="flex flex-wrap gap-2 mt-3">
                        {subjects.map((s) => (
                            <button key={s._id} onClick={() => chooseSubject(s._id)} className={pillClass(s._id === subjectId)}>
                                {s.name}
                            </button>
                        ))}
                    </div>
                </section>

                {/* Step 2: class */}
                {subjectId && (
                    <section className="mt-4 bg-white rounded-xl border border-slate-200 p-5">
                        <h2 className="font-semibold text-slate-900">2. Class</h2>
                        <div className="grid grid-cols-3 gap-2 mt-3">
                            {[
                        ["11", "1st PUC", "Class 11"],
                        ["12", "2nd PUC", "Class 12"],
                        ["both", "Both", "Class 11 + 12"],
                    ].map(([v, l, sub]) => (
                        <button
                            key={v}
                            type="button"
                            onClick={() => setClassLevel(v)}
                            aria-pressed={classLevel === v}
                            className={`rounded-2xl border px-4 py-3 text-left transition ${classLevel === v ? "border-[#17140f] bg-[#17140f] text-white shadow-lg shadow-black/10" : "border-[#e7dcc3] bg-white text-slate-800 hover:border-[#c9a24a]"}`}
                        >
                            <span className="block text-sm font-bold">{l}</span>
                            <span className={`mt-0.5 block text-xs ${classLevel === v ? "text-[#e5c372]" : "text-slate-500"}`}>{sub}</span>
                        </button>
                    ))}
                        </div>
                    </section>
                )}

                {/* Step 3: chapters (many) */}
                {subjectId && (
                    <section className="mt-4 bg-white rounded-xl border border-slate-200 p-5">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <h2 className="font-semibold text-slate-900">3. Chapters</h2>
                            <span className="text-xs text-slate-500">{chapterIds.length} selected</span>
                        </div>
                        {loadingChapters ? (
                            <p className="text-sm text-slate-500 mt-3">Loading chapters...</p>
                        ) : chapters.length === 0 ? (
                            <p className="text-sm text-slate-500 mt-3">No chapters added for this subject yet.</p>
                        ) : classes.length === 0 ? (
                            <p className="text-sm text-slate-500 mt-3">No {classLevel === "11" ? "1st PUC" : "2nd PUC"} chapters for this subject.</p>
                        ) : (
                            classes.map((cl) => {
                                const list = chapters.filter((c) => inClass(c) && String(c.classLevel || "") === cl);
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

                {/* Step 3: concepts (many, optional) */}
                {chosenChapters.length > 0 && (
                    <section className="mt-4 bg-white rounded-xl border border-slate-200 p-5">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <h2 className="font-semibold text-slate-900">4. Concepts <span className="font-normal text-slate-500 text-sm">(optional)</span></h2>
                            <span className="text-xs text-slate-500">{topicIds.length ? `${topicIds.length} selected` : "All concepts"}</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                            Leave a chapter with nothing ticked to get questions from all of its concepts.
                        </p>
                        {chosenChapters.map((c) => {
                            const topics = topicsByChapter[c._id];
                            const list = topicsOf(c._id);
                            const picked = list.filter((t) => topicIds.includes(t._id)).length;
                            return (
                                <details key={c._id} className="mt-3 rounded-lg border border-slate-200" open={chosenChapters.length <= 2}>
                                    <summary className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2.5 text-sm">
                                        <span className="font-medium text-slate-800">{c.name}</span>
                                        <span className="text-xs text-slate-500 shrink-0">{picked ? `${picked} of ${list.length}` : "All concepts"}</span>
                                    </summary>
                                    <div className="px-3 pb-3">
                                        {topics === "loading" || topics === undefined ? (
                                            <p className="text-sm text-slate-500">Loading concepts...</p>
                                        ) : list.length === 0 ? (
                                            <p className="text-sm text-slate-500">No concepts in this chapter.</p>
                                        ) : (
                                            <>
                                                <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-2.5"><span className="text-xs text-slate-500">Tick the concepts you want</span><div className="flex gap-4 shrink-0">
                                                    <button type="button" className={smallBtn} onClick={() => setChapterTopics(c._id, true)}>Select all</button>
                                                    <button type="button" className={smallBtn} onClick={() => setChapterTopics(c._id, false)}>Clear</button>
                                                </div></div>
                                                <div className="grid sm:grid-cols-2 gap-2 mt-2">
                                                    {list.map((t) => (
                                                        <Tick key={t._id} checked={topicIds.includes(t._id)} onChange={() => toggleTopic(t._id)} title={t.name} />
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </details>
                            );
                        })}
                    </section>
                )}

                {/* Step 4: settings and start */}
                {chosenChapters.length > 0 && (
                    <>
                        <section className="mt-4 bg-white rounded-xl border border-slate-200 p-5">
                            <h2 className="font-semibold text-slate-900">4. Settings</h2>

                            <p className="text-sm text-slate-500 mt-3">Difficulty</p>
                            <div className="mt-2">
                                <DifficultyPicker value={difficulty} onChange={setDifficulty} mix={mix} onMixChange={setMix} total={count} />
                            </div>

                            <p className="text-sm text-slate-500 mt-4">Number of questions</p>
                            <div className="flex flex-wrap gap-2 mt-2">
                                {COUNTS.map((n) => (
                                    <button key={n} onClick={() => setCount(n)} className={pillClass(n === count)}>
                                        {n}
                                    </button>
                                ))}
                            </div>
                            <p className="text-xs text-slate-500 mt-3">
                                Questions are mixed from all the chapters you picked. If there are fewer, you get all of them.
                            </p>
                        </section>

                        <button
                            onClick={startPractice}
                            disabled={starting}
                            className="mt-6 w-full rounded-lg bg-indigo-600 text-white font-medium py-3 hover:bg-indigo-700 disabled:opacity-60"
                        >
                            {starting ? "Preparing questions..." : `Start practice (${chosenChapters.length} chapter${chosenChapters.length > 1 ? "s" : ""})`}
                        </button>
                    </>
                )}
            </main>
        </div>
    );
}