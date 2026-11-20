import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import { fmtUntil } from "./liveHelpers";

// Dashboard: tells the student when a live test is open (or about to open)
export default function LiveNowBanner({ examId }) {
  const [tests, setTests] = useState([]);

  useEffect(() => {
    if (!examId) return;
    api
      .get("/live-tests", { params: { examId } })
      .then((res) => setTests(res.data.tests))
      .catch(() => setTests([]));
  }, [examId]);

  const open = tests.find((t) => t.state === "open" || t.state === "in_progress");
  const soon = tests
    .filter((t) => t.state === "upcoming" && new Date(t.startsAt).getTime() - Date.now() < 48 * 3600e3)
    .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))[0];
  const t = open || soon;
  if (!t) return null;

  return (
    <section className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-slate-900 p-5 text-white">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">
          {open ? (t.state === "in_progress" ? "● You started a live test" : "● Live test open now") : "Live test coming up"}
        </p>
        <p className="mt-1 text-lg font-bold">{t.title}</p>
        <p className="text-sm text-slate-300">
          {open ? `Closes ${fmtUntil(t.endsAt)}` : `Opens ${fmtUntil(t.startsAt)}`} · {t.totalQuestions} questions · {t.durationMinutes} min
        </p>
      </div>
      <Link
        to={t.state === "in_progress" ? `/attempt/${t.attemptId}` : "/live-tests"}
        className="rounded-xl bg-amber-300 px-5 py-2.5 font-semibold text-slate-900 hover:bg-amber-200"
      >
        {t.state === "in_progress" ? "Continue" : open ? "Start now" : "See details"}
      </Link>
    </section>
  );
}
