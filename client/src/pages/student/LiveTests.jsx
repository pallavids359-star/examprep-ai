import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api, { getErrorMessage } from "../../api/axios";
import { useExam } from "../../context/ExamContext";
import { PageHeader } from "../../components/ui";
import { fmtDateTime, fmtUntil } from "../../components/liveHelpers";

// Full screen must be asked for inside the click, before the test page opens
const goFullScreen = () => {
  const el = document.documentElement;
  if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen().catch(() => {});
};

// Live tests set by the lecturers: open now, coming up and finished
export default function LiveTests() {
  const { examId, exam } = useExam();
  const navigate = useNavigate();
  const [tests, setTests] = useState(null);
  const [error, setError] = useState("");
  const [chosen, setChosen] = useState(null);
  const [starting, setStarting] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!examId) return;
    setTests(null);
    api
      .get("/live-tests", { params: { examId } })
      .then((res) => setTests(res.data.tests))
      .catch((err) => setError(getErrorMessage(err)));
  }, [examId]);

  // Keeps "closes in ..." fresh
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const begin = async () => {
    setStarting(true);
    setError("");
    goFullScreen();
    try {
      const res = await api.post(`/live-tests/${chosen._id}/start`);
      navigate(`/attempt/${res.data.attemptId}`);
    } catch (err) {
      if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
      setError(getErrorMessage(err));
      setStarting(false);
      setChosen(null);
    }
  };

  const list = tests || [];
  const open = list.filter((t) => t.state === "open" || t.state === "in_progress");
  const upcoming = list.filter((t) => t.state === "upcoming").sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
  const done = list.filter((t) => t.state === "finished" || t.state === "missed");
  const minutesLeft = (t) => Math.max(0, Math.min(t.durationMinutes, Math.floor((new Date(t.endsAt).getTime() - now) / 60000)));

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:py-8">
      <PageHeader eyebrow={`${exam?.code || ""} · set by your lecturers`} title="Live tests" subtitle="Take each test any time while it is open. Once you start, the timer runs until you submit." />
      {error && <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {!tests && !error && <p className="mt-6 text-sm text-slate-500">Loading...</p>}
      {tests && tests.length === 0 && (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">No live tests for {exam?.code} yet. Your lecturers will schedule them here.</div>
      )}

      {open.map((t) => (
        <section key={t._id} className="mt-6 flex flex-wrap items-center justify-between gap-5 rounded-2xl bg-slate-900 p-6 text-white">
          <div className="min-w-0 space-y-1">
            <span className="inline-block rounded-full bg-green-600 px-2.5 py-0.5 text-xs font-semibold">{t.state === "in_progress" ? "● You started this" : "● Open now"}</span>
            <h2 className="text-xl font-bold">{t.title}</h2>
            <p className="text-sm text-slate-300">
              {t.sections.map((s) => s.name).join(" · ")} · {t.totalQuestions} questions · {t.durationMinutes} min · +{t.markingScheme?.correct ?? 4} / {t.markingScheme?.incorrect ?? -1}
            </p>
            <p className="text-sm text-amber-300">
              Closes {fmtUntil(t.endsAt, now)} · {fmtDateTime(t.endsAt)}
              {t.state === "open" && minutesLeft(t) < t.durationMinutes && ` · start now and you get ${minutesLeft(t)} min`}
            </p>
          </div>
          {t.state === "in_progress" ? (
            <Link to={`/attempt/${t.attemptId}`} className="rounded-xl bg-amber-300 px-6 py-3 font-semibold text-slate-900 hover:bg-amber-200">
              Continue test
            </Link>
          ) : (
            <button type="button" onClick={() => setChosen(t)} className="rounded-xl bg-amber-300 px-6 py-3 font-semibold text-slate-900 hover:bg-amber-200">
              Start test
            </button>
          )}
        </section>
      ))}

      {upcoming.length > 0 && (
        <section className="mt-8">
          <h2 className="font-semibold text-slate-900">Coming up</h2>
          <div className="mt-3 space-y-3">
            {upcoming.map((t) => (
              <div key={t._id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5">
                <div>
                  <p className="font-semibold text-slate-900">{t.title}</p>
                  <p className="text-sm text-slate-500">
                    Opens {fmtDateTime(t.startsAt)} · closes {fmtDateTime(t.endsAt)} · {t.totalQuestions} questions · {t.durationMinutes} min
                  </p>
                </div>
                <span className="text-sm font-medium text-slate-600">Opens {fmtUntil(t.startsAt, now)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {done.length > 0 && (
        <section className="mt-8">
          <h2 className="font-semibold text-slate-900">Finished</h2>
          <div className="mt-3 space-y-3">
            {done.map((t) => (
              <div key={t._id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5">
                <div>
                  <p className="font-semibold text-slate-900">{t.title}</p>
                  <p className="text-sm text-slate-500">
                    {t.state === "missed"
                      ? "Missed: the test closed before you started"
                      : t.resultsReady && t.result
                        ? `Score ${t.result.score} / ${t.result.maxScore} · ${t.result.percentage}%${t.rank ? ` · Rank ${t.rank.rank} of ${t.rank.totalCandidates}` : ""}`
                        : `Submitted. Results on ${fmtDateTime(t.endsAt)}, when the test closes.`}
                  </p>
                </div>
                {(t.state === "missed" || t.resultsReady) && (
                  <Link to={`/live-tests/${t._id}/report`} className="rounded-lg border border-indigo-500 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50">
                    {t.state === "missed" ? "See questions and answers" : "View full report"}
                  </Link>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {chosen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6" role="dialog" aria-modal="true" aria-labelledby="live-rules-title">
            <h2 id="live-rules-title" className="text-xl font-bold text-slate-900">
              {chosen.title}
            </h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-700">
              <li>
                {chosen.totalQuestions} questions ({chosen.sections.map((s) => `${s.name} ${s.questions}`).join(", ")}). You have{" "}
                <b>{minutesLeft(chosen)} minutes</b>
                {minutesLeft(chosen) < chosen.durationMinutes ? " because the test closes soon" : ""}.
              </li>
              <li>
                +{chosen.markingScheme?.correct ?? 4} for a correct answer, {chosen.markingScheme?.incorrect ?? -1} for a wrong one, 0 if left blank.
              </li>
              <li>You can take this test only once. The timer keeps running even if you close the page.</li>
              <li>{chosen.showResults === "after_submit" ? "You see your result right after you submit." : `Results and your rank come out when the test closes (${fmtDateTime(chosen.endsAt)}).`}</li>
            </ul>
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <p className="font-semibold">Exam rules</p>
              <ul className="mt-2 list-disc space-y-1.5 pl-5">
                <li>The test opens in full screen. Do not leave it.</li>
                <li>Do not switch tabs or apps. Each time you do, you get a warning.</li>
                <li>
                  After <b>3 warnings</b> your test is <b>submitted automatically</b>.
                </li>
                <li>Copying, pasting and right-click are turned off.</li>
              </ul>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setChosen(null)} disabled={starting} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">
                Cancel
              </button>
              <button type="button" onClick={begin} disabled={starting} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
                {starting ? "Starting..." : "I agree, start the test"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
