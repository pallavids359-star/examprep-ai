import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Simple top bar for lecturers (admins use the admin menu instead)
export default function LecturerLayout({ children }) {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-4">
            <Link to={user?.role === "admin" ? "/admin/live-tests" : "/lecturer"} className="text-lg font-bold text-slate-900">
              GenPrep
            </Link>
            <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">{user?.role === "admin" ? "Head lecturer" : "Lecturer"}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-slate-600 sm:inline">{user?.name}</span>
            {user?.role === "admin" && (
              <Link to="/admin/live-tests" className="font-medium text-indigo-700 hover:underline">
                Admin
              </Link>
            )}
            <button onClick={logout} className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-100">
              Log out
            </button>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
