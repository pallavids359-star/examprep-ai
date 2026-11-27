import { useState } from "react";
import api, { getErrorMessage } from "../api/axios";
import PasswordInput from "./PasswordInput";

// The delete form, used on the public page and in Profile
export default function DeleteAccountForm({ onDeleted }) {
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
        <PasswordInput required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-rose-400" />
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
