import { Link } from "react-router-dom";

// "Back" link: a round arrow button with the place it goes back to
export default function BackLink({ to, children, className = "" }) {
  return (
    <Link to={to} className={`group inline-flex items-center gap-2.5 text-sm font-medium text-slate-600 transition hover:text-slate-900 print:hidden ${className}`}>
      <span className="grid h-8 w-8 place-items-center rounded-full bg-white text-slate-700 shadow-sm ring-1 ring-[#e7dcc3] transition group-hover:-translate-x-0.5 group-hover:bg-[#17140f] group-hover:text-[#e5c372] group-hover:ring-[#17140f]">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </span>
      <span>{children}</span>
    </Link>
  );
}
