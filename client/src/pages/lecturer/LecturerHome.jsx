import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { getErrorMessage } from "../../api/axios";
import LecturerLayout from "../../components/LecturerLayout";
import { useAuth } from "../../context/AuthContext";
import { PHASE, fmtDateTime } from "../../components/liveHelpers";
import { Countdown, Hero, ICONS, Ring, Stat } from "../../components/premium";

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

// A lecturer's sections across live tests
export default function LecturerHome() {
  const { user } = useAuth();
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/lecturer/sections")
      .then((res) => setItems(res.data.sections))
      .catch((err) => setError(getErrorMessage(err)));
  }, []);

  const isFull = (i) => i.section.mcqPicked === i.section.mcqCount && i.section.numericalPicked === i.section.numericalCount;
  const isSent = (i) => i.section.picker !== "lecturer" || Boolean(i.section.submittedAt);
  const todo = (items || []).filter((i) => (!isFull(i) || !isSent(i)) && (i.phase === "draft" || i.phase === "scheduled"));
  const rest = (items || []).filter((i) => !todo.includes(i));
  const left = todo.reduce((a, i) => a + i.section.mcqCount + i.section.numericalCount - i.section.mcqPicked - i.section.numericalPicked, 0);
  const next = todo.slice().sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))[0];
  const firstName = (user?.name || "").split(" ")[0];

  return (
    <LecturerLayout>
      <main className="mx-auto max-w-[1600px] px-4 py-6 md:px-8 md:py-8">
        <Hero
          eyebrow="Lecturer"
          title={`${greeting()}${firstName ? `, ${firstName}` : ""}`}
          subtitle={
            todo.length
              ? `You have ${todo.length} subject${todo.length === 1 ? "" : "s"} to finish. Pick the questions, check them, then press "Send to head lecturer".`
              : "You're all caught up. New subjects show up here when the head lecturer adds you to a live test."
          }
          right={
            next ? (
              <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-amber-200/20">
                <p className="mb-2 text-xs font-bold uppercase tracking-widest text-amber-200/70">Next test opens in</p>
                <Countdown to={next.startsAt} compact />
                <Link to={`/lecturer/tests/${next.testId}/${next.section.key}`} className="gp-gold-btn mt-4 block px-4 py-2.5 text-center text-sm">
                  Pick {next.section.name} questions →
                </Link>
              </div>
            ) : null
          }
        />

        {items && items.length > 0 && (
          <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-3">
            <Stat label="To do" value={todo.length} sub="subjects to fill" icon={ICONS.book} accent />
            <Stat label="Questions left" value={left} sub="across those subjects" icon={ICONS.target} />
            <Stat label="Done" value={rest.length} sub="subjects finished" icon={ICONS.check} />
          </div>
        )}

        {error && <div className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {!items && !error && (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {[0, 1].map((i) => (
              <div key={i} className="gp-card h-40 animate-pulse bg-white/60" />
            ))}
          </div>
        )}
        {items && items.length === 0 && (
          <div className="gp-card mt-6 grid place-items-center px-6 py-14 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-amber-50 text-amber-700">
              <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={ICONS.sparkle} />
              </svg>
            </span>
            <h2 className="mt-4 text-xl font-bold text-slate-900">Nothing assigned yet</h2>
            <p className="mt-1 max-w-md text-sm text-slate-500">When the head lecturer gives you a subject in a live test, it appears here.</p>
          </div>
        )}

        {todo.length > 0 && <SectionList title="To do" items={todo} />}
        {rest.length > 0 && <SectionList title="Done" items={rest} />}
      </main>
    </LecturerLayout>
  );
}

function SectionList({ title, items }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        {items.map((i) => {
          const s = i.section;
          const total = s.mcqCount + s.numericalCount;
          const picked = s.mcqPicked + s.numericalPicked;
          const done = picked === total;
          const sent = s.picker !== "lecturer" || Boolean(s.submittedAt);
          const ph = PHASE[i.phase] || PHASE.draft;
          return (
            <Link key={`${i.testId}-${s.key}`} to={`/lecturer/tests/${i.testId}/${s.key}`} className="gp-card gp-card-hover flex items-center gap-5 p-5">
              <Ring value={total ? (picked / total) * 100 : 0} size={78} tone={done && sent ? "green" : "gold"} label={done && sent ? "✓" : `${picked}/${total}`} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="gp-chip">{i.exam}</span>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${ph.cls}`}>
                    {i.phase === "open" && <span className="gp-live-dot" />}
                    {ph.label}
                  </span>
                </div>
                <p className="mt-1.5 text-lg font-bold text-slate-900">{s.name}</p>
                <p className="truncate text-sm text-slate-600">{i.title}</p>
                {s.returnedAt && !s.submittedAt && (
                  <p className="mt-1 rounded-lg bg-orange-50 px-2 py-1 text-xs text-orange-900">Sent back for changes{s.returnNote ? `: “${s.returnNote}”` : ""}</p>
                )}
                <p className="mt-1 text-xs text-slate-500">
                  {s.mcqPicked}/{s.mcqCount} MCQ{s.numericalCount ? ` · ${s.numericalPicked}/${s.numericalCount} numerical` : ""} · opens {fmtDateTime(i.startsAt)}
                </p>
              </div>
              <span className={`hidden shrink-0 text-sm font-semibold sm:block ${done && sent ? "text-green-700" : "text-amber-800"}`}>
                {!done ? "Pick →" : !sent ? "Check & send →" : "Sent ✓"}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
