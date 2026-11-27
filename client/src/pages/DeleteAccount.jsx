import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { SITE } from "../content/site";
import DeleteAccountForm from "../components/DeleteAccountForm";

// Public page: /delete-account (delete your account without logging in to the dashboard)
export default function DeleteAccount() {
  const { user, logout } = useAuth();
  const [done, setDone] = useState(false);

  return (
    <div className="min-h-screen bg-[#fbf8f1] px-5 py-10">
      <div className="mx-auto max-w-md">
        <Link to="/" className="flex items-center gap-2">
          <img src="/genprep-icon.png" alt="" className="h-9 w-9 rounded-lg" />
          <span className="gp-brand text-xl">{SITE.name}</span>
        </Link>
        <div className="mt-6 rounded-2xl border border-[#efe6d2] bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-extrabold text-slate-900">Delete your account</h1>
          {done ? (
            <p className="mt-3 text-slate-700">Your account and all your data have been deleted. Thank you for using {SITE.name}.</p>
          ) : user ? (
            user.role === "student" ? (
              <div className="mt-4">
                <p className="mb-4 text-sm text-slate-600">Logged in as <b>{user.email}</b>.</p>
                <DeleteAccountForm onDeleted={() => { setDone(true); logout(); }} />
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-600">Lecturer and admin accounts are removed by the head lecturer.</p>
            )
          ) : (
            <div className="mt-3 space-y-4 text-sm text-slate-600">
              <p>Log in to delete your {SITE.name} account and everything saved in it: answers, marks, ranks, bookmarks and reports.</p>
              <Link to="/login?next=/delete-account" className="block rounded-xl bg-[#17140f] px-4 py-3 text-center font-semibold text-[#e5c372]">
                Log in to continue
              </Link>
              <p>
                Can't log in? Email <a href={`mailto:${SITE.contactEmail}?subject=Delete my GenPrep account`} className="font-medium text-[#8f6215] underline">{SITE.contactEmail}</a> from
                your account's email address, and we will delete it within 7 days.
              </p>
            </div>
          )}
        </div>
        <p className="mt-4 text-center text-xs text-slate-500">
          <Link to="/privacy" className="underline">Privacy policy</Link> · <Link to="/terms" className="underline">Terms</Link>
        </p>
      </div>
    </div>
  );
}
