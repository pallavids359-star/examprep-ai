import { useState } from "react";
import { Link } from "react-router-dom";
import api, { getErrorMessage } from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { SITE } from "../content/site";

// The delete form, used on the public page and in Profile
export function DeleteAccountForm({ onDeleted }) {
  const [password, setPassword] = useState("");
  const [sure, setSure] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.delete("/auth/account", { data: { password } });
      onDeleted();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-sm text-slate-600">
        This deletes your account, answers, marks, ranks, bookmarks and reports. <b>It cannot be undone.</b>
      </p>
      <label className="block text-sm font-medium text-slate-700">
        Your password
        <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-rose-400" />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Type <b>DELETE</b> to confirm
        <input required value={sure} onChange={(e) => setSure(e.target.value)} autoCapitalize="characters" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-rose-400" />
      </label>
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      <button disabled={busy || sure.trim().toUpperCase() !== "DELETE" || !password} className="w-full rounded-xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50">
        {busy ? "Deleting..." : "Delete my account forever"}
      </button>
    </form>
  );
}

// Public page: /delete-account (the web link Google Play asks for)
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
