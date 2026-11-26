import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api, { getErrorMessage } from "../../api/axios";
import { useExam } from "../../context/ExamContext";
import { Countdown, Ring } from "../../components/premium";
import { fmtDateTime } from "../../components/liveHelpers";
import { rowLink } from "../../components/uiHelpers";

// Full screen must be asked for inside the click, before the test page opens
const goFullScreen = () => {
  const el = document.documentElement;
  if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen().catch(() => {});
};

// Live tests set by the lecturers: open now, coming up and finished
export default function LiveTests() {
  const { examId, exam, setExamId } = useExam();
  const [others, setOthers] = useState([]);
  const navigate = useNavigate();
  const [tests, setTests] = useState(null);
  const [error, setError] = useState("");
  const [chosen, setChosen] = useState(null);
  const [starting, setStarting] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!examId) return;
    setTests(null);
    api
      .get("/live-tests", { params: { examId } })
      .then((res) => {
        setTests(res.data.tests);
        setOthers(res.data.others || []);
      })
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
    <div className="mx-auto max-w-[1600px] px-4 py-6 md:py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">{exam?.code} · set by your lecturers</p>
          <h1 className="mt-1 text-3xl font-extrabold text-slate-900 md:text-4xl">Live tests</h1>
          <p className="mt-1 text-slate-500">Take each test any time while it's open. Once you start, the clock runs until you submit.</p>
        </div>
      </div>
      {error && <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {!tests && !error && (
        <div className="mt-6 space-y-4" aria-hidden="true">
          <div className="h-48 animate-pulse rounded-3xl bg-slate-200/60" />
          <div className="h-24 animate-pulse rounded-2xl bg-slate-200/60" />
        </div>
      )}
      {others.length > 0 && (
        <div className="mt-6 space-y-3">
          {others.map((o) => (
            <div key={o.examId} className="gp-card flex flex-wrap items-center justify-between gap-3 border-amber-300 p-4">
              <p className="flex items-center gap-2 text-sm text-slate-700">
                {o.open > 0 && <span className="gp-live-dot" />}
                <span>
                  <b className="text-slate-900">{o.code}</b> has {o.open > 0 ? `${o.open} live test${o.open > 1 ? "s" : ""} open now` : `${o.upcoming} live test${o.upcoming > 1 ? "s" : ""} coming up`}
                  {o.open > 0 && o.upcoming > 0 ? ` and ${o.upcoming} coming up` : ""}. You're looking at {exam?.code}.
                </span>
              </p>
              <button type="button" onClick={() => setExamId(o.examId)} className="gp-gold-btn px-4 py-2 text-sm">
                Switch to {o.code} →
              </button>
            </div>
          ))}
        </div>
      )}

      {tests && tests.length === 0 && (
        <div className="gp-card mt-6 p-10 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-50 text-amber-700">
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M8 3v3M16 3v3M4 8h16M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z" />
            </svg>
          </div>
          <p className="mt-4 text-lg font-bold text-slate-900">No live tests yet</p>
          <p className="mt-1 text-slate-500">When your lecturers schedule a {exam?.code} live test, it shows up here with a countdown.</p>
        </div>
      )}

      {/* Open now */}
      {open.map((t) => (
        <section key={t._id} className="gp-hero mt-6 p-6 md:p-8">
          <div className="relative flex flex-wrap items-center justify-between gap-6">
            <div className="min-w-0 max-w-xl">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white ring-1 ring-white/15">
                <span className="gp-live-dot" /> {t.state === "in_progress" ? "You're writing this" : "Live now"}
              </span>
              <h2 className="mt-3 text-2xl font-extrabold text-white md:text-3xl">{t.title}</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {t.sections.map((s) => (
                  <span key={s.name} className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-amber-100 ring-1 ring-white/10">
                    {s.name} · {s.questions}
                  </span>
                ))}
              </div>
              <p className="gp-muted mt-3 text-sm">
                {t.totalQuestions} questions · {t.durationMinutes} min · +{t.markingScheme?.correct ?? 4} / {t.markingScheme?.incorrect ?? -1}
                {t.state === "open" && minutesLeft(t) < t.durationMinutes && ` · start now and you get ${minutesLeft(t)} min`}
              </p>
            </div>
            <div className="flex flex-col items-start gap-4 md:items-end">
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-widest text-amber-200/80">Closes in</p>
                <Countdown to={t.endsAt} />
              </div>
              {t.state === "in_progress" ? (
                <Link to={`/attempt/${t.attemptId}`} className="gp-gold-btn px-7 py-3.5 text-base">
                  Continue test →
                </Link>
              ) : (
                <button type="button" onClick={() => setChosen(t)} className="gp-gold-btn px-7 py-3.5 text-base">
                  Start test →
                </button>
              )}
            </div>
          </div>
        </section>
      ))}

      {/* Coming up */}
      {upcoming.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-bold text-slate-900">Coming up</h2>
          <div className="mt-3 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {upcoming.map((t) => (
              <div key={t._id} className="gp-card gp-card-hover p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-amber-700">Opens {fmtDateTime(t.startsAt)}</p>
                <p className="mt-1 text-lg font-bold text-slate-900">{t.title}</p>
                <p className="text-sm text-slate-500">
                  {t.totalQuestions} questions · {t.durationMinutes} min · open until {fmtDateTime(t.endsAt)}
                </p>
                <div className="mt-4">
                  <Countdown to={t.startsAt} dark={false} compact />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Finished */}
      {done.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-bold text-slate-900">Finished</h2>
          <div className="mt-3 space-y-3">
            {done.map((t) => (
              <div
                key={t._id}
                {...rowLink(navigate, t.state === "missed" || t.resultsReady ? `/live-tests/${t._id}/report` : null)}
                className={`gp-card flex flex-wrap items-center gap-5 p-5 ${t.state === "missed" || t.resultsReady ? "cursor-pointer transition hover:-translate-y-0.5 hover:shadow-lg" : ""}`}
              >
                {t.state === "missed" ? (
                  <span className="grid h-16 w-16 place-items-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">Missed</span>
                ) : t.resultsReady && t.result ? (
                  <Ring value={t.result.percentage} size={64} />
                ) : (
                  <span className="grid h-16 w-16 place-items-center rounded-full bg-amber-50 text-center text-[10px] font-bold leading-tight text-amber-700">
                    Result
                    <br />
                    soon
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-900">{t.title}</p>
                  <p className="text-sm text-slate-500">
                    {t.state === "missed"
                      ? "The test closed before you started. You can still see its questions and answers."
                      : t.resultsReady && t.result
                        ? `${t.result.score} / ${t.result.maxScore} marks`
                        : `Submitted ✓ Results on ${fmtDateTime(t.endsAt)}, when the test closes.`}
                  </p>
                </div>
                {t.rank && (
                  <span className="gp-chip bg-slate-900 text-amber-200">
                    Rank {t.rank.rank} of {t.rank.totalCandidates}
                  </span>
                )}
                {(t.state === "missed" || t.resultsReady) && (
                  <Link to={`/live-tests/${t._id}/report`} className="rounded-xl border border-amber-400 px-4 py-2 text-sm font-bold text-amber-800 hover:bg-amber-50">
                    {t.state === "missed" ? "See answers" : "Full report →"}
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
