import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { getErrorMessage } from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import { useExam } from "../../context/ExamContext";
import { DashboardSkeleton } from "../../components/Skeleton";
import { QuickActions, WelcomeBanner } from "../../components/DashboardHero";
import { StatsRow, WeeklyChart } from "../../components/DashboardWidgets";
import { RecommendedCard } from "../../components/DashboardLists";
import LiveNowBanner from "../../components/LiveNowBanner";

const STEPS = [
  { title: "Pick a chapter", text: "Open Practice and choose any chapter or topic." },
  { title: "Answer 10 questions", text: "You'll see the right answer and an explanation." },
  { title: "Come back tomorrow", text: "Build a streak and watch your accuracy grow." },
];

export default function Dashboard() {
  const { user } = useAuth();
  const { examId, exam } = useExam();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  // The page reloads by itself when the exam changes (see StudentLayout)
  useEffect(() => {
    if (!examId) return;
    api
      .get("/progress/dashboard", { params: { examId } })
      .then((res) => setData(res.data))
      .catch((err) => setError(getErrorMessage(err)));
  }, [examId]);

  const examCode = exam?.code || "";
  const hasActivity = data && data.totals.attempted > 0;
  const today = data?.last7Days?.[data.last7Days.length - 1];

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 md:py-8">
      <WelcomeBanner name={user.name} examCode={examCode} today={today} />
      <LiveNowBanner examId={examId} />
      <QuickActions wrongCount={data?.wrongQuestionsCount || 0} />

      {error && <div className="mt-6 rounded-lg bg-red-50 text-red-700 text-sm px-4 py-3">{error}</div>}
      {!data && !error && <DashboardSkeleton />}

      {data && !hasActivity && (
        <section className="mt-6 rounded-2xl bg-white border border-slate-200 p-6 md:p-8">
          <h2 className="text-xl font-bold text-slate-900">Let's get started with {examCode}</h2>
          <p className="mt-1 text-slate-500">Your charts, streak and weak chapters will appear here after your first session.</p>
          <ol className="mt-6 grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-xl bg-slate-50 p-4">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-indigo-600 text-sm font-bold text-white">{i + 1}</span>
                <p className="mt-3 font-semibold text-slate-900">{s.title}</p>
                <p className="mt-1 text-sm text-slate-500">{s.text}</p>
              </li>
            ))}
          </ol>
          <Link to="/practice" className="mt-6 inline-block rounded-lg bg-indigo-600 text-white text-sm font-semibold px-5 py-2.5 hover:bg-indigo-700">
            Start my first practice
          </Link>
        </section>
      )}

      {hasActivity && (
        <>
          <StatsRow totals={data.totals} streak={data.streak} />
          <div className="grid lg:grid-cols-3 gap-4 mt-4">
            <div className="lg:col-span-2">
              <WeeklyChart days={data.last7Days} />
            </div>
            <RecommendedCard recommended={data.recommended} wrongCount={data.wrongQuestionsCount} />
          </div>

        </>
      )}
    </div>
  );
}