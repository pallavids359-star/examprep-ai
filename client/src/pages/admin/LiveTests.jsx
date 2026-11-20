import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { getErrorMessage } from "../../api/axios";
import AdminLayout from "../../components/AdminLayout";
import { PHASE, fmtDateTime } from "../../components/liveHelpers";

// Head lecturer: every live test with where it stands
export default function LiveTests() {
  const [tests, setTests] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/admin/live-tests")
      .then((res) => setTests(res.data.tests))
      .catch((err) => setError(getErrorMessage(err)));
  }, []);

  return (
    <AdminLayout
      title="Live tests"
      actions={
        <Link to="/admin/live-tests/new" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
          + New live test
        </Link>
      }
    >
      <p className="text-sm text-slate-500">
        Set the time window, give each subject to a lecturer, review their questions and publish. Students can start any time while the test is open.
      </p>
      {error && <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {!tests && !error && <p className="mt-6 text-sm text-slate-500">Loading...</p>}
      {tests && tests.length === 0 && (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
          No live tests yet.{" "}
          <Link to="/admin/live-tests/new" className="font-semibold text-indigo-700 hover:underline">
            Create the first one
          </Link>
        </div>
      )}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {(tests || []).map((t) => {
          const ph = PHASE[t.phase] || PHASE.draft;
          const handedIn = t.sections.filter((s) => s.submittedAt).length;
          return (
            <div key={t._id} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-500">{t.exam}</p>
                  <h2 className="font-semibold text-slate-900">{t.title}</h2>
                </div>
                <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ${ph.cls}`}>{ph.label}</span>
              </div>
              <p className="mt-2 text-sm text-slate-600">
                {fmtDateTime(t.startsAt)} → {fmtDateTime(t.endsAt)} · {t.durationMinutes} min · {t.totalQuestions} questions
              </p>
              <ul className="mt-3 space-y-1 text-sm">
                {t.sections.map((s) => (
                  <li key={s.key} className="flex justify-between gap-3">
                    <span className="text-slate-800">
                      {s.name} · <span className="text-slate-500">{s.lecturer?.name || "no lecturer"}</span>
                    </span>
                    <span className={s.submittedAt ? "font-medium text-green-700" : "text-slate-500"}>
                      {s.submittedAt ? "Handed in" : `${s.picked}/${s.mcqCount + s.numericalCount}`}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 text-sm">
                <span className="text-slate-500">
                  {t.status === "draft" ? `${handedIn} of ${t.sections.length} sections handed in` : `${t.finished} finished · ${t.started - t.finished} writing now`}
                </span>
                <span className="flex gap-4">
                  <Link to={`/admin/live-tests/${t._id}`} className="font-semibold text-indigo-700 hover:underline">
                    {t.status === "draft" ? "Review" : "Open"}
                  </Link>
                  {t.status !== "draft" && (
                    <Link to={`/admin/live-tests/${t._id}/results`} className="font-semibold text-indigo-700 hover:underline">
                      Results
                    </Link>
                  )}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </AdminLayout>
  );
}
