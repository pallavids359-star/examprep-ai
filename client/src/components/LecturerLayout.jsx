import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const initials = (name = "") => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0].toUpperCase()).join("");

function Icon({ d }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

function Sidebar({ onNavigate }) {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === "admin";
  const link = ({ isActive }) => `gp-nav-link ${isActive ? "active" : ""}`;
  return (
    <div className="flex h-full flex-col">
      <Link to="/lecturer" onClick={onNavigate} className="flex items-center gap-3 px-3 py-5">
        <img src="/genprep-icon.png" alt="" className="h-10 w-10 rounded-xl" />
        <span className="gp-brand text-xl">GenPrep</span>
        <span className="gp-role">{isAdmin ? "Head" : "Lecturer"}</span>
      </Link>
      <nav className="mt-1 flex-1 space-y-1" aria-label="Lecturer">
        <p className="gp-label px-3 pb-1.5">Live tests</p>
        <NavLink to="/lecturer" end className={link} onClick={onNavigate}>
          <Icon d="M5 4h11l3 3v13H5zM9 10h6M9 14h6" />
          My subjects
        </NavLink>
        {isAdmin && (
          <NavLink to="/admin/live-tests" className={link} onClick={onNavigate}>
            <Icon d="M12 3v3M12 18v3M3 12h3M18 12h3M12 8a4 4 0 100 8 4 4 0 000-8z" />
            All live tests
          </NavLink>
        )}
        <p className="gp-label px-3 pb-1.5 pt-4">Homework</p>
        <NavLink to="/lecturer/assignments" className={link} onClick={onNavigate}>
          <Icon d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 14l2 2 4-4" />
          Assignments
        </NavLink>
        <p className="gp-label px-3 pb-1.5 pt-4">Help</p>
        <NavLink to={isAdmin ? "/admin/guide" : "/lecturer/guide"} className={link} onClick={onNavigate}>
          <Icon d="M12 21a9 9 0 100-18 9 9 0 000 18zM9.1 9a3 3 0 015.8 1c0 2-3 2.5-3 4.5M12 17.5h.01" />
          User guide
        </NavLink>
        {isAdmin && (
          <NavLink to="/admin" className={link} onClick={onNavigate}>
            <Icon d="M3 11l9-7 9 7M5 10v10h5v-6h4v6h5V10" />
            Back to admin
          </NavLink>
        )}
      </nav>
      <div className="gp-user flex items-center gap-3 p-3">
        <span className="gp-avatar grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs">{initials(user?.name)}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-slate-900">{user?.name}</span>
          <span className="block text-xs text-slate-500">{isAdmin ? "Head lecturer" : "Lecturer"}</span>
        </span>
        <button onClick={logout} className="gp-ghost-btn px-2.5 py-1.5 text-xs font-semibold">
          Log out
        </button>
      </div>
    </div>
  );
}

// Frame for lecturer pages: dark sidebar on laptops, menu button on phones
export default function LecturerLayout({ children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen">
      <aside className="gp-sidebar fixed inset-y-0 left-0 z-30 hidden w-64 px-3 pb-4 lg:block">
        <Sidebar />
      </aside>
      <header className="gp-topbar sticky top-0 z-30 flex items-center gap-3 px-4 py-3 lg:hidden">
        <button onClick={() => setOpen(true)} aria-label="Open menu" className="gp-ghost-btn p-2">
          <Icon d="M4 6h16M4 12h16M4 18h16" />
        </button>
        <span className="font-display font-extrabold text-slate-900">GenPrep</span>
        <span className="rounded-full bg-[#e5c372] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-900">Lecturer</span>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden" onClick={() => setOpen(false)}>
          <aside className="gp-sidebar h-full w-72 px-3 pb-4" onClick={(e) => e.stopPropagation()}>
            <Sidebar onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}
      <div className="lg:ml-64">{children}</div>
    </div>
  );
}
