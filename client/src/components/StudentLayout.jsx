import { Link, NavLink, Navigate, Outlet } from "react-router-dom";
import { choiceKey } from "../pages/student/Welcome";
import { useAuth } from "../context/AuthContext";
import { ExamProvider, useExam } from "../context/ExamContext";

const LINKS = [
  { to: "/dashboard", label: "Dashboard", icon: "M3 11l9-7 9 7M5 10v10h5v-6h4v6h5V10" },
  { to: "/practice", label: "Practice", icon: "M5 4h11l3 3v13H5zM9 10h6M9 14h6" },
  { to: "/mock-tests", label: "Mock tests", icon: "M12 7v5l3 2M12 3a9 9 0 100 18 9 9 0 000-18z" },
  { to: "/live-tests", label: "Live tests", icon: "M12 3v3M12 18v3M3 12h3M18 12h3M12 8a4 4 0 100 8 4 4 0 000-8z" },
  { to: "/analytics", label: "Analytics", icon: "M4 20V10M10 20V4M16 20v-6M2 20h20" },
  { to: "/revise", label: "Revise", icon: "M4 4v6h6M20 20v-6h-6M5.5 15a7.5 7.5 0 0013.5 2M18.5 9A7.5 7.5 0 005 7" },
];
const ADMIN_ICON = "M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z";

const initials = (name = "") => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0].toUpperCase()).join("");

function Icon({ path }) {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}

function Logo({ compact }) {
  return (
    <Link to="/dashboard" className="flex items-center gap-2 font-bold text-slate-900">
      <img src="/genprep-icon.png" alt="" className="w-12 h-12" />
      <span className={compact ? "hidden sm:inline" : ""}>
        GenPrep
      </span>
    </Link>
  );
}

function ExamPicker({ full }) {
  const { exams, examId, setExamId } = useExam();
  if (exams.length === 0) return null;
  return (
    <select
      value={examId}
      onChange={(e) => setExamId(e.target.value)}
      aria-label="Exam"
      className={`rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm font-semibold text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${full ? "w-full" : ""}`}
    >
      {exams.map((e) => (
        <option key={e._id} value={e._id}>
          {e.code}
        </option>
      ))}
    </select>
  );
}

function Shell() {
  const { user, logout } = useAuth();
  const { examId } = useExam();
  if (!localStorage.getItem(choiceKey(user))) return <Navigate to="/welcome" replace />;

  const sideLink = ({ isActive }) =>
    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${
      isActive ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
    }`;
  const tabClass = ({ isActive }) =>
    `flex-1 flex flex-col items-center gap-0.5 py-2 text-xs font-medium ${isActive ? "text-indigo-700" : "text-slate-500"}`;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Laptop: sidebar on the left */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white px-3 pb-4 lg:flex">
        <div className="px-3 py-4">
          <Logo />
        </div>
        <div className="px-3">
          <p className="mb-1 text-xs font-medium text-slate-500">Preparing for</p>
          <ExamPicker full />
        </div>
        <nav className="mt-5 flex-1 space-y-1" aria-label="Main">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} className={sideLink}>
              <Icon path={l.icon} />
              {l.label}
            </NavLink>
          ))}
          {false && user.role === "admin" && (
            <NavLink to="/admin" className={sideLink}>
              <Icon path={ADMIN_ICON} />
              Admin
            </NavLink>
          )}
        </nav>
        <div className="space-y-2 border-t border-slate-200 pt-4">
          <div className="flex items-center gap-2">
            <Link to="/profile" title="My profile" className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-100">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">{initials(user.name)}</span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-slate-800">{user.name}</span>
                <span className="block text-xs text-slate-500">View profile</span>
              </span>
            </Link>
          </div>
          <button onClick={logout} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
            Log out
          </button>
        </div>
      </aside>

      {/* Phone and tablet: slim top bar */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white lg:hidden">
        <div className="flex h-14 items-center gap-3 px-4">
          <Logo compact />
          <div className="ml-auto flex items-center gap-2">
            {false && user.role === "admin" && (
              <Link to="/admin" className="hidden sm:block rounded-lg px-2 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100">Admin</Link>
            )}
            <ExamPicker />
            <Link to="/profile" title="My profile" className="grid h-8 w-8 place-items-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
              {initials(user.name)}
            </Link>
          </div>
        </div>
      </header>

      <main className="pb-20 lg:ml-64 lg:pb-0">
        {/* key: when the exam changes, the page reloads its data for the new exam */}
        <Outlet key={examId} />
      </main>

      {/* Phone: bottom tabs */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-20 bg-white border-t border-slate-200 flex" aria-label="Main">
        {LINKS.map((l) => (
          <NavLink key={l.to} to={l.to} className={tabClass}>
            <Icon path={l.icon} />
            {l.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export default function StudentLayout() {
  return (
    <ExamProvider>
      <Shell />
    </ExamProvider>
  );
}