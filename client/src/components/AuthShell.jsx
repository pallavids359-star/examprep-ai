import { Link } from "react-router-dom";

const POINTS = [
  "NEET, JEE and KCET questions, chapter by chapter",
  "Full mock tests with the real pattern, timer and marking",
  "Analytics and a revision list built from your mistakes",
];

// Frame for the login, sign-up and password pages: brand panel + form card
export default function AuthShell({ children }) {
  return (
    <div className="min-h-screen bg-slate-50 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="relative hidden overflow-hidden border-r border-[#b8862b]/50 bg-[#17140f] px-12 py-12 text-[#f7f3ea] lg:flex lg:flex-col">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(700px_380px_at_0%_0%,rgba(229,195,114,0.16),transparent_60%)]" />
        <Link to="/" className="relative flex items-center gap-3">
          <img src="/genprep-icon.png" alt="" className="h-12 w-12 rounded-full" />
          <span className="text-xl font-bold text-[#fffdf8]">GenPrep</span>
        </Link>
        <div className="relative mt-auto mb-auto max-w-md pt-16">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#e5c372]">Practise. Test. Rank.</p>
          <h2 className="mt-3 text-4xl font-extrabold leading-tight text-[#fffdf8]">
            Your preparation, <span className="text-[#e5c372]">organised.</span>
          </h2>
          <ul className="mt-8 space-y-4">
            {POINTS.map((p) => (
              <li key={p} className="flex gap-3 text-[#d9cfb8]">
                <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full border border-[#e5c372]/60 text-[11px] text-[#e5c372]">&#10003;</span>
                {p}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-[#a89c80]">&copy; {new Date().getFullYear()} GenPrep &middot; Manchester Technologies</p>
      </aside>

      <main className="flex min-h-screen items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-6 flex items-center justify-center gap-2 lg:hidden">
            <img src="/genprep-icon.png" alt="" className="h-10 w-10 rounded-full" />
            <span className="text-lg font-bold text-slate-900">GenPrep</span>
          </Link>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">{children}</div>
        </div>
      </main>
    </div>
  );
}
