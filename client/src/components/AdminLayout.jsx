import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const LINKS = [
  { to: "/admin", label: "Overview", end: true, icon: "M3 11l9-7 9 7M5 10v10h5v-6h4v6h5V10" },
  { to: "/admin/questions", label: "Questions", icon: "M5 4h11l3 3v13H5zM9 10h6M9 14h6" },
  { to: "/admin/syllabus", label: "Syllabus", icon: "M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2zM4 5v16M8 7h7" },
  { to: "/admin/tests", label: "Mock tests", icon: "M12 7v5l3 2M12 3a9 9 0 100 18 9 9 0 000-18z" },
  { to: "/admin/live-tests", label: "Live tests", icon: "M12 3v3M12 18v3M3 12h3M18 12h3M12 8a4 4 0 100 8 4 4 0 000-8z" },
  { to: "/admin/lecturers", label: "Lecturers", icon: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 21v-1a6 6 0 016-6h4a6 6 0 016 6v1" },
  { to: "/admin/students", label: "Students", icon: "M16 19v-1a4 4 0 00-4-4H6a4 4 0 00-4 4v1M9 10a3 3 0 100-6 3 3 0 000 6zM22 19v-1a4 4 0 00-3-3.9M16 4.1a3 3 0 010 5.8" },
];

function Icon({ d }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

function Sidebar({ onNavigate }) {
  const { user, logout } = useAuth();
  const link = ({ isActive }) =>
    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${
      isActive ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
    }`;
  return (
    <div className="flex h-full flex-col">
      <Link to="/admin" onClick={onNavigate} className="flex items-center gap-2 px-3 py-4 font-bold text-slate-900">
        <img src="/genprep-icon.png" alt="" className="h-8 w-8" />
        <span>GenPrep</span>
        <span className="rounded bg-indigo-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Admin</span>
      </Link>
      <nav className="mt-2 flex-1 space-y-1" aria-label="Admin">
        {LINKS.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end} className={link} onClick={onNavigate}>
            <Icon d={l.icon} />
            {l.label}
          </NavLink>
        ))}
      </nav>
      <div className="space-y-2 border-t border-slate-200 pt-4">
        <Link to="/dashboard" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100">
          <Icon d="M15 3h6v6M10 14L21 3M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
          Student view
        </Link>
        <div className="flex items-center gap-2 px-3">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
            {(user?.name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0].toUpperCase()).join("")}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{user?.name}</span>
        </div>
        <button onClick={logout} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
          Log out
        </button>
      </div>
    </div>
  );
}

// Frame for every admin page: sidebar on laptops, menu button on phones
export default function AdminLayout({ title, actions, children }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 bg-white px-3 pb-4 lg:block">
        <Sidebar />
      </aside>

      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <button onClick={() => setOpen(true)} aria-label="Open menu" className="rounded-lg border border-slate-300 p-2 text-slate-700">
          <Icon d="M4 6h16M4 12h16M4 18h16" />
        </button>
        <span className="font-bold text-slate-900">GenPrep</span>
        <span className="rounded bg-indigo-600 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">Admin</span>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden" onClick={() => setOpen(false)}>
          <aside className="h-full w-72 bg-white px-3 pb-4" onClick={(e) => e.stopPropagation()}>
            <Sidebar onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <main className="px-4 py-6 md:px-8 md:py-8 lg:ml-64">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
            {actions}
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}