import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import api, { getErrorMessage } from "../../api/axios";
import AdminLayout from "../../components/AdminLayout";
import { PHASE, fmtDateTime } from "../../components/liveHelpers";
import { askConfirm } from "../../components/ConfirmDialog";
import { toast } from "../../components/Toaster";
import { Countdown, Hero, ICONS, Ring, Stat } from "../../components/premium";

const TABS = [
  ["all", "All"],
  ["open", "Open now"],
  ["scheduled", "Scheduled"],
  ["draft", "Need questions"],
  ["closed", "Finished"],
];

// Head lecturer: every live test with where it stands
export default function LiveTests() {
  const [tests, setTests] = useState(null);
  const [deleting, setDeleting] = useState("");
  const [publishing, setPublishing] = useState("");

  const publish = async (t) => {
    if (!(await askConfirm(`Publish "${t.title}"? Students will see it and can write it from ${fmtDateTime(t.startsAt)}.`, { title: "Publish live test?", confirmText: "Publish" }))) return;
    setPublishing(t._id);
    try {
      await api.post(`/admin/live-tests/${t._id}/publish`);
      setTests((list) => list.map((x) => (x._id === t._id ? { ...x, status: "published", phase: new Date(x.startsAt) > new Date() ? "scheduled" : "open" } : x)));
      toast("Published. Students can see it now.");
    } catch (err) {
      toast(getErrorMessage(err), "error");
    } finally {
      setPublishing("");
    }
  };

  const removeTest = async (t) => {
    const ok = await askConfirm(
      t.phase === "draft" ? `Delete "${t.title}"? Its picked questions go too. This can't be undone.` : `Delete "${t.title}"? Students won't see it any more. Results of anyone who already wrote it are kept.`,
      { title: "Delete live test?", confirmText: "Delete", danger: true }
    );
    if (!ok) return;
    setDeleting(t._id);
    try {
      await api.delete(`/admin/live-tests/${t._id}`);
      setTests((list) => list.filter((x) => x._id !== t._id));
      toast("Deleted");
    } catch (err) {
      toast(getErrorMessage(err), "error");
    } finally {
      setDeleting("");
    }
  };
  const [error, setError] = useState("");
  const [tab, setTab] = useState("all");
  const listRef = useRef(null);
  // A number card shows its group of tests below (press again for All)
  const showTab = (k) => {
    setTab((cur) => (cur === k ? "all" : k));
    setTimeout(() => listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  useEffect(() => {
    api
      .get("/admin/live-tests")
      .then((res) => setTests(res.data.tests))
      .catch((err) => setError(getErrorMessage(err)));
  }, []);

  const counts = useMemo(() => {
    const list = tests || [];
    return {
      open: list.filter((t) => t.phase === "open").length,
      scheduled: list.filter((t) => t.phase === "scheduled").length,
      draft: list.filter((t) => t.phase === "draft").length,
      writers: list.reduce((a, t) => a + (t.finished || 0), 0),
    };
  }, [tests]);

  const shown = (tests || []).filter((t) =>
    tab === "all" ? true : tab === "open" || tab === "scheduled" ? t.phase === tab : tab === "draft" ? t.phase === "draft" : ["closed", "archived"].includes(t.phase)
  );

  const newBtn = (
    <Link to="/admin/live-tests/new" className="gp-gold-btn inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold">
      <span className="text-lg leading-none">+</span> New live test
    </Link>
  );

  return (
    <AdminLayout>
      <Hero
        eyebrow="Live tests"
        title="Run a test the whole batch writes"
        subtitle="Pick the day and time, let each subject fill itself or hand it to a lecturer, and then press Publish when every subject is ready."
        right={newBtn}
      />

      <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Open right now" value={counts.open} sub="students can start" icon={ICONS.bolt} accent onClick={() => showTab("open")} active={tab === "open"} />
        <Stat label="Scheduled" value={counts.scheduled} sub="ready, open by themselves" icon={ICONS.calendar} onClick={() => showTab("scheduled")} active={tab === "scheduled"} />
        <Stat label="Waiting for questions" value={counts.draft} sub="a subject is not full yet" icon={ICONS.book} onClick={() => showTab("draft")} active={tab === "draft"} />
        <Stat label="Papers written" value={counts.writers} sub="across every live test" icon={ICONS.users} onClick={() => showTab("closed")} active={tab === "closed"} />
      </div>

      {error && <div className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {tests && tests.length > 0 && (
        <div ref={listRef} className="mt-6 flex scroll-mt-4 flex-wrap gap-2" role="tablist">
          {TABS.map(([k, l]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${tab === k ? "bg-slate-900 text-amber-200" : "border border-slate-200 bg-white text-slate-600 hover:border-amber-300"}`}
            >
              {l}
            </button>
          ))}
        </div>
      )}

      {!tests && !error && (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="gp-card h-56 animate-pulse bg-white/60" />
          ))}
        </div>
      )}

      {tests && tests.length === 0 && (
        <div className="gp-card mt-6 grid place-items-center px-6 py-14 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-amber-50 text-amber-700">
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={ICONS.calendar} />
            </svg>
          </span>
          <h2 className="mt-4 text-xl font-bold text-slate-900">No live tests yet</h2>
          <p className="mt-1 max-w-md text-sm text-slate-500">Create one in under a minute — choose a day and time and let the questions fill themselves.</p>
          <div className="mt-5">{newBtn}</div>
        </div>
      )}

      {tests && tests.length > 0 && shown.length === 0 && (
        <p className="gp-card mt-4 px-5 py-8 text-center text-sm text-slate-500">
          {{ open: "No live test is open right now.", scheduled: "No live test is scheduled.", draft: "Every live test has its questions.", closed: "No live test has finished yet." }[tab] || "Nothing here."}{" "}
          <button type="button" onClick={() => setTab("all")} className="font-semibold text-[#9a7a2c] hover:underline">
            Show all
          </button>
        </p>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {shown.map((t) => {
          const ph = PHASE[t.phase] || PHASE.draft;
          const total = t.sections.reduce((a, s) => a + s.mcqCount + s.numericalCount, 0);
          const picked = t.sections.reduce((a, s) => a + Math.min(s.picked || 0, s.mcqCount + s.numericalCount), 0);
          const ready = total ? (picked / total) * 100 : 0;
          return (
            <article key={t._id} className="gp-card gp-card-hover relative flex flex-col p-5">
              <button
                type="button"
                onClick={() => removeTest(t)}
                disabled={deleting === t._id}
                title="Delete test"
                aria-label={`Delete ${t.title}`}
                className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6" />
                </svg>
              </button>
              <div className="flex items-start justify-between gap-3 pr-8">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="gp-chip">{t.exam}</span>
                    {t.college && <span className="gp-chip">{t.college}{t.audienceSections?.length ? ` · ${t.audienceSections.join(", ")}` : ""}</span>}
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${ph.cls}`}>
                      {t.phase === "open" && <span className="gp-live-dot" />}
                      {t.phase === "draft" ? (t.sections.every((s) => s.ready) ? "Ready to publish" : "Waiting for questions") : ph.label}
                    </span>
                  </div>
                  <h2 className="mt-2 truncate text-lg font-bold text-slate-900">{t.title}</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {fmtDateTime(t.startsAt)} → {fmtDateTime(t.endsAt)}
                  </p>
                  <p className="text-sm text-slate-500">
                    {t.durationMinutes} min · {t.totalQuestions} questions
                  </p>
                </div>
                {t.phase === "draft" ? (
                  <Ring value={ready} size={68} sub="ready" />
                ) : (
                  <div className="shrink-0 text-right">
                    <p className="font-display text-3xl font-extrabold tabular-nums text-slate-900">{t.finished || 0}</p>
                    <p className="text-xs text-slate-500">finished</p>
                  </div>
                )}
              </div>

              {(t.phase === "open" || t.phase === "scheduled") && (
                <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50/70 px-3 py-2 text-sm text-slate-700">
                  <span className="font-semibold">{t.phase === "open" ? "Closes in" : "Opens in"}</span>
                  <Countdown to={t.phase === "open" ? t.endsAt : t.startsAt} dark={false} compact />
                  {t.phase === "open" && t.started - t.finished > 0 && <span className="ml-auto text-xs text-green-700">{t.started - t.finished} writing now</span>}
                </div>
              )}

              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {t.sections.map((s) => {
                  const need = s.mcqCount + s.numericalCount;
                  const pct = need ? Math.min(100, ((s.picked || 0) / need) * 100) : 0;
                  return (
                    <li key={s.key} className="rounded-xl border border-slate-100 bg-white px-3 py-2">
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate font-semibold text-slate-800">{s.name}</span>
                        <span className={`text-xs font-semibold ${s.ready ? "text-green-700" : s.full ? "text-orange-700" : "text-slate-500"}`}>
                          {s.ready ? "Ready" : s.full ? "Not sent yet" : `${s.picked || 0}/${need}`}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-amber-100/70">
                        <div className={`h-full rounded-full ${s.ready ? "bg-green-600" : "bg-amber-500"}`} style={{ width: `${pct}%` }} />
                      </div>
                      <p className="mt-1 truncate text-xs text-slate-500">
                        {s.picker === "auto" ? "Filled automatically" : s.picker === "me" ? "Picked by you" : `${s.lecturer?.name || "Lecturer"}${s.picker === "lecturer" && !s.ready ? (s.full ? " · has to send it" : " · picking") : s.submittedAt ? " · sent ✓" : ""}`}
                      </p>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
                {t.phase === "draft" && t.sections.every((s) => s.ready) && (
                  <button type="button" onClick={() => publish(t)} disabled={publishing === t._id} className="gp-gold-btn px-5 py-2 text-sm disabled:opacity-60">
                    {publishing === t._id ? "Publishing…" : "Publish"}
                  </button>
                )}
                <Link to={`/admin/live-tests/${t._id}`} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-amber-200 hover:bg-black">
                  {t.phase === "draft" ? (t.sections.every((s) => s.ready) ? "Check questions" : "Finish setting up") : "Open"}
                </Link>
                {t.phase !== "archived" && (
                  <Link to={`/admin/live-tests/${t._id}/edit`} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-amber-300" title="Change the date, time or anything else">
                    ✎ Edit date & time
                  </Link>
                )}
                {t.status !== "draft" && (
                  <Link to={`/admin/live-tests/${t._id}/results`} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-amber-300">
                    Leaderboard
                  </Link>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </AdminLayout>
  );
}
