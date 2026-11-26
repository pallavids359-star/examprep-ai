import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api, { getErrorMessage } from "../../api/axios";
import MathText from "../../components/MathText";
import { useExam } from "../../context/ExamContext";
import { Bone } from "../../components/Skeleton";
import { Bar, Card, CardTitle, Icon, PageHeader, Pct } from "../../components/ui";
import { ICONS, cx, round1, shortDate, toneText, when } from "../../components/uiHelpers";

const MODE_LABELS = { practice: "Practice", mock: "Mock test", wrong_answer_practice: "Wrong answers", bookmark_practice: "Bookmarks" };
const SESSION = 20; // questions per revision session

// A big card that starts a revision session
function ActionCard({ icon, count, label, text, buttonLabel, busy, disabled, onStart, children }) {
  return (
    <Card className="flex flex-col p-5 md:p-6">
      <div className="flex items-start gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-slate-900 text-[#e5c372]">
          <Icon d={icon} className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <p className="text-3xl font-bold tabular-nums text-slate-900">{count}</p>
          <p className="text-sm font-medium text-slate-700">{label}</p>
        </div>
      </div>
      <p className="mt-3 text-sm text-slate-500">{text}</p>
      <div className="mt-auto pt-5">
        <button
          onClick={onStart}
          disabled={disabled}
          className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
        >
          {busy ? "Preparing questions..." : buttonLabel}
        </button>
        {children}
      </div>
    </Card>
  );
}

