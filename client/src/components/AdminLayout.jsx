import { useEffect, useState } from "react";
import api from "../api/axios";
import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const LINKS = [
  { to: "/admin", label: "Overview", end: true, icon: "M3 11l9-7 9 7M5 10v10h5v-6h4v6h5V10" },
  { to: "/admin/questions", label: "Questions", icon: "M5 4h11l3 3v13H5zM9 10h6M9 14h6" },
  { to: "/admin/drafts", label: "Draft questions", icon: "M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" },
  { to: "/admin/reported", label: "Reported questions", badge: "reports", icon: "M4 22V4M4 4h13l-2 4 2 4H4" },
  { to: "/admin/syllabus", label: "Syllabus", icon: "M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2zM4 5v16M8 7h7" },
  { to: "/admin/tests", label: "Mock tests", icon: "M12 7v5l3 2M12 3a9 9 0 100 18 9 9 0 000-18z" },
  { to: "/admin/live-tests", label: "Live tests", icon: "M12 3v3M12 18v3M3 12h3M18 12h3M12 8a4 4 0 100 8 4 4 0 000-8z" },
  { to: "/lecturer/assignments", label: "Assignments", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 14l2 2 4-4" },
  { to: "/admin/results", label: "Results", icon: "M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0zM17 5h3v2a3 3 0 01-3 3M7 5H4v2a3 3 0 003 3" },
  { to: "/admin/lecturers", label: "Lecturers", icon: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 21v-1a6 6 0 016-6h4a6 6 0 016 6v1" },
  { to: "/admin/errors", label: "App errors", icon: "M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" },
  { to: "/admin/guide", label: "User guide", icon: "M12 21a9 9 0 100-18 9 9 0 000 18zM9.1 9a3 3 0 015.8 1c0 2-3 2.5-3 4.5M12 17.5h.01" },
  { to: "/admin/students", label: "Students", icon: "M16 19v-1a4 4 0 00-4-4H6a4 4 0 00-4 4v1M9 10a3 3 0 100-6 3 3 0 000 6zM22 19v-1a4 4 0 00-3-3.9M16 4.1a3 3 0 010 5.8" },
];

function Icon({ d }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

const GROUPS = [
  ["Overview", ["/admin"]],
  ["Content", ["/admin/questions", "/admin/drafts", "/admin/reported", "/admin/syllabus"]],
  ["Tests", ["/admin/tests", "/admin/live-tests", "/lecturer/assignments", "/admin/results"]],
  ["People", ["/admin/students", "/admin/lecturers"]],
  ["Help", ["/admin/errors", "/admin/guide"]],
];

function Sidebar({ onNavigate }) {
  const { user, logout } = useAuth();
  const link = ({ isActive }) => `gp-nav-link ${isActive ? "active" : ""}`;
  // Number of reported questions waiting to be checked
  const [reports, setReports] = useState(0);
  useEffect(() => {
    const load = () => api.get("/admin/question-reports/count").then((r) => setReports(r.data.count)).catch(() => {});
    load();
    window.addEventListener("gp-reports-changed", load);
    return () => window.removeEventListener("gp-reports-changed", load);
  }, []);
  return (
    <div className="flex h-full flex-col">
      <Link to="/admin" onClick={onNavigate} className="flex items-center gap-3 px-3 py-5">
        <img src="/genprep-icon.png" alt="" className="h-10 w-10 rounded-xl" />
        <span className="gp-brand text-xl">GenPrep</span>
        <span className="gp-role">Admin</span>
      </Link>
      <nav className="mt-1 flex-1 space-y-5 overflow-y-auto pr-1" aria-label="Admin">
        {GROUPS.map(([label, paths]) => (
          <div key={label}>
            <p className="gp-label px-3 pb-1.5">{label}</p>
            <div className="space-y-1">
              {LINKS.filter((l) => paths.includes(l.to)).map((l) => (
                <NavLink key={l.to} to={l.to} end={l.end} className={link} onClick={onNavigate}>
                  <Icon d={l.icon} />
                  {l.label}
                  {l.badge === "reports" && reports > 0 && (
                    <span className="ml-auto rounded-full bg-rose-600 px-2 py-0.5 text-[11px] font-bold text-white">{reports}</span>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="space-y-2 pt-4">
        <Link to="/dashboard" className="gp-nav-link">
          <Icon d="M15 3h6v6M10 14L21 3M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
          Student view
        </Link>
        <div className="gp-user flex items-center gap-3 p-3">
          <span className="gp-avatar grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs">
            {(user?.name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0].toUpperCase()).join("")}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-slate-900">{user?.name}</span>
            <span className="block text-xs text-slate-500">Head lecturer</span>
          </span>
          <button onClick={logout} className="gp-ghost-btn px-2.5 py-1.5 text-xs font-semibold">
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}

// Frame for every admin page: sidebar on laptops, menu button on phones
export default function AdminLayout({ title, actions, children }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="gp-sidebar fixed inset-y-0 left-0 z-30 hidden w-64 px-3 pb-4 lg:block">
        <Sidebar />
      </aside>

      <header className="gp-topbar sticky top-0 z-20 flex items-center gap-3 px-4 py-3 lg:hidden">
        <button onClick={() => setOpen(true)} aria-label="Open menu" className="gp-ghost-btn p-2">
          <Icon d="M4 6h16M4 12h16M4 18h16" />
        </button>
        <span className="font-display font-extrabold text-slate-900">GenPrep</span>
        <span className="rounded-full bg-[#e5c372] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-900">Admin</span>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden" onClick={() => setOpen(false)}>
          <aside className="gp-sidebar h-full w-72 px-3 pb-4" onClick={(e) => e.stopPropagation()}>
            <Sidebar onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <main className="px-4 py-6 md:px-8 md:py-8 lg:ml-64">
        <div className="mx-auto max-w-6xl">
          {title && (
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">GenPrep admin</p>
                <h1 className="mt-1 text-2xl font-extrabold text-slate-900 md:text-3xl">{title}</h1>
              </div>
              {actions}
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}