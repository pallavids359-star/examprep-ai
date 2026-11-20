import { useEffect, useState } from "react";
import api, { getErrorMessage } from "../../api/axios";
import AdminLayout from "../../components/AdminLayout";
import { askConfirm } from "../../components/ConfirmDialog";
import { toast } from "../../components/Toaster";
import { LECTURER_SUBJECTS, fmtDateTime, subjectName } from "../../components/liveHelpers";
import { Hero } from "../../components/premium";

const input = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-amber-500 focus:outline-none";
const initials = (n = "") =>
  n
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("") || "?";

// Lecturer accounts: they log in and pick questions for their live-test subjects
export default function Lecturers() {
  const [list, setList] = useState(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("physics");
  const [form, setForm] = useState({ name: "", email: "", password: "", subject: "physics" });
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState(null);
  const [edit, setEdit] = useState({ name: "", email: "", password: "", subject: "" });

  const load = () =>
    api
      .get("/admin/lecturers")
      .then((res) => setList(res.data.lecturers))
      .catch((err) => setError(getErrorMessage(err)));
  useEffect(() => {
    load();
  }, []);

  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/admin/lecturers", form);
      toast(`Account created for ${form.name}. Share the email and password with them.`);
      setTab(form.subject);
      setForm({ name: "", email: "", password: "", subject: form.subject });
      load();
    } catch (err) {
      toast(getErrorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (l) => {
    setEditId(l._id);
    setEdit({ name: l.name, email: l.email, password: "", subject: l.subject || "" });
  };

  const saveEdit = async (e, l) => {
    e.preventDefault();
    const body = {};
    if (edit.name.trim() !== l.name) body.name = edit.name.trim();
    if (edit.email.trim().toLowerCase() !== l.email) body.email = edit.email.trim();
    if (edit.password) body.password = edit.password;
    if (edit.subject && edit.subject !== l.subject) body.subject = edit.subject;
    if (!Object.keys(body).length) return setEditId(null);
    setBusy(true);
    try {
      await api.put(`/admin/lecturers/${l._id}`, body);
      toast(
        body.email || body.password
          ? `Saved. ${l.name.split(" ")[0]} now logs in with ${body.email ? `the new email${body.password ? " and password" : ""}` : "the new password"} — share it with them.`
          : "Saved"
      );
      setEditId(null);
      load();
    } catch (err) {
      toast(getErrorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (l, status) => {
    if (status === "suspended" && !(await askConfirm(`Suspend ${l.name}? They won't be able to log in.`, { confirmText: "Suspend" }))) return;
    try {
      await api.put(`/admin/lecturers/${l._id}`, { status });
      toast(status === "active" ? `${l.name} can log in again` : `${l.name} is suspended`);
      load();
    } catch (err) {
      toast(getErrorMessage(err), "error");
    }
  };

  const lecturers = (list || []).filter((l) => l.role === "lecturer");
  const noSubject = lecturers.filter((l) => !l.subject);
  const shown = tab === "none" ? noSubject : lecturers.filter((l) => l.subject === tab);
  const tabs = [...LECTURER_SUBJECTS.map(([k, l]) => [k, l, lecturers.filter((x) => x.subject === k).length]), ...(noSubject.length ? [["none", "No subject yet", noSubject.length]] : [])];

  return (
    <AdminLayout>
      <Hero
        eyebrow="People"
        title="Lecturers"
        subtitle="Lecturers log in at the normal login page and only see the subjects you give them in live tests. Typed a wrong name or email? Press Edit."
      />

      {/* Subject tabs */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4" role="tablist">
        {tabs.map(([k, l, n]) => {
          const on = tab === k;
          return (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => {
                setTab(k);
                if (k !== "none") setForm((f) => ({ ...f, subject: k }));
                setEditId(null);
              }}
              className={`flex items-center gap-3 rounded-2xl p-4 text-left transition ${on ? "bg-slate-900 text-white shadow-lg ring-2 ring-amber-300" : "gp-card gp-card-hover"}`}
            >
              <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl font-display text-lg font-extrabold ${on ? "bg-amber-300 text-slate-900" : k === "none" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}`}>
                {k === "none" ? "!" : l[0]}
              </span>
              <span className="min-w-0">
                <span className={`block font-bold ${on ? "text-white" : "text-slate-900"}`}>{l}</span>
                <span className={`text-xs ${on ? "text-amber-100/80" : "text-slate-500"}`}>
                  {n} lecturer{n === 1 ? "" : "s"}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {noSubject.length > 0 && tab !== "none" && (
        <p className="mt-3 rounded-xl bg-orange-50 px-4 py-2.5 text-sm text-orange-900">
          {noSubject.length} lecturer{noSubject.length === 1 ? " has" : "s have"} no subject yet.{" "}
          <button type="button" onClick={() => setTab("none")} className="font-semibold underline">
            Set it
          </button>{" "}
          so they show up under the right subject.
        </p>
      )}

      <form onSubmit={create} className="gp-card mt-5 grid gap-3 p-5 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
        {tab === "none" && (
          <label className="text-sm font-medium text-slate-700 sm:col-span-4">
            Subject
            <SubjectPick value={form.subject} onChange={(v) => setForm({ ...form, subject: v })} />
          </label>
        )}
        <p className="text-sm font-bold text-slate-900 sm:col-span-4">Add a {tab === "none" ? "" : subjectName(form.subject)} lecturer</p>
        <label className="text-sm font-medium text-slate-700">
          Name
          <input className={`${input} mt-1`} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} placeholder="e.g. Priya (Biology)" />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Email
          <input type="email" className={`${input} mt-1`} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Password
          <input type="text" className={`${input} mt-1`} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} placeholder="At least 8 characters" />
        </label>
        <button type="submit" disabled={busy} className="gp-gold-btn px-5 py-2.5 text-sm disabled:opacity-50">
          {busy ? "Adding..." : "+ Add lecturer"}
        </button>
      </form>

      {error && <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {!list && !error && <div className="gp-card mt-6 h-40 animate-pulse bg-white/60" />}

      {list && (
        <div className="mt-6 grid gap-3">
          {shown.length === 0 && (
            <div className="gp-card px-6 py-10 text-center text-sm text-slate-500">
              No {tab === "none" ? "lecturers without a subject" : `${subjectName(tab)} lecturers`} yet.{tab !== "none" && " Add one above."}
            </div>
          )}
          {shown.map((l) => {
            const isEditing = editId === l._id;
            return (
              <div key={l._id} className="gp-card p-4">
                {!isEditing ? (
                  <div className="flex flex-wrap items-center gap-4">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-slate-900 text-sm font-extrabold text-amber-200">{initials(l.name)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-900">
                        {l.name}
                        {l.role === "admin" && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">Head lecturer</span>}
                      </p>
                      <p className="truncate text-sm text-slate-500">
                        {l.email} · <span className="font-semibold text-amber-800">{subjectName(l.subject)}</span>
                      </p>
                    </div>
                    <div className="text-sm text-slate-600">
                      <span className="font-semibold text-slate-900">{l.sections}</span> subject{l.sections === 1 ? "" : "s"}
                    </div>
                    <div className="hidden text-sm text-slate-500 md:block">Last login: {l.lastLoginAt ? fmtDateTime(l.lastLoginAt) : "never"}</div>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${l.status === "active" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                      {l.status === "active" ? "Active" : "Suspended"}
                    </span>
                    {l.role === "lecturer" && (
                      <div className="flex gap-2">
                        <button type="button" onClick={() => startEdit(l)} className="rounded-lg bg-slate-900 px-3.5 py-1.5 text-sm font-semibold text-amber-200 hover:bg-black">
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setStatus(l, l.status === "active" ? "suspended" : "active")}
                          className="rounded-lg border border-slate-200 px-3.5 py-1.5 text-sm font-semibold text-slate-600 hover:border-amber-300"
                        >
                          {l.status === "active" ? "Suspend" : "Activate"}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <form onSubmit={(e) => saveEdit(e, l)} className="grid gap-3 sm:grid-cols-3 sm:items-end">
                    <p className="text-sm font-bold text-slate-900 sm:col-span-3">Edit {l.name}</p>
                    <label className="text-sm font-medium text-slate-700">
                      Name
                      <input className={`${input} mt-1`} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} required minLength={2} autoFocus />
                    </label>
                    <label className="text-sm font-medium text-slate-700">
                      Email (used to log in)
                      <input type="email" className={`${input} mt-1`} value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} required />
                    </label>
                    <label className="text-sm font-medium text-slate-700">
                      New password <span className="font-normal text-slate-400">(leave empty to keep)</span>
                      <input type="text" className={`${input} mt-1`} value={edit.password} onChange={(e) => setEdit({ ...edit, password: e.target.value })} minLength={8} placeholder="At least 8 characters" />
                    </label>
                    <label className="text-sm font-medium text-slate-700 sm:col-span-3">
                      Subject
                      <SubjectPick value={edit.subject} onChange={(v) => setEdit({ ...edit, subject: v })} />
                    </label>
                    <div className="flex justify-end gap-2 sm:col-span-3">
                      <button type="button" onClick={() => setEditId(null)} className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">
                        Cancel
                      </button>
                      <button type="submit" disabled={busy} className="gp-gold-btn px-5 py-2 text-sm disabled:opacity-50">
                        {busy ? "Saving..." : "Save changes"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}
    </AdminLayout>
  );
}

function SubjectPick({ value, onChange }) {
  return (
    <div className="mt-1 grid grid-cols-4 gap-2">
      {LECTURER_SUBJECTS.map(([k, l]) => (
        <button key={k} type="button" aria-pressed={value === k} onClick={() => onChange(k)} className="gp-tile py-2 text-sm font-semibold text-slate-800">
          {l}
        </button>
      ))}
    </div>
  );
}
