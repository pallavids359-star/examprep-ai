import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Public home page: light layout with a picture collage on the right
const INK = "#17140f";
const btnDark = "inline-flex items-center justify-center gap-2 rounded-lg bg-[#17140f] px-6 py-3 font-semibold !text-[#e5c372] shadow-[0_10px_24px_-14px_rgba(23,20,15,0.8)] transition hover:bg-black";
const btnLine = "inline-flex items-center justify-center gap-2 rounded-lg border border-[#17140f] px-6 py-3 font-semibold text-[#17140f] transition hover:bg-[#17140f] hover:!text-[#e5c372]";

// Support email shown in the footer and the "Contact us" link. Leave empty to hide it.
const CONTACT_EMAIL = "";

const NAV = [
  ["#top", "Home"],
  ["#exams", "Exams"],
  ["#features", "Features"],
  ["#how", "How it works"],
  ...(CONTACT_EMAIL ? [["#contact", "Contact us"]] : []),
];

const STATS = [
  { value: "Live", label: "Tests by lecturers", d: "M5 4h11l3 3v13H5zM9 10h6M9 14h6" },
  { value: "3", label: "Exams", d: "M4 20V10M10 20V4M16 20v-6M2 20h20" },
  { value: "11 & 12", label: "Full syllabus", d: "M12 3l9 5-9 5-9-5 9-5zM5 10.5V16c0 1.7 3.1 3 7 3s7-1.3 7-3v-5.5" },
];

// Your social pages: put the full link between the quotes. Empty ones are hidden.
const SOCIAL = [
  { name: "Facebook", href: "", d: "M14 8h2V5h-2a4 4 0 00-4 4v2H8v3h2v7h3v-7h2.5l.5-3h-3V9a1 1 0 011-1z" },
  { name: "LinkedIn", href: "", d: "M6 9v9M6 6v.01M10 18v-5a3 3 0 016 0v5M10 9v9" },
  { name: "Instagram", href: "", d: "M7 3h10a4 4 0 014 4v10a4 4 0 01-4 4H7a4 4 0 01-4-4V7a4 4 0 014-4zM12 8a4 4 0 100 8 4 4 0 000-8zM17.5 6.5v.01" },
  { name: "YouTube", href: "", d: "M21 8.5a3 3 0 00-2-2C17.3 6 12 6 12 6s-5.3 0-7 .5a3 3 0 00-2 2C2.5 10.2 2.5 12 2.5 12s0 1.8.5 3.5a3 3 0 002 2c1.7.5 7 .5 7 .5s5.3 0 7-.5a3 3 0 002-2c.5-1.7.5-3.5.5-3.5s0-1.8-.5-3.5zM10 9.5v5l4.5-2.5z" },
];

const EXAMS = [
  { name: "NEET", tag: "Medical entrance", subjects: ["Physics", "Chemistry", "Biology"] },
  { name: "JEE", tag: "Engineering entrance", subjects: ["Physics", "Chemistry", "Maths"] },
  { name: "KCET", tag: "Karnataka CET", subjects: ["Physics", "Chemistry", "Maths", "Biology"] },
];

const FEATURES = [
  { title: "Chapter-wise practice", text: "Pick chapters and concepts, and practise with instant answers and full solutions.", d: "M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  { title: "Full mock tests", text: "Real exam pattern, timer and marking, with auto-save and auto-submit.", d: "M12 8v4l3 3M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  { title: "Analytics", text: "Marks by subject and chapter for every test, and your score trend.", d: "M4 20V10M10 20V4M16 20v-6M2 20h20" },
  { title: "Revise your mistakes", text: "Every wrong answer is saved, so you fix weak spots before the exam.", d: "M4 4v6h6M20 20v-6h-6M19 9A8 8 0 005.6 6.6L4 10m16 4l-1.6 3.4A8 8 0 015 15" },
  { title: "Every question type", text: "MCQs, assertion-reason, match the following, statements and numericals.", d: "M4 6h16M4 12h16M4 18h10" },
  { title: "Fair exam mode", text: "Full screen, tab-switch warnings and copy protection in mock tests.", d: "M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z" },
];

const STEPS = [
  { title: "Create your free account", text: "Sign up in a minute and choose NEET, JEE or KCET." },
  { title: "Practise every day", text: "Short chapter sessions build accuracy and speed." },
  { title: "Test, analyse, improve", text: "Take mocks, read your analytics and revise what you got wrong." },
];

function Icon({ d, className = "h-6 w-6" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

// ---------- Picture collage (each tile can later hold a real photo) ----------
function TileQuestion() {
  return (
    <div className="flex h-full flex-col justify-center bg-[#17140f] p-5 text-left">
      <span className="w-fit rounded-md bg-[#e5c372]/15 px-2 py-0.5 text-[11px] font-semibold text-[#e5c372]">Physics · Kinematics</span>
      <p className="mt-3 text-sm font-medium leading-snug text-[#fffdf8]">A car speeds up at 2 m/s² for 5 s from rest. Final speed?</p>
      <div className="mt-3 grid grid-cols-2 gap-1.5 text-xs">
        {["5 m/s", "10 m/s", "20 m/s", "25 m/s"].map((o, i) => (
          <span key={o} className={"rounded-md border px-2 py-1.5 " + (i === 1 ? "border-[#e5c372] bg-[#e5c372]/15 text-[#f2d68e]" : "border-[#3a3326] text-[#b7ad96]")}>{"ABCD"[i]}. {o}</span>
        ))}
      </div>
    </div>
  );
}

function TileScore() {
  const r = 38, c = 2 * Math.PI * r, pct = 0.82;
  return (
    <div className="flex h-full items-center gap-4 bg-[#fbf5e7] p-5 text-left">
      <div className="relative h-24 w-24 shrink-0">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle cx="50" cy="50" r={r} fill="none" stroke="#efe2bf" strokeWidth="10" />
          <circle cx="50" cy="50" r={r} fill="none" stroke={INK} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${pct * c} ${c}`} />
        </svg>
        <span className="absolute inset-0 grid place-items-center text-xl font-extrabold text-[#17140f]">82%</span>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8f6215]">Mock test 4</p>
        <p className="mt-1 text-lg font-bold text-[#17140f]">592 / 720</p>
        <div className="mt-3 space-y-1.5 text-xs text-[#5d5446]">
          {[["Physics", 74], ["Chemistry", 81], ["Biology", 88]].map(([s, v]) => (
            <div key={s} className="flex items-center gap-2">
              <span className="w-16">{s}</span>
              <span className="h-1.5 w-14 rounded-full bg-[#efe2bf]"><span className="block h-full rounded-full bg-[#17140f]" style={{ width: `${v}%` }} /></span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TileRank() {
  return (
    <div className="relative flex h-full flex-col items-center justify-center overflow-hidden bg-[#17140f] p-6 text-center">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(260px_200px_at_50%_10%,rgba(229,195,114,0.25),transparent_70%)]" />
      <img src="/genprep-icon.png" alt="" className="relative h-20 w-20 rounded-full ring-2 ring-[#e5c372]/50" />
      <p className="relative mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-[#e5c372]">Your rank</p>
      <p className="relative mt-1 text-5xl font-extrabold text-[#fffdf8]">#3</p>
      <p className="relative mt-1 text-sm text-[#b7ad96]">99.2 percentile</p>
      <div className="relative mt-6 w-full space-y-2">
        {[["Streak", "12 days"], ["Accuracy", "84%"]].map(([k, v]) => (
          <div key={k} className="flex justify-between rounded-lg border border-[#3a3326] px-3 py-2 text-sm">
            <span className="text-[#b7ad96]">{k}</span>
            <span className="font-semibold text-[#f2d68e]">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Collage() {
  return (
    <div className="relative mx-auto hidden w-full max-w-xl sm:grid grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)] gap-4">
      <div className="space-y-4">
        <div className="ml-auto h-52 w-[88%] overflow-hidden rounded-2xl shadow-[0_18px_40px_-22px_rgba(23,20,15,0.7)]"><TileQuestion /></div>
        <div className="h-60 overflow-hidden rounded-2xl border border-[#e7dcc3] shadow-[0_18px_40px_-22px_rgba(23,20,15,0.5)]"><TileScore /></div>
      </div>
      <div className="mt-8 h-[30rem] overflow-hidden rounded-2xl shadow-[0_18px_40px_-22px_rgba(23,20,15,0.7)]"><TileRank /></div>
      {/* badge where the three pictures meet */}
      <span className="absolute left-[55.4%] top-[216px] hidden h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-4 border-[#fffdf8] bg-[#b8862b] text-[#17140f] shadow-lg sm:grid">
        <Icon d="M12 3l9 5-9 5-9-5 9-5zM5 10.5V16c0 1.7 3.1 3 7 3s7-1.3 7-3v-5.5" className="h-5 w-5" />
      </span>
    </div>
  );
}

export default function Landing({ loggedIn }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-[#fffdf8]" />;
  if (user) return loggedIn;

  return (
    <div id="top" className="min-h-screen bg-[#fffdf8] text-[#17140f]">
      <header className="sticky top-0 z-30 border-b border-[#efe6d2] bg-[#fffdf8]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/genprep-icon.png" alt="" className="h-10 w-10 rounded-full" />
            <span className="text-xl font-bold">GenPrep</span>
          </Link>
          <nav className="hidden items-center gap-1 text-sm lg:flex">
            {NAV.map(([href, label]) => (
              <a key={href} href={href} className="rounded-lg px-3.5 py-2 font-medium text-[#433c32] hover:text-[#8f6215]">{label}</a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login" className="rounded-lg border border-[#17140f] px-4 py-2 text-sm font-semibold text-[#17140f] hover:bg-[#17140f] hover:!text-[#e5c372]">Sign in</Link>
            <Link to="/register" className="rounded-lg bg-[#17140f] px-4 py-2 text-sm font-semibold !text-[#e5c372] hover:bg-black">Get started</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-12 md:pt-16 lg:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8f6215]">NEET · JEE · KCET</p>
          <h1 className="mt-4 text-4xl font-bold leading-[1.15] md:text-5xl" style={{ textWrap: "balance" }}>
            Your gateway to cracking NEET, JEE and KCET
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-[#5d5446]">
            Practise chapter by chapter, take full mock tests with the real pattern, and see exactly where to improve. Everything for Class 11 and 12 in one place.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#features" className={btnLine}>Learn more</a>
            <Link to="/register" className={btnDark}>Get started</Link>
          </div>

          <div className="mt-10 grid max-w-lg grid-cols-3 gap-3">
            {STATS.map((s) => (
              <div key={s.label} className="rounded-xl border border-[#efe6d2] bg-white px-3 py-4 text-center shadow-[0_10px_24px_-18px_rgba(23,20,15,0.5)]">
                <span className="mx-auto grid h-9 w-9 place-items-center rounded-full bg-[#fbf5e7] text-[#8f6215]"><Icon d={s.d} className="h-5 w-5" /></span>
                <p className="mt-2 text-lg font-bold">{s.value}</p>
                <p className="text-xs text-[#7a6e5b]">{s.label}</p>
              </div>
            ))}
          </div>

          {SOCIAL.some((s) => s.href) && <div className="mt-8 flex gap-3">
            {SOCIAL.filter((s) => s.href).map((s) => (
              <a key={s.name} href={s.href} aria-label={s.name} target="_blank" rel="noreferrer" className="grid h-10 w-10 place-items-center rounded-full bg-[#17140f] text-[#e5c372] transition hover:bg-[#8f6215] hover:text-white">
                <Icon d={s.d} className="h-[18px] w-[18px]" />
              </a>
            ))}
          </div>}
        </div>
        <Collage />
        {/* Phones: one picture instead of the collage */}
        <div className="h-52 overflow-hidden rounded-2xl border border-[#e7dcc3] shadow-[0_18px_40px_-22px_rgba(23,20,15,0.5)] sm:hidden"><TileScore /></div>
      </section>

      {/* Exams */}
      <section id="exams" className="scroll-mt-20 border-t border-[#efe6d2] bg-[#f7f3ea]">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-[#8f6215]">Choose your exam</p>
          <h2 className="mt-3 text-center text-3xl font-bold md:text-4xl">Questions mapped to your syllabus</h2>
          <div className="mt-12 grid gap-5 sm:grid-cols-3">
            {EXAMS.map((e) => (
              <div key={e.name} className="rounded-2xl border border-[#e7dcc3] bg-white p-6 shadow-[0_10px_24px_-20px_rgba(23,20,15,0.5)]">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-2xl font-bold">{e.name}</p>
                    <p className="text-sm text-[#7a6e5b]">{e.tag}</p>
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  {e.subjects.map((s) => (
                    <span key={s} className="rounded-full border border-[#e7dcc3] px-2.5 py-1 text-xs text-[#5d5446]">{s}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8f6215]">Everything in one place</p>
        <h2 className="mt-3 text-3xl font-bold md:text-4xl">Built for serious preparation</h2>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-[#e7dcc3] bg-white p-6">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#17140f] text-[#e5c372]"><Icon d={f.d} /></span>
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-[#5d5446]">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="scroll-mt-20 border-y border-[#efe6d2] bg-[#f7f3ea]">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-[#8f6215]">How it works</p>
          <h2 className="mt-3 text-center text-3xl font-bold md:text-4xl">Three steps to a better score</h2>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <div key={s.title} className="rounded-2xl border border-[#e7dcc3] bg-white p-6">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-[#17140f] font-bold text-[#e5c372]">{i + 1}</span>
                <h3 className="mt-4 font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-sm text-[#5d5446]">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Call to action */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <div className="relative overflow-hidden rounded-3xl bg-[#17140f] px-6 py-14 text-center">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(600px_260px_at_50%_-10%,rgba(229,195,114,0.22),transparent_65%)]" />
          <h2 className="relative text-3xl font-bold text-[#fffdf8] md:text-4xl">Start your preparation <span className="text-[#e5c372]">today</span></h2>
          <p className="relative mt-3 text-[#b7ad96]">It is free to start. All you need is an email address.</p>
          <Link to="/register" className="relative mt-8 inline-flex rounded-lg bg-[#e5c372] px-7 py-3 font-semibold !text-[#17140f] hover:bg-[#f2d68e]">Create free account</Link>
        </div>
      </section>

      <footer id="contact" className="border-t border-[#efe6d2] bg-[#fffdf8]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-[#7a6e5b] sm:flex-row">
          <span>&copy; {new Date().getFullYear()} GenPrep &middot; A Manchester Technologies product</span>
          <span className="flex gap-4">
            <Link to="/privacy" className="hover:underline">Privacy</Link>
            <Link to="/terms" className="hover:underline">Terms</Link>
          </span>
          {CONTACT_EMAIL && <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-[#8f6215] hover:underline">{CONTACT_EMAIL}</a>}
        </div>
      </footer>
    </div>
  );
}
