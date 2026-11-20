import EmptyState from "../../components/EmptyState";
import { toast } from "../../components/Toaster";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api, { getErrorMessage } from "../../api/axios";
import ResultSummary from "../../components/ResultSummary";
import ReviewCard from "../../components/ReviewCard";
import { VERDICT, verdictOf } from "../../components/resultHelpers";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "wrong", label: "Wrong" },
  { key: "skipped", label: "Skipped" },
  { key: "correct", label: "Correct" },
];

export default function Result() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [bookmarked, setBookmarked] = useState({}); // questionId -> true

  // Load the result and review
  useEffect(() => {
    api
      .get(`/attempts/${id}`)
      .then((res) => {
        // Not submitted yet? Go back to the test
        if (res.data.status === "in_progress") {
          navigate(`/attempt/${id}`, { replace: true });
          return;
        }
        // Live tests have their own report (results may still be hidden)
        if (res.data.mode === "live") {
          navigate(`/live-tests/${res.data.testId}/report`, { replace: true });
          return;
        }
        setData(res.data);
      })
      .catch((err) => setError(getErrorMessage(err)));
  }, [id, navigate]);

  // Find out which questions are already bookmarked
  useEffect(() => {
    api
      .get("/bookmarks")
      .then((res) => {
        const map = {};
        res.data.bookmarks.forEach((b) => (map[b.question._id] = true));
        setBookmarked(map);
      })
      .catch(() => {});
  }, []);

  const toggleBookmark = async (questionId) => {
    const isOn = Boolean(bookmarked[questionId]);
    setBookmarked((prev) => ({ ...prev, [questionId]: !isOn })); // update the screen straight away
    try {
      if (isOn) await api.delete(`/bookmarks/${questionId}`);
      else await api.post("/bookmarks", { questionId });
      toast(isOn ? "Removed from bookmarks" : "Added to bookmarks", "info");
    } catch {
      setBookmarked((prev) => ({ ...prev, [questionId]: isOn })); // undo if it failed
      toast("Could not update the bookmark. Try again.", "error");
    }
  };

  const jumpTo = (number) => {
    setFilter("all");
    setTimeout(() => document.getElementById(`q-${number}`)?.scrollIntoView({ behavior: "smooth" }), 50);
  };
  const showWrong = () => {
    setFilter("wrong");
    setTimeout(() => document.getElementById("review")?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  if (error) {
    return (
      <div className="flex items-center justify-center p-4 py-16">
        <div className="bg-white rounded-xl border border-slate-200 p-6 text-center max-w-md">
          <p className="text-red-700">{error}</p>
          <Link to="/dashboard" className="inline-block mt-4 text-indigo-600 font-medium hover:underline">Back to dashboard</Link>
        </div>
      </div>
    );
  }
  if (!data) return <div className="py-24 text-center text-slate-500">Loading your result...</div>;

  const { review } = data;
  const countFor = (key) => (key === "all" ? review.length : review.filter((item) => verdictOf(item) === key).length);
  const visible = review.filter((item) => filter === "all" || verdictOf(item) === filter);

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <ResultSummary data={data} onShowWrong={showWrong} />

      {/* Every question at a glance: click to jump */}
      <section className="mt-4 bg-white rounded-2xl border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-900">Questions at a glance</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {review.map((item) => (
            <button
              key={item.questionId}
              onClick={() => jumpTo(item.number)}
              title={VERDICT[verdictOf(item)].label}
              className={`w-9 h-9 rounded-lg text-sm font-semibold ${VERDICT[verdictOf(item)].square}`}
            >
              {item.number}
            </button>
          ))}
        </div>
      </section>

      <div id="review" className="scroll-mt-20 mt-8 flex flex-wrap items-center gap-2">
        <h2 className="mr-2 text-lg font-bold text-slate-900">Answer review</h2>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium ${
              filter === f.key ? "bg-slate-900 text-white" : "bg-white border border-slate-300 text-slate-700 hover:border-slate-400"
            }`}
          >
            {f.label} {countFor(f.key)}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-4">
        {visible.length === 0 && <EmptyState icon="search" title="Nothing here" text="No questions in this group. Try another filter." />}
        {visible.map((item) => (
          <ReviewCard
            key={item.questionId}
            item={item}
            isBookmarked={Boolean(bookmarked[item.questionId])}
            onBookmark={() => toggleBookmark(item.questionId)}
          />
        ))}
      </div>
    </main>
  );
}