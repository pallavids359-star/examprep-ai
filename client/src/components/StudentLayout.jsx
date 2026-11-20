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
    <Link to="/dashboard" className="flex items-center gap-2 font-display font-extrabold text-slate-900">
      <img src="/genprep-icon.png" alt="" className="h-9 w-9 rounded-lg" />
      <span className={compact ? "hidden sm:inline" : ""}>
        GenPrep
      </span>
    </Link>
  );
}

// Exam switcher: one tap between NEET, JEE and KCET (gold = the exam you're preparing for)
function ExamPicker({ full }) {
  const { exams, examId, setExamId } = useExam();
  if (exams.length === 0) return null;
  return (
    <div
      role="radiogroup"
      aria-label="Exam"
      className={`grid gap-1 rounded-2xl bg-[#efe6d2]/60 p-1 ring-1 ring-[#e7dcc3] ${full ? "w-full" : ""}`}
      style={{ gridTemplateColumns: `repeat(${exams.length}, minmax(0, 1fr))` }}
    >
      {exams.map((e) => {
        const on = e._id === examId;
        return (
          <button
            key={e._id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => !on && setExamId(e._id)}
            className={`rounded-xl font-display font-extrabold tracking-wide transition ${full ? "py-2 text-sm" : "px-2.5 py-1 text-xs"} ${
              on ? "bg-[#17140f] text-[#e5c372] shadow-sm" : "text-[#6b604c] hover:bg-white hover:text-[#17140f]"
            }`}
          >
            {e.code}
          </button>
        );
      })}
    </div>
  );
}

function Shell() {
  const { user, logout } = useAuth();
  const { examId } = useExam();
  if (!localStorage.getItem(choiceKey(user))) return <Navigate to="/welcome" replace />;

  const sideLink = ({ isActive }) => `gp-nav-link ${isActive ? "active" : ""}`;
  const tabClass = ({ isActive }) =>
    `flex-1 flex flex-col items-center gap-0.5 py-2 text-xs font-medium ${isActive ? "text-indigo-700" : "text-slate-500"}`;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Laptop: sidebar on the left */}
      <aside className="gp-sidebar fixed inset-y-0 left-0 z-30 hidden w-64 flex-col px-3 pb-4 lg:flex">
        <Link to="/dashboard" className="flex items-center gap-3 px-3 py-5">
          <img src="/genprep-icon.png" alt="" className="h-10 w-10 rounded-xl" />
          <span className="gp-brand text-xl">GenPrep</span>
        </Link>
        <div className="px-3">
          <p className="gp-label mb-1.5">Preparing for</p>
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
        <div className="gp-user flex items-center gap-3 p-3">
          <Link to="/profile" title="My profile" className="flex min-w-0 flex-1 items-center gap-3">
            <span className="gp-avatar grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs">{initials(user.name)}</span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-slate-900">{user.name}</span>
              <span className="block text-xs text-slate-500">View profile</span>
            </span>
          </Link>
          <button onClick={logout} className="gp-ghost-btn px-2.5 py-1.5 text-xs font-semibold">
            Log out
          </button>
        </div>
      </aside>

      {/* Phone and tablet: slim top bar */}
      <header className="gp-topbar sticky top-0 z-20 lg:hidden">
        <div className="flex h-14 items-center gap-3 px-4">
          <Logo compact />
          <div className="ml-auto flex items-center gap-2">
            {false && user.role === "admin" && (
              <Link to="/admin" className="hidden sm:block rounded-lg px-2 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100">Admin</Link>
            )}
            <ExamPicker />
            <Link to="/profile" title="My profile" className="gp-avatar grid h-8 w-8 place-items-center rounded-full text-xs">
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
      <nav className="gp-tabbar lg:hidden fixed bottom-0 inset-x-0 z-20 flex" aria-label="Main">
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