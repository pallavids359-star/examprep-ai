import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { getErrorMessage } from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import { useExam } from "../../context/ExamContext";
import { DetailsForm, PasswordForm } from "../../components/ProfileForms";

const CLASS_TEXT = { 11: "Class 11", 12: "Class 12", dropper: "Dropper" };
const initials = (name = "") =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";

export default function Profile() {
  const { setUser, logout } = useAuth();
  const { exams, examId, exam, setExamId } = useExam();
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/auth/profile").then((res) => setProfile(res.data.user)).catch((err) => setError(getErrorMessage(err)));
  }, []);
  useEffect(() => {
    if (examId) api.get("/progress/dashboard", { params: { examId } }).then((res) => setStats(res.data)).catch(() => {});
  }, [examId]);

  const saved = (p) => {
    setProfile(p);
    setUser((u) => ({ ...u, name: p.name, college: p.college, section: p.section }));
  };

  if (error) return <p className="max-w-4xl mx-auto px-4 py-10 text-red-700">{error}</p>;
  if (!profile) return <p className="py-24 text-center text-slate-500">Loading your profile...</p>;

  const badges = [exam?.code, CLASS_TEXT[profile.classLevel], profile.targetYear && `Target ${profile.targetYear}`].filter(Boolean);
  const tiles = stats && [
    { label: "Questions solved", value: stats.totals.attempted },
    { label: "Accuracy", value: `${Math.round((stats.totals.accuracy || 0) * 10) / 10}%` },
    { label: "Streak", value: `${stats.streak.current} days` },
    { label: "Tests taken", value: stats.totals.testsTaken },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 md:py-8">
      <section className="overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-sm">
        <div className="h-24 border-b border-[#b8862b]/50 bg-[#17140f] bg-[radial-gradient(500px_200px_at_85%_-30%,rgba(229,195,114,0.22),transparent_60%)]" />
        <div className="px-6 pb-6 flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="-mt-10 shrink-0 grid h-20 w-20 place-items-center rounded-full border-4 border-white bg-indigo-100 text-2xl font-extrabold text-indigo-700 shadow">
            {initials(profile.name)}
          </div>
          <div className="flex-1 sm:pt-3">
            <h1 className="text-2xl font-bold text-slate-900">{profile.name}</h1>
            <p className="text-sm text-slate-500">
              {profile.email} &middot; member since {new Date(profile.createdAt).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {badges.map((b) => (
                <span key={b} className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">{b}</span>
              ))}
            </div>
          </div>
          <button onClick={logout} className="sm:mt-4 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Log out
          </button>
        </div>
      </section>

      {tiles && (
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-xl bg-white border border-slate-200 px-4 py-3">
              <p className="text-xs text-slate-500">{t.label}</p>
              <p className="text-xl font-bold text-slate-900">{t.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-4">
          <DetailsForm profile={profile} onSaved={saved} />
          {exams.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 md:p-6">
              <h2 className="font-semibold text-slate-900">Exam you're preparing for</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {exams.map((e) => (
                  <button
                    key={e._id}
                    onClick={() => setExamId(e._id)}
                    className={`rounded-lg border-2 px-4 py-2 text-sm font-bold ${e._id === examId ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}
                  >
                    {e.code}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="lg:col-span-2 space-y-4">
          <PasswordForm />
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h2 className="font-semibold text-slate-900">Shortcuts</h2>
            <div className="mt-3 grid gap-2 text-sm font-medium">
              <Link to="/revise" className="rounded-lg bg-slate-50 px-3 py-2.5 text-slate-700 hover:bg-slate-100">Bookmarks and mistakes &rarr;</Link>
              <Link to="/analytics" className="rounded-lg bg-slate-50 px-3 py-2.5 text-slate-700 hover:bg-slate-100">My analytics &rarr;</Link>
              <Link to="/mock-tests" className="rounded-lg bg-slate-50 px-3 py-2.5 text-slate-700 hover:bg-slate-100">Mock tests &rarr;</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}