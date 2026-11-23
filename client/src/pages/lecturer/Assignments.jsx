import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api, { getErrorMessage } from "../../api/axios";
import LecturerLayout from "../../components/LecturerLayout";
import { useAuth } from "../../context/AuthContext";
import { Hero, ICONS, Stat } from "../../components/premium";
import { fmtDateTime, fmtUntil } from "../../components/liveHelpers";
import { Pill, STATE, audienceText } from "../../components/assignmentHelpers";

const TABS = [
  ["all", "All"],
  ["draft", "Drafts"],
  ["published", "Published"],
  ["closed", "Past due"],
];

// A lecturer's assignments
export default function Assignments() {
  const { user } = useAuth();
  const [list, setList] = useState(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("all");

  useEffect(() => {
    api
      .get("/lecturer/assignments")
      .then((res) => setList(res.data.assignments))
      .catch((err) => setError(getErrorMessage(err)));
  }, []);

  const now = Date.now();
  const isPast = (a) => new Date(a.dueAt).getTime() < now;
  const shown = useMemo(
    () =>
      (list || []).filter((a) =>
        tab === "all" ? true : tab === "draft" ? a.status === "draft" : tab === "published" ? a.status === "published" && !isPast(a) : isPast(a)
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [list, tab]
  );
  const live = (list || []).filter((a) => a.status === "published" && !isPast(a)).length;
  const drafts = (list || []).filter((a) => a.status === "draft").length;
  const handedIn = (list || []).reduce((n, a) => n + a.submitted, 0);

  return (
    <LecturerLayout>
      <main className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
        <Hero
          eyebrow={user?.role === "admin" ? "All lecturers" : "Your class"}
          title="Assignments"
          subtitle="Choose the class, chapters, concepts, difficulty and question types. Check the questions, then publish to a college and its sections."
          right={
            <Link to="/lecturer/assignments/new" className="gp-gold-btn inline-flex items-center gap-2 px-5 py-3 text-sm">
              <span className="text-lg leading-none">+</span> New assignment
            </Link>
          }
        />

        {list && list.length > 0 && (
          <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-3">
            <Stat label="Open now" value={live} sub="students can answer" icon={ICONS.bolt} accent />
            <Stat label="Drafts" value={drafts} sub="waiting for you to publish" icon={ICONS.book} />
            <Stat label="Handed in" value={handedIn} sub="submissions so far" icon={ICONS.check} />
          </div>
        )}

        {error && <div className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        {list && list.length > 0 && (
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-slate-900">Your assignments</h2>
            <div className="inline-flex rounded-full bg-white p-1 ring-1 ring-[#e7dcc3]" role="tablist">
              {TABS.map(([k, l]) => (
                <button
                  key={k}
                  role="tab"
                  aria-selected={tab === k}
                  onClick={() => setTab(k)}
                  className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${tab === k ? "bg-[#17140f] text-[#e5c372]" : "text-slate-600 hover:text-slate-900"}`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        )}

        {!list && !error && (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="gp-card h-36 animate-pulse bg-white/60" />
            ))}
          </div>
        )}

        {list && list.length === 0 && (
          <div className="gp-card mt-6 grid place-items-center px-6 py-14 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-amber-50 text-amber-700">
              <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={ICONS.sparkle} />
              </svg>
            </span>
            <h2 className="mt-4 text-xl font-bold text-slate-900">No assignments yet</h2>
            <p className="mt-1 max-w-md text-sm text-slate-500">Make your first one in about a minute. You can check every question before students see it.</p>
            <Link to="/lecturer/assignments/new" className="gp-gold-btn mt-5 px-5 py-2.5 text-sm">
              Create an assignment
            </Link>
          </div>
        )}

        {list && list.length > 0 && shown.length === 0 && <p className="gp-card mt-4 px-5 py-8 text-center text-sm text-slate-500">Nothing here.</p>}

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {shown.map((a) => {
            const past = isPast(a);
            const st = a.status === "draft" ? STATE.draft : past ? { label: "Past due", cls: "bg-slate-100 text-slate-600 ring-slate-200" } : STATE.published;
            return (
              <Link key={a._id} to={`/lecturer/assignments/${a._id}`} className="gp-card gp-card-hover group flex flex-col p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="gp-chip">{a.exam}</span>
                  <span className="gp-chip">{a.subject}</span>
                  <Pill cls={st.cls}>{st.label}</Pill>
                </div>
                <p className="mt-2.5 text-lg font-bold leading-snug text-slate-900">{a.title}</p>
                <p className="mt-0.5 text-sm text-slate-500">
                  {audienceText(a)}
                  {user?.role === "admin" && a.createdBy ? ` · by ${a.createdBy}` : ""}
                </p>
                <div className="mt-4 flex items-end justify-between gap-3 border-t border-[#efe6d2] pt-3">
                  <div className="flex gap-5 text-sm">
                    <span>
                      <b className="font-display text-lg text-slate-900">{a.questions}</b> <span className="text-slate-500">questions</span>
                    </span>
                    {a.status === "published" && (
                      <span>
                        <b className="font-display text-lg text-slate-900">{a.submitted}</b> <span className="text-slate-500">handed in</span>
                      </span>
                    )}
                  </div>
                  <span className="text-right text-xs text-slate-500">
                    Due {fmtDateTime(a.dueAt)}
                    {!past && <span className="block font-semibold text-amber-800">{fmtUntil(a.dueAt)}</span>}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </main>
    </LecturerLayout>
  );
}