// Weak or strong chapters, each with a bar and a "Practise" button
function ChapterBlock({ title, hint, chapters, empty, onPractise, busyId }) {
  return (
    <Card className="p-5">
      <CardTitle hint={hint}>{title}</CardTitle>
      {chapters.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">{empty}</p>
      ) : (
        <ul className="mt-4 space-y-4">
          {chapters.map((c) => (
            <li key={c.id}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate font-medium text-slate-800" title={c.name}>{c.name}</span>
                    <b className={cx("shrink-0 tabular-nums", toneText(c.accuracy))}>{round1(c.accuracy)}%</b>
                  </div>
                  <Bar value={c.accuracy} className="mt-1.5" />
                  <p className="mt-1 text-xs text-slate-400">{c.correct} of {c.attempted} correct</p>
                </div>
                <button
                  onClick={() => onPractise(c.id)}
                  disabled={Boolean(busyId)}
                  className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:border-slate-900 disabled:opacity-50"
                >
                  {busyId === c.id ? "..." : "Practise"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function Revise() {
  const navigate = useNavigate();
  const { examId, exam } = useExam();

  const [progress, setProgress] = useState(null);
  const [bookmarks, setBookmarks] = useState([]);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(""); // "wrong", "bookmarks", a chapter id, or ""
  const [error, setError] = useState("");

  useEffect(() => {
    if (!examId) return;
    Promise.all([api.get("/progress/dashboard", { params: { examId } }), api.get("/bookmarks", { params: { examId } })])
      .then(([dash, marks]) => {
        setProgress(dash.data);
        setBookmarks(marks.data.bookmarks);
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [examId]);

  const go = async (key, url, body) => {
    setError("");
    setStarting(key);
    try {
      const res = await api.post(url, body);
      navigate(`/attempt/${res.data.attemptId}`);
    } catch (err) {
      setError(getErrorMessage(err));
      setStarting("");
    }
  };

  const removeBookmark = async (questionId) => {
    const before = bookmarks;
    setBookmarks((list) => list.filter((b) => b.question._id !== questionId));
    try {
      await api.delete(`/bookmarks/${questionId}`);
    } catch (err) {
      setBookmarks(before);
      setError(getErrorMessage(err));
    }
  };

  const wrongCount = progress?.wrongQuestionsCount || 0;
  const practiseChapter = (id) => go(id, "/attempts/practice", { chapterIds: [id], count: 10 });

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 md:py-8">
      <PageHeader eyebrow={`${exam?.code || ""} revision`} title="Revise" subtitle="Fix your mistakes, go over saved questions and strengthen weak chapters." />

      {error && <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="mt-6 space-y-4">
          <div className="grid gap-4 md:grid-cols-2"><Bone className="h-52" /><Bone className="h-52" /></div>
          <Bone className="h-64" />
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <ActionCard
              icon={ICONS.wrong}
              count={wrongCount}
              label="wrong answers to revise"
              text="Questions you got wrong come back here. Each one leaves the list once you answer it correctly."
              buttonLabel={wrongCount ? "Practise wrong answers" : "No mistakes to revise"}
              busy={starting === "wrong"}
              disabled={wrongCount === 0 || starting !== ""}
              onStart={() => go("wrong", "/attempts/wrong-answers", { examId, count: SESSION })}
            />
            <ActionCard
              icon={ICONS.bookmark}
              count={bookmarks.length}
              label="bookmarked questions"
              text="Tap the bookmark on any question in your results to save it here."
              buttonLabel={bookmarks.length ? "Practise bookmarks" : "No bookmarks yet"}
              busy={starting === "bookmarks"}
              disabled={bookmarks.length === 0 || starting !== ""}
              onStart={() => go("bookmarks", "/attempts/bookmarks", { examId, count: SESSION })}
            >
              {bookmarks.length > 0 && (
                <button
                  onClick={() => setShowBookmarks((s) => !s)}
                  aria-expanded={showBookmarks}
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-900"
                >
                  {showBookmarks ? "Hide saved questions" : "View saved questions"}
                </button>
              )}
            </ActionCard>
          </div>

          {showBookmarks && (
            <Card className="mt-4 p-5">
              <CardTitle hint={`${bookmarks.length} saved`}>Saved questions</CardTitle>
              <div className="mt-4 space-y-3">
                {bookmarks.map((b) => (
                  <article key={b.bookmarkId} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="rounded-full bg-white px-2 py-0.5 font-medium capitalize ring-1 ring-slate-200">{b.question.difficulty}</span>
                      <span>Saved {shortDate(b.savedAt)}</span>
                      <button onClick={() => removeBookmark(b.question._id)} className="ml-auto font-semibold text-red-700 hover:underline">
                        Remove
                      </button>
                    </div>
                    <MathText as="p" className="mt-2 whitespace-pre-line text-slate-900" text={b.question.text} />
                    {b.question.options?.length > 0 && (
                      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                        {b.question.options.map((opt) => (
                          <li key={opt.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                            <span className="mr-2 font-semibold text-slate-900">{opt.id}</span>
                            <MathText text={opt.text} />
                          </li>
                        ))}
                      </ul>
                    )}
                    {b.note && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Note: {b.note}</p>}
                  </article>
                ))}
              </div>
            </Card>
          )}

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <ChapterBlock
              title="Chapters to work on"
              hint="Lowest accuracy first"
              chapters={progress?.weakChapters || []}
              empty="No weak chapters yet. Keep practising and they will show here."
              onPractise={practiseChapter}
              busyId={starting && starting !== "wrong" && starting !== "bookmarks" ? starting : ""}
            />
            <ChapterBlock
              title="Strong chapters"
              hint="Keep them fresh with a quick session"
              chapters={progress?.strongChapters || []}
              empty="Reach 80% accuracy in a chapter to see it here."
              onPractise={practiseChapter}
              busyId={starting && starting !== "wrong" && starting !== "bookmarks" ? starting : ""}
            />
          </div>

          {(progress?.recentTests || []).length > 0 && (
            <Card className="mt-4 overflow-hidden">
              <div className="flex items-center justify-between px-5 pt-5">
                <CardTitle hint="Open a test to go over its answers">Recent tests</CardTitle>
                <Link to="/analytics" className="text-sm font-semibold text-indigo-700 hover:underline">All results</Link>
              </div>
              <ul className="mt-3 divide-y divide-slate-200 border-t border-slate-200">
                {progress.recentTests.map((t) => (
                  <li key={t.attemptId}>
                    <Link to={`/result/${t.attemptId}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50">
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-slate-900">{MODE_LABELS[t.mode] || t.mode}</span>
                        <span className="block text-xs text-slate-500">{when(t.submittedAt)}</span>
                      </span>
                      <span className="text-sm font-semibold tabular-nums text-slate-900">{t.score}/{t.maxScore}</span>
                      <Pct value={t.accuracy} />
                      <Icon d={ICONS.arrow} className="h-4 w-4 text-slate-400" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
