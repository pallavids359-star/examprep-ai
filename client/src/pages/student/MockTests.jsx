import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PageHeader } from "../../components/ui";
import api, { getErrorMessage } from "../../api/axios";
import MockSetup from "../../components/MockSetup";
import { toast } from "../../components/Toaster";

// The real paper pattern (the server uses the same numbers)
const PATTERNS = {
    NEET: { tag: "Medical entrance", minutes: 180, parts: [["Physics", 45], ["Chemistry", 45], ["Biology", 90]] },
    JEE: { tag: "Engineering entrance", minutes: 180, parts: [["Physics", 25], ["Chemistry", 25], ["Maths", 25]] },
    KCET_PCM: { tag: "Karnataka CET", minutes: 240, parts: [["Physics", 60], ["Chemistry", 60], ["Maths", 60]] },
    KCET_PCB: { tag: "Karnataka CET", minutes: 240, parts: [["Physics", 60], ["Chemistry", 60], ["Biology", 60]] },
    KCET_PCMB: { tag: "Karnataka CET", minutes: 320, parts: [["Physics", 60], ["Chemistry", 60], ["Maths", 60], ["Biology", 60]] },
};
const patternOf = (code, stream) => PATTERNS[code === "KCET" ? `KCET_${stream}` : code];
const total = (p) => p.parts.reduce((a, [, n]) => a + n, 0);
const hours = (m) => (m % 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m / 60} hours`);

// Full screen must be asked for straight after a click
const goFullScreen = () => {
    const el = document.documentElement;
    const fn = el.requestFullscreen || el.webkitRequestFullscreen;
    if (fn) {
        try {
            const p = fn.call(el);
            if (p && p.catch) p.catch(() => {});
        } catch {
            /* phone browsers may not allow it */
        }
    }
};

export default function MockTests() {
    const navigate = useNavigate();
    const [exams, setExams] = useState([]);
    const [mine, setMine] = useState([]);
    const [stream, setStream] = useState("PCMB");
    const [setupFor, setSetupFor] = useState(null); // exam whose setup (chapters, difficulty) is open
    const [filters, setFilters] = useState(null); // choices from the setup
    const [chosen, setChosen] = useState(null); // exam whose instructions are open
    const [starting, setStarting] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        Promise.all([api.get("/exams"), api.get("/tests/mine")])
            .then(([e, m]) => {
                setExams(e.data.exams.filter((x) => ["NEET", "JEE", "KCET"].includes(x.code)));
                setMine(m.data.mocks);
            })
            .catch((err) => setError(getErrorMessage(err)))
            .finally(() => setLoading(false));
    }, []);

    const inProgress = mine.find((m) => m.inProgress);

    const begin = async () => {
        setStarting(true);
        setError("");
        goFullScreen();
        try {
            const res = await api.post("/tests/generate", {
                examId: chosen._id,
                stream,
                chapterIds: filters?.chapterIds || [],
                topicIds: filters?.topicIds || [],
                difficulty: filters?.difficulty || "any",
                mix: filters?.mix || undefined,
                classLevel: filters?.classLevel || "both",
            });
            (res.data.notes || []).forEach((n) => toast(n, "error"));
            navigate(`/attempt/${res.data.attemptId}`);
        } catch (err) {
            if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
            setError(getErrorMessage(err));
            setStarting(false);
            setChosen(null);
        }
    };

    const chosenPattern = chosen ? patternOf(chosen.code, stream) : null;

    return (
        <div className="bg-slate-50">
            <main className="max-w-6xl mx-auto px-4 py-6 md:py-8">
                <PageHeader eyebrow="Full-length tests" title="Mock tests" subtitle="Pick an exam and get a full test made just for you, with the real pattern and timer." />

                {error && <div className="mt-5 rounded-lg bg-red-50 text-red-700 text-sm px-4 py-3">{error}</div>}

                {inProgress && (
                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
                        <p className="text-sm text-slate-800">
                            You have a test in progress: <b>{inProgress.title}</b>
                        </p>
                        <Link
                            to={`/attempt/${inProgress.attemptId}`}
                            onClick={goFullScreen}
                            className="rounded-lg bg-indigo-600 text-white text-sm font-semibold px-4 py-2 hover:bg-indigo-700"
                        >
                            Resume test
                        </Link>
                    </div>
                )}

                {loading && <p className="mt-6 text-slate-500">Loading...</p>}

                {setupFor && patternOf(setupFor.code, stream) && (
                    <div className="mt-6 max-w-3xl">
                        <MockSetup
                            key={`${setupFor._id}-${stream}`}
                            exam={setupFor}
                            stream={stream}
                            parts={patternOf(setupFor.code, stream).parts}
                            minutes={patternOf(setupFor.code, stream).minutes}
                            onBack={() => setSetupFor(null)}
                            onContinue={(f) => {
                                setFilters(f);
                                setChosen(setupFor);
                            }}
                        />
                    </div>
                )}

                <div className={`mt-6 grid gap-4 md:grid-cols-3 ${setupFor ? "hidden" : ""}`}>
                    {exams.map((e) => {
                        const p = patternOf(e.code, stream);
                        if (!p) return null;
                        return (
                            <article key={e._id} className="flex flex-col rounded-2xl bg-white border border-slate-200 p-5 hover:border-indigo-300 hover:shadow-md transition">
                                <p className="text-xs font-medium text-slate-500">{p.tag}</p>
                                <h2 className="mt-1 text-2xl font-bold text-slate-900">{e.code}</h2>

                                {e.code === "KCET" && (
                                    <div className="mt-3 flex gap-2" role="group" aria-label="KCET stream">
                                        {["PCMB", "PCM", "PCB"].map((s) => (
                                            <button
                                                key={s}
                                                type="button"
                                                onClick={() => setStream(s)}
                                                className={`rounded-lg border px-3 py-1 text-xs font-semibold ${stream === s ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-slate-300 text-slate-600"}`}
                                            >
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                <ul className="mt-4 space-y-1.5 text-sm text-slate-700">
                                    {p.parts.map(([name, n]) => (
                                        <li key={name} className="flex justify-between">
                                            <span>{name}</span>
                                            <span className="font-medium">{n} Qs</span>
                                        </li>
                                    ))}
                                </ul>
                                <div className="mt-auto pt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                                    <span>{total(p)} questions</span>
                                    <span>{hours(p.minutes)}</span>
                                    <span>
                                        +{e.markingScheme?.correct ?? 4} / {e.markingScheme?.incorrect ?? -1}
                                    </span>
                                </div>
                                <button
                                    onClick={() => setSetupFor(e)}
                                    disabled={Boolean(inProgress)}
                                    className="mt-5 rounded-lg bg-indigo-600 text-white text-sm font-semibold py-2.5 hover:bg-indigo-700 disabled:opacity-50"
                                >
                                    {inProgress ? "Finish your current test first" : `Start ${e.code} mock`}
                                </button>
                            </article>
                        );
                    })}
                </div>
            </main>

            {/* Rules shown before starting */}
            {chosen && chosenPattern && (
                <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-40">
                    <div className="bg-white rounded-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-bold text-slate-900">
                            {chosen.code}
                            {chosen.code === "KCET" ? ` (${stream})` : ""} mock test
                        </h2>
                        <ul className="mt-4 space-y-2 text-sm text-slate-700 list-disc pl-5">
                            {filters?.scope === "chapters" ? (
                                <li>
                                    Up to {filters.maxQuestions} questions from your chosen chapters, about {filters.minutes} minutes. Questions come one by one.
                                </li>
                            ) : (
                                <li>
                                    {total(chosenPattern)} questions in {hours(chosenPattern.minutes)}. Questions come one by one.
                                </li>
                            )}
                            {["easy", "medium", "hard"].includes(filters?.difficulty) && <li>Only {filters.difficulty} questions.</li>}
                            {filters?.mix && <li>Difficulty: {filters.mix.easy}% easy, {filters.mix.medium}% medium, {filters.mix.hard}% hard.</li>}
                            <li>
                                +{chosen.markingScheme?.correct ?? 4} for a correct answer, {chosen.markingScheme?.incorrect ?? -1} for a wrong one, 0 if left blank.
                            </li>
                            <li>The timer keeps running even if you close the page. When time runs out, the test is submitted automatically.</li>
                        </ul>
                        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                            <p className="font-semibold">Exam rules</p>
                            <ul className="mt-2 space-y-1.5 list-disc pl-5">
                                <li>The test opens in full screen. Do not leave it.</li>
                                <li>Do not switch tabs or apps. Each time you do, you get a warning.</li>
                                <li>
                                    After <b>3 warnings</b> your test is <b>submitted automatically</b>.
                                </li>
                                <li>Copying, pasting and right-click are turned off.</li>
                            </ul>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => setChosen(null)}
                                disabled={starting}
                                className="rounded-lg border border-slate-300 text-slate-700 text-sm font-medium px-4 py-2"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={begin}
                                disabled={starting}
                                className="rounded-lg bg-indigo-600 text-white text-sm font-semibold px-4 py-2 hover:bg-indigo-700 disabled:opacity-60"
                            >
                                {starting ? "Making your test..." : "I agree, start the test"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}