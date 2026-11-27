import { Link } from "react-router-dom";
import { SITE } from "../content/site";

// Public pages: Privacy policy and Terms of use
function Shell({ title, children }) {
  return (
    <div className="min-h-screen bg-[#fbf8f1]">
      <header className="border-b border-[#efe6d2] bg-[#fffdf8]">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-5 py-4">
          <Link to="/" className="flex items-center gap-2">
            <img src="/genprep-icon.png" alt="" className="h-8 w-8 rounded-lg" />
            <span className="gp-brand text-lg">{SITE.name}</span>
          </Link>
          <nav className="ml-auto flex gap-3 text-xs font-medium text-[#8f6215] sm:gap-4 sm:text-sm">
            <Link to="/privacy" className="hover:underline">Privacy</Link>
            <Link to="/terms" className="hover:underline">Terms</Link>
            <Link to="/delete-account" className="hover:underline">Delete account</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="text-3xl font-extrabold text-slate-900">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">Last updated: {SITE.updated}</p>
        <div className="gp-legal mt-8 space-y-6 text-[15px] leading-relaxed text-slate-700">{children}</div>
      </main>
    </div>
  );
}

const H = ({ children }) => <h2 className="pt-2 text-lg font-bold text-slate-900">{children}</h2>;
const Mail = () => <a href={`mailto:${SITE.contactEmail}`} className="font-medium text-[#8f6215] underline">{SITE.contactEmail}</a>;

export function Privacy() {
  return (
    <Shell title="Privacy policy">
      <p>
        {SITE.name} is an exam-preparation website for NEET, JEE and KCET, run by {SITE.owner}. This page explains what we
        collect, why, and how you can delete it. We do not sell your data and we do not show ads.
      </p>

      <H>What we collect</H>
      <ul className="list-disc space-y-1 pl-6">
        <li><b>Account details:</b> name, email, mobile number (optional), college, section, class and exam.</li>
        <li><b>Your password,</b> stored only in scrambled (hashed) form. Nobody, including us, can read it.</li>
        <li><b>Your test work:</b> answers, marks, time taken, ranks, bookmarks, and questions you report as wrong.</li>
        <li><b>Basic technical data:</b> if the site crashes, the error, the page and your device/browser type, so we can fix it.</li>
      </ul>
      <p>We do not collect your location, contacts, photos, camera or microphone.</p>

      <H>Why we use it</H>
      <ul className="list-disc space-y-1 pl-6">
        <li>To let you log in, write tests and see your results.</li>
        <li>So your college's lecturers and head lecturer can set tests and assignments for your section and see your marks.</li>
        <li>To send emails you ask for, such as a password reset code.</li>
      </ul>

      <H>Who can see your marks</H>
      <p>
        Only you, your college's lecturers and the head lecturer (admin). Other students never see your marks or rank.
      </p>

      <H>Where it is stored</H>
      <p>
        On secure cloud services we use to run {SITE.name}: MongoDB Atlas (database), Render and Vercel (servers),
        Cloudinary (question images) and our email provider (password reset codes). Data is sent over encrypted (HTTPS) connections.
      </p>

      <H>How long we keep it</H>
      <p>
        As long as your account exists. Crash reports are deleted after 30 days. Daily backups are kept for 30 days and then deleted.
      </p>

      <H>Deleting your account</H>
      <p>
        Open <b>Profile → Delete my account</b> after logging in, or visit <Link to="/delete-account" className="font-medium text-[#8f6215] underline">{SITE.url.replace(/^https?:\/\//, "")}/delete-account</Link>.
        Your account, answers, marks, bookmarks and reports are deleted straight away and cannot be recovered. Copies in backups are gone within 30 days.
        If you cannot log in, email <Mail /> from your account's email address and we will delete it within 7 days.
      </p>

      <H>Students under 18</H>
      <p>
        Many of our students are in class 11 or 12. If you are under 18, please use {SITE.name} with your parent's or
        guardian's knowledge. Parents can ask us to see or delete their child's data at <Mail />.
      </p>

      <H>Changes and contact</H>
      <p>
        If this policy changes, we will update the date at the top. Questions? Email <Mail />.
      </p>
    </Shell>
  );
}

export function Terms() {
  return (
    <Shell title="Terms of use">
      <p>By creating an account or using {SITE.name}, you agree to these terms.</p>
      <H>Your account</H>
      <ul className="list-disc space-y-1 pl-6">
        <li>Give your real name, college and section so your tests reach you.</li>
        <li>Keep your password private. You are responsible for what happens in your account.</li>
        <li>One account per student. Do not share it.</li>
      </ul>
      <H>Tests and fair use</H>
      <ul className="list-disc space-y-1 pl-6">
        <li>Write live tests and mock tests on your own. Do not copy, share questions during a test, or use other apps or people to answer.</li>
        <li>Mock tests may watch for leaving the test screen; the test can be submitted automatically if you do this too often.</li>
        <li>Questions, solutions and test papers belong to {SITE.owner} and your college. Do not copy or publish them.</li>
      </ul>
      <H>Marks and mistakes</H>
      <p>
        We work hard to keep questions correct. If you think a question is wrong, use the flag on the question. If the head
        lecturer agrees, everyone who got that question gets full marks for it. Marks shown in {SITE.name} are for practice and
        are not official exam results.
      </p>
      <H>Suspension</H>
      <p>We may suspend accounts that cheat, misuse the site or harm other users.</p>
      <H>The service</H>
      <p>
        We try to keep {SITE.name} working at all times but cannot promise it will never be unavailable. We may change or improve features.
      </p>
      <H>Contact</H>
      <p>Email <Mail />.</p>
    </Shell>
  );
}
