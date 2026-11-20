import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api, { getErrorMessage } from "../../api/axios";
import AdminLayout from "../../components/AdminLayout";
import { toast } from "../../components/Toaster";
import { toLocalInput } from "../../components/liveHelpers";

// Head lecturer: create a live test, or edit one that is still a draft
const input = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-600 focus:outline-none";
const pill = (on) =>
  `rounded-lg border px-4 py-2 text-sm font-medium ${on ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-slate-300 text-slate-700 hover:border-slate-400"}`;

const rowsFrom = (sections, previous = []) =>
  sections.map((s) => {
    const old = previous.find((p) => p.key === s.key);
    return {
      key: s.key,
      name: s.name,
      include: old ? old.include : true,
      lecturerId: old?.lecturerId || "",
      mcqCount: old?.mcqCount ?? s.mcqCount,
      numericalCount: old?.numericalCount ?? s.numericalCount,
      dueAt: old?.dueAt || "",
    };
  });

export default function LiveTestForm() {
  const { id } = useParams(); // editing when set
  const navigate = useNavigate();
  const [exams, setExams] = useState([]);
  const [lecturers, setLecturers] = useState([]);
  const [pattern, setPattern] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    examId: "",
    title: "",
    startsAt: "",
    endsAt: "",
    durationMinutes: 180,
    splitBiology: false,
    showResults: "after_close",
    shuffle: true,
    instructions: "",
  });
  const [rows, setRows] = useState([]);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  // Exams, lecturers, and the test itself when editing
  useEffect(() => {
    Promise.all([api.get("/exams"), api.get("/admin/lecturers")])
      .then(([e, l]) => {
        setExams(e.data.exams);
        setLecturers(l.data.lecturers.filter((x) => x.status === "active"));
      })
      .catch((err) => setError(getErrorMessage(err)));
    if (!id) return;
    api
      .get(`/admin/live-tests/${id}`)
      .then((res) => {
        const t = res.data.test;
        if (t.status !== "draft") {
          navigate(`/admin/live-tests/${id}`, { replace: true });
          return;
        }
        setForm({
          examId: t.examId,
          title: t.title,
          startsAt: toLocalInput(t.startsAt),
          endsAt: toLocalInput(t.endsAt),
          durationMinutes: t.durationMinutes,
          splitBiology: Boolean(t.live?.splitBiology),
          showResults: t.live?.showResults || "after_close",
          shuffle: t.live?.shuffle !== false,
          instructions: t.instructions || "",
          _sections: t.sections,
        });
      })
      .catch((err) => setError(getErrorMessage(err)));
  }, [id, navigate]);

  // The exam's sections
  useEffect(() => {
    if (!form.examId) return;
    api
      .get("/admin/live-tests/pattern", { params: { examId: form.examId } })
      .then((res) => {
        setPattern(res.data);
        if (!id) set({ durationMinutes: res.data.minutes });
      })
      .catch((err) => {
        setPattern(null);
        setError(getErrorMessage(err));
      });
  }, [form.examId, id]);

  // Rebuild the rows when the exam or the Biology split changes (keeping what was typed)
  useEffect(() => {
    if (!pattern) return;
    const defs = form.splitBiology && pattern.splitSections ? pattern.splitSections : pattern.sections;
    setRows((prev) => {
      const saved = form._sections
        ? form._sections.map((s) => ({
            key: s.key,
            include: true,
            lecturerId: s.lecturer?._id || "",
            mcqCount: s.mcqCount,
            numericalCount: s.numericalCount,
            dueAt: toLocalInput(s.dueAt),
          }))
        : null;
      const base = prev.length ? prev : saved || [];
      const next = rowsFrom(defs, base);
      if (saved && !prev.length) next.forEach((r) => (r.include = saved.some((s) => s.key === r.key)));
      return next;
    });
  }, [pattern, form.splitBiology, form._sections]);

  const setRow = (key, patch) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const included = rows.filter((r) => r.include);
  const totalQs = included.reduce((a, r) => a + Number(r.mcqCount || 0) + Number(r.numericalCount || 0), 0);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!included.length) return setError("Include at least one section");
    if (included.some((r) => !r.lecturerId)) return setError("Choose a lecturer for every included section");
    setSaving(true);
    const body = {
      examId: form.examId,
      title: form.title,
      startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : "",
      endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : "",
      durationMinutes: Number(form.durationMinutes),
      splitBiology: form.splitBiology,
      showResults: form.showResults,
      shuffle: form.shuffle,
      instructions: form.instructions,
      sections: included.map((r) => ({
        key: r.key,
        lecturerId: r.lecturerId,
        mcqCount: Number(r.mcqCount),
        numericalCount: Number(r.numericalCount),
        dueAt: r.dueAt ? new Date(r.dueAt).toISOString() : undefined,
      })),
    };
    try {
      if (id) {
        await api.put(`/admin/live-tests/${id}`, body);
        toast("Saved");
        navigate(`/admin/live-tests/${id}`);
      } else {
        const res = await api.post("/admin/live-tests", body);
        toast("Live test created. The lecturers can now pick their questions.");
        navigate(`/admin/live-tests/${res.data.testId}`);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout title={id ? "Edit live test" : "New live test"}>
      <Link to={id ? `/admin/live-tests/${id}` : "/admin/live-tests"} className="text-sm font-medium text-indigo-700 hover:underline">
        ← Back
      </Link>
      <form onSubmit={submit} className="mt-4 max-w-4xl space-y-5">
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">1. Test details</h2>
          <div>
            <p className="text-sm font-medium text-slate-700">Exam</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {exams.map((e) => (
                <button
                  key={e._id}
                  type="button"
                  disabled={Boolean(id)}
                  className={pill(form.examId === e._id)}
                  onClick={() => {
                    setRows([]);
                    set({ examId: e._id, splitBiology: false, _sections: undefined });
                  }}
                >
                  {e.code}
                </button>
              ))}
            </div>
          </div>
          <label className="block text-sm font-medium text-slate-700">
            Test name
            <input className={`${input} mt-1`} value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. JEE Live Test 4 – Mechanics" required minLength={3} maxLength={140} />
          </label>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block text-sm font-medium text-slate-700">
              Opens
              <input type="datetime-local" className={`${input} mt-1`} value={form.startsAt} onChange={(e) => set({ startsAt: e.target.value })} required />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Closes
              <input type="datetime-local" className={`${input} mt-1`} value={form.endsAt} onChange={(e) => set({ endsAt: e.target.value })} required />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Duration (minutes)
              <input type="number" min={5} max={360} className={`${input} mt-1`} value={form.durationMinutes} onChange={(e) => set({ durationMinutes: e.target.value })} required />
            </label>
          </div>
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Students can start any time between opening and closing. Each gets the full {form.durationMinutes || "—"} minutes from when they start, but never past the closing time.
          </p>
          <label className="block text-sm font-medium text-slate-700">
            Instructions for students <span className="font-normal text-slate-500">(optional)</span>
            <textarea rows={3} className={`${input} mt-1`} value={form.instructions} onChange={(e) => set({ instructions: e.target.value })} maxLength={4000} />
          </label>
        </section>

        {pattern && (
          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-semibold text-slate-900">2. Sections and lecturers</h2>
              <span className="text-sm text-slate-500">{totalQs} questions in total</span>
            </div>
            {pattern.canSplitBiology && (
              <label className="flex items-start gap-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-800">
                <input type="checkbox" className="mt-0.5 h-4 w-4 accent-indigo-600" checked={form.splitBiology} onChange={(e) => set({ splitBiology: e.target.checked })} />
                <span>
                  Split Biology into <b>Botany</b> and <b>Zoology</b>, each with its own lecturer
                </span>
              </label>
            )}
            {lecturers.length === 0 && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                No lecturers yet.{" "}
                <Link to="/admin/lecturers" className="font-semibold underline">
                  Add lecturers
                </Link>{" "}
                first.
              </p>
            )}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="text-left text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="py-2 pr-2">Include</th>
                    <th className="py-2 pr-2">Section</th>
                    <th className="py-2 pr-2">Lecturer</th>
                    <th className="py-2 pr-2">MCQ</th>
                    <th className="py-2 pr-2">Numerical</th>
                    <th className="py-2">Hand in by (optional)</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.key} className={`border-t border-slate-100 ${r.include ? "" : "opacity-50"}`}>
                      <td className="py-2 pr-2">
                        <input type="checkbox" aria-label={`Include ${r.name}`} className="h-4 w-4 accent-indigo-600" checked={r.include} onChange={(e) => setRow(r.key, { include: e.target.checked })} />
                      </td>
                      <td className="py-2 pr-2 font-semibold text-slate-900">{r.name}</td>
                      <td className="py-2 pr-2">
                        <select aria-label={`Lecturer for ${r.name}`} className={input} value={r.lecturerId} disabled={!r.include} onChange={(e) => setRow(r.key, { lecturerId: e.target.value })}>
                          <option value="">Choose...</option>
                          {lecturers.map((l) => (
                            <option key={l._id} value={l._id}>
                              {l.name}
                              {l.role === "admin" ? " (head)" : ""}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="w-24 py-2 pr-2">
                        <input type="number" aria-label={`MCQs in ${r.name}`} min={0} max={200} className={input} value={r.mcqCount} disabled={!r.include} onChange={(e) => setRow(r.key, { mcqCount: e.target.value })} />
                      </td>
                      <td className="w-24 py-2 pr-2">
                        <input type="number" aria-label={`Numericals in ${r.name}`} min={0} max={50} className={input} value={r.numericalCount} disabled={!r.include} onChange={(e) => setRow(r.key, { numericalCount: e.target.value })} />
                      </td>
                      <td className="py-2">
                        <input type="datetime-local" aria-label={`Due time for ${r.name}`} className={input} value={r.dueAt} disabled={!r.include} onChange={(e) => setRow(r.key, { dueAt: e.target.value })} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500">Changing a section's lecturer or counts later re-opens it for picking.</p>
          </section>
        )}

        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">3. Results and order</h2>
          <div className="space-y-2 text-sm text-slate-800">
            <label className="flex items-center gap-2">
              <input type="radio" name="results" className="accent-indigo-600" checked={form.showResults === "after_close"} onChange={() => set({ showResults: "after_close" })} />
              Show results after the test closes (everyone gets their final rank)
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="results" className="accent-indigo-600" checked={form.showResults === "after_submit"} onChange={() => set({ showResults: "after_submit" })} />
              Show results right after each student submits (rank changes as others finish)
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-800">
            <input type="checkbox" className="h-4 w-4 accent-indigo-600" checked={form.shuffle} onChange={(e) => set({ shuffle: e.target.checked })} />
            Shuffle question order for each student (sections stay in order, numericals stay last)
          </label>
        </section>

        {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        <div className="flex justify-end gap-3">
          <button type="submit" disabled={saving || !form.examId} className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
            {saving ? "Saving..." : id ? "Save changes" : "Create and send to lecturers"}
          </button>
        </div>
      </form>
    </AdminLayout>
  );
}
