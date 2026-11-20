import { useEffect, useState } from "react";
import api, { getErrorMessage } from "../../api/axios";
import AdminLayout from "../../components/AdminLayout";
import { askConfirm } from "../../components/ConfirmDialog";
import { toast } from "../../components/Toaster";
import { fmtDateTime } from "../../components/liveHelpers";

// Lecturer accounts: they log in and pick questions for their live-test sections
export default function Lecturers() {
  const [list, setList] = useState(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);

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
      setForm({ name: "", email: "", password: "" });
      load();
    } catch (err) {
      toast(getErrorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (l, status) => {
    if (status === "suspended" && !(await askConfirm(`Suspend ${l.name}? They won't be able to log in.`))) return;
    try {
      await api.put(`/admin/lecturers/${l._id}`, { status });
      load();
    } catch (err) {
      toast(getErrorMessage(err), "error");
    }
  };

  const resetPassword = async (l) => {
    const password = window.prompt(`New password for ${l.name} (at least 8 characters):`);
    if (!password) return;
    try {
      await api.put(`/admin/lecturers/${l._id}`, { password });
      toast("Password changed. Share it with the lecturer.");
    } catch (err) {
      toast(getErrorMessage(err), "error");
    }
  };

  const input = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-600 focus:outline-none";

  return (
    <AdminLayout title="Lecturers">
      <p className="text-sm text-slate-500">Lecturers log in at the normal login page and only see the live-test sections you give them.</p>

      <form onSubmit={create} className="mt-5 grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-4 sm:items-end">
        <label className="text-sm font-medium text-slate-700">
          Name
          <input className={`${input} mt-1`} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Email
          <input type="email" className={`${input} mt-1`} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Password
          <input type="text" className={`${input} mt-1`} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} placeholder="At least 8 characters" />
        </label>
        <button type="submit" disabled={busy} className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
          {busy ? "Adding..." : "Add lecturer"}
        </button>
      </form>

      {error && <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {!list && !error && <p className="mt-6 text-sm text-slate-500">Loading...</p>}
      {list && (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Sections</th>
                <th className="px-4 py-3">Last login</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {list.map((l) => (
                <tr key={l._id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{l.name}</p>
                    <p className="text-xs text-slate-500">{l.email}</p>
                  </td>
                  <td className="px-4 py-3">{l.role === "admin" ? "Head lecturer (admin)" : "Lecturer"}</td>
                  <td className="px-4 py-3">{l.sections}</td>
                  <td className="px-4 py-3">{l.lastLoginAt ? fmtDateTime(l.lastLoginAt) : "Never"}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${l.status === "active" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{l.status}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    {l.role === "lecturer" && (
                      <>
                        <button type="button" onClick={() => resetPassword(l)} className="mr-4 font-medium text-indigo-700 hover:underline">
                          New password
                        </button>
                        <button type="button" onClick={() => setStatus(l, l.status === "active" ? "suspended" : "active")} className="font-medium text-slate-600 hover:underline">
                          {l.status === "active" ? "Suspend" : "Activate"}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  );
}
