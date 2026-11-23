import { toast } from "./Toaster";
import { useState } from "react";
import api, { getErrorMessage } from "../api/axios";

const input = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200";
const label = "block text-sm font-medium text-slate-700";
const card = "bg-white rounded-2xl border border-slate-200 shadow-sm p-5 md:p-6";

function Note({ note }) {
  if (!note) return null;
  return <p className={`mt-4 rounded-lg px-3 py-2 text-sm ${note.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{note.text}</p>;
}

// Name, phone, class and target year
export function DetailsForm({ profile, onSaved }) {
  const year = new Date().getFullYear();
  const [form, setForm] = useState({
    name: profile.name,
    phone: profile.phone,
    classLevel: profile.classLevel,
    targetYear: profile.targetYear || "",
    college: !profile.college || profile.college.toLowerCase() === "mbpu" ? "MBPU" : "Other",
    otherCollege: profile.college && profile.college.toLowerCase() !== "mbpu" ? profile.college : "",
    section: profile.section || "",
  });
  const isMB = form.college === "MBPU";
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState(null);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setNote(null);
    try {
      if (form.college === "Other" && !form.otherCollege.trim()) throw new Error("Enter your college name");
      if (isMB && !form.section) throw new Error("Choose your section");
      const { otherCollege, ...rest } = form;
      const res = await api.put("/auth/profile", {
        ...rest,
        college: form.college === "Other" ? otherCollege.trim() : "MBPU",
        section: isMB ? form.section : "",
        targetYear: form.targetYear ? Number(form.targetYear) : null,
      });
      onSaved(res.data.user);
      toast("Your details were saved.");
    } catch (err) {
      setNote({ ok: false, text: err.response ? getErrorMessage(err) : err.message });
    }
    setSaving(false);
  };

  return (
    <form onSubmit={save} className={card}>
      <h2 className="font-semibold text-slate-900">Your details</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className={label + " sm:col-span-2"}>
          Full name
          <input value={form.name} onChange={set("name")} required minLength={2} maxLength={60} className={input} />
        </label>
        <label className={label}>
          Email
          <input value={profile.email} disabled className={input + " bg-slate-50 text-slate-500"} />
        </label>
        <label className={label}>
          Mobile (optional)
          <input value={form.phone} onChange={set("phone")} inputMode="tel" placeholder="10-digit number" className={input} />
        </label>
        <label className={label}>
          Class
          <select value={form.classLevel} onChange={set("classLevel")} className={input}>
            <option value="">Choose</option>
            <option value="11">Class 11</option>
            <option value="12">Class 12</option>
            <option value="dropper">Dropper / repeater</option>
          </select>
        </label>
        <label className={label}>
          College
          <select value={form.college} onChange={(e) => setForm((f) => ({ ...f, college: e.target.value, section: e.target.value === "MBPU" ? f.section : "" }))} className={input}>
            <option value="MBPU">MBPU</option>
            <option value="Other">Other</option>
          </select>
        </label>
        {isMB ? (
          <div className={label}>
            Section
            <div className="mt-1 flex gap-2" role="radiogroup" aria-label="Section">
              {["A", "B", "C", "D"].map((x) => (
                <button
                  key={x}
                  type="button"
                  role="radio"
                  aria-checked={form.section === x}
                  onClick={() => setForm((f) => ({ ...f, section: x }))}
                  className={`h-10 w-12 rounded-lg border text-sm font-bold transition ${form.section === x ? "border-[#17140f] bg-[#17140f] text-[#e5c372]" : "border-slate-300 bg-white text-slate-700 hover:border-[#c9a24a]"}`}
                >
                  {x}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <label className={label}>
            College name
            <input value={form.otherCollege} onChange={set("otherCollege")} placeholder="Type your college name" maxLength={120} className={input} />
          </label>
        )}
        <label className={label}>
          Target exam year
          <select value={form.targetYear} onChange={set("targetYear")} className={input}>
            <option value="">Choose</option>
            {[0, 1, 2, 3].map((i) => (
              <option key={i} value={year + i}>{year + i}</option>
            ))}
          </select>
        </label>
      </div>
      <Note note={note} />
      <button disabled={saving} className="mt-5 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
        {saving ? "Saving..." : "Save details"}
      </button>
    </form>
  );
}

const strength = (p) => {
  let s = 0;
  if (p.length >= 8) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  return [
    { text: "Too short", cls: "bg-red-500", w: "15%" },
    { text: "Weak", cls: "bg-red-500", w: "30%" },
    { text: "Okay", cls: "bg-amber-500", w: "55%" },
    { text: "Good", cls: "bg-emerald-500", w: "80%" },
    { text: "Strong", cls: "bg-emerald-600", w: "100%" },
  ][p.length < 6 ? 0 : Math.max(1, s)];
};

// Current password + new password twice
export function PasswordForm() {
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState(null);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const s = strength(form.next);

  const save = async (e) => {
    e.preventDefault();
    if (form.next !== form.confirm) return setNote({ ok: false, text: "The new passwords don't match." });
    setSaving(true);
    setNote(null);
    try {
      await api.put("/auth/password", { currentPassword: form.current, newPassword: form.next });
      setForm({ current: "", next: "", confirm: "" });
      toast("Password changed. Use the new one next time you log in.");
    } catch (err) {
      setNote({ ok: false, text: err.response ? getErrorMessage(err) : err.message });
    }
    setSaving(false);
  };

  const type = show ? "text" : "password";
  return (
    <form onSubmit={save} className={card}>
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-900">Change password</h2>
        <button type="button" onClick={() => setShow((v) => !v)} className="text-xs font-medium text-indigo-600 hover:underline">
          {show ? "Hide" : "Show"} passwords
        </button>
      </div>
      <div className="mt-4 space-y-4">
        <label className={label}>
          Current password
          <input type={type} value={form.current} onChange={set("current")} required autoComplete="current-password" className={input} />
        </label>
        <label className={label}>
          New password
          <input type={type} value={form.next} onChange={set("next")} required minLength={6} autoComplete="new-password" className={input} />
        </label>
        {form.next && (
          <div>
            <div className="h-1.5 rounded-full bg-slate-100">
              <div className={`h-1.5 rounded-full ${s.cls}`} style={{ width: s.w }} />
            </div>
            <p className="mt-1 text-xs text-slate-500">{s.text}. Use 8+ characters with letters, numbers and a symbol.</p>
          </div>
        )}
        <label className={label}>
          Confirm new password
          <input type={type} value={form.confirm} onChange={set("confirm")} required autoComplete="new-password" className={input} />
        </label>
      </div>
      <Note note={note} />
      <button disabled={saving} className="mt-5 rounded-lg border border-indigo-200 px-5 py-2.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-60">
        {saving ? "Changing..." : "Change password"}
      </button>
    </form>
  );
}