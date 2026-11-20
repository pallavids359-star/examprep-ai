import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { getErrorMessage } from "../../api/axios";
import LecturerLayout from "../../components/LecturerLayout";
import { PHASE, fmtDateTime } from "../../components/liveHelpers";

// A lecturer's sections across live tests
export default function LecturerHome() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/lecturer/sections")
      .then((res) => setItems(res.data.sections))
      .catch((err) => setError(getErrorMessage(err)));
  }, []);

  const todo = (items || []).filter((i) => i.status === "draft" && !i.section.submittedAt);
  const rest = (items || []).filter((i) => !(i.status === "draft" && !i.section.submittedAt));

  return (
    <LecturerLayout>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-700">Live tests</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900 md:text-3xl">Your sections</h1>
        <p className="mt-1 text-slate-500">Pick the questions for each section the head lecturer gave you, then hand it in.</p>

        {error && <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {!items && !error && <p className="mt-6 text-sm text-slate-500">Loading...</p>}
        {items && items.length === 0 && (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
            No sections yet. When the head lecturer adds you to a live test, it shows up here.
          </div>
        )}

        {todo.length > 0 && <SectionList title="To do" items={todo} />}
        {rest.length > 0 && <SectionList title="Handed in and published" items={rest} />}
      </main>
    </LecturerLayout>
  );
}

function SectionList({ title, items }) {
  return (
    <section className="mt-8">
      <h2 className="font-semibold text-slate-900">{title}</h2>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {items.map((i) => {
          const s = i.section;
          const total = s.mcqCount + s.numericalCount;
          const picked = s.mcqPicked + s.numericalPicked;
          const ph = PHASE[i.phase] || PHASE.draft;
          return (
            <Link
              key={`${i.testId}-${s.key}`}
              to={`/lecturer/tests/${i.testId}/${s.key}`}
              className="block rounded-2xl border border-slate-200 bg-white p-5 hover:border-indigo-400"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-500">{i.exam}</p>
                  <p className="font-semibold text-slate-900">{i.title}</p>
                </div>
                <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ${ph.cls}`}>{ph.label}</span>
              </div>
              <p className="mt-3 text-sm text-slate-700">
                <b>{s.name}</b> · {picked} of {total} picked ({s.mcqPicked}/{s.mcqCount} MCQ
                {s.numericalCount ? `, ${s.numericalPicked}/${s.numericalCount} numerical` : ""})
              </p>
              <div className="mt-2 h-2 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-indigo-600" style={{ width: `${total ? Math.round((picked / total) * 100) : 0}%` }} />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {s.submittedAt ? `Handed in ${fmtDateTime(s.submittedAt)}` : s.dueAt ? `Due ${fmtDateTime(s.dueAt)}` : "No due time"} · Test opens {fmtDateTime(i.startsAt)}
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
