import MathText from "../../components/MathText";
import BackLink from "../../components/BackLink";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import api, { getErrorMessage } from "../../api/axios";
import AdminLayout from "../../components/AdminLayout";
import { toast } from "../../components/Toaster";
import SyllabusPicker from "../../components/SyllabusPicker";
import OptionsEditor from "../../components/OptionsEditor";
import QuestionImages from "../../components/QuestionImages";
import { usePasteImage } from "../../components/ImageTools";
import Loading from "../../components/Loading";

const inputClass =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";
const blankOptions = () => ["A", "B", "C", "D"].map((id) => ({ id, text: "" }));
const EMPTY = {
    type: "mcq_single",
    text: "",
    options: blankOptions(),
    correctOptionIds: [],
    explanation: "",
    difficulty: "medium",
    sourceKind: "original",
    sourceYear: "",
    tags: "",
  images: [],
    status: "published",
};

function Field({ label, children }) {
    return (
        <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">{label}</span>
            {children}
        </label>
    );
}

export default function QuestionForm() {
    const { id } = useParams(); // "new" or a question id
    const isNew = id === "new";
    const navigate = useNavigate();
    // Opened from a live test paper: go back there after saving
    const [search] = useSearchParams();
    const back = (search.get("back") || "").startsWith("/") ? search.get("back") : "/admin/questions";

    const [place, setPlace] = useState({ examId: localStorage.getItem("examId") || "", subjectId: "", chapterId: "", topicId: "" });
    const [form, setForm] = useState(EMPTY);
    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [note, setNote] = useState("");

    // Editing: load the question into the form
    useEffect(() => {
        if (isNew) return;
        api
            .get(`/admin/questions/${id}`)
            .then((res) => {
                const q = res.data.question;
                setPlace({ examId: q.examId, subjectId: q.subjectId, chapterId: q.chapterId, topicId: q.topicId });
                setForm({
                    type: q.type,
                    text: q.text,
                    options: q.options.length ? q.options.map((o) => ({ id: o.id, text: o.text, image: o.image })) : blankOptions(),
                    correctOptionIds: q.correctOptionIds || [],
                    explanation: q.explanation?.text || "",
                    difficulty: q.difficulty,
                    sourceKind: q.source?.kind || "original",
                    sourceYear: q.source?.year || "",
                    tags: (q.tags || []).join(", "),
          images: q.images || [],
                    status: q.status === "archived" ? "draft" : q.status,
                });
            })
            .catch((err) => setError(getErrorMessage(err)))
            .finally(() => setLoading(false));
    }, [id, isNew]);

    const update = (key, value) => setForm((f) => ({ ...f, [key]: value }));
    const setOptionText = (optId, text) => update("options", form.options.map((o) => (o.id === optId ? { ...o, text } : o)));
    const setOptionImage = (optId, image) => update("options", form.options.map((o) => (o.id === optId ? { ...o, image } : o)));
    // Ctrl+V of a picture into the question box adds it to the question images
    const pasteIntoQuestion = usePasteImage((img) => setForm((f) => ({ ...f, images: [...(f.images || []), img] })), setError);
    const toggleCorrect = (optId) => {
        if (form.type === "mcq_single") return update("correctOptionIds", [optId]);
        const list = form.correctOptionIds;
        update("correctOptionIds", list.includes(optId) ? list.filter((x) => x !== optId) : [...list, optId].sort());
    };
    const changeType = (type) =>
        setForm((f) => ({ ...f, type, correctOptionIds: type === "mcq_single" ? f.correctOptionIds.slice(0, 1) : f.correctOptionIds }));

    const save = async (e, addAnother = false) => {
        e.preventDefault();
        setError("");
        setNote("");
        if (!place.topicId) return setError("Choose the exam, subject, chapter and topic first");

        const payload = {
            topicId: place.topicId,
            type: form.type,
            text: form.text,
            options: form.options,
            correctOptionIds: form.correctOptionIds,
            explanation: { text: form.explanation },
            difficulty: form.difficulty,
            source: { kind: form.sourceKind, ...(form.sourceYear ? { year: Number(form.sourceYear) } : {}) },
            tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
            status: form.status,
      images: form.images,
        };

        setSaving(true);
        try {
            if (isNew) await api.post("/admin/questions", payload);
            else {
                const res = await api.put(`/admin/questions/${id}`, payload);
                // Also sent to the main Supabase (Question Bank Portal)?
                const sb = res.data?.supabaseEdit;
                if (sb?.enabled && !sb.skipped) {
                    if (sb.error) toast(`Saved in GenPrep, but not in Supabase: ${sb.error}`, "error");
                    else if (sb.sent?.length) toast(`Saved in GenPrep and Supabase (${sb.sent.join(", ")})${sb.notSent?.length ? `. Not sent: ${sb.notSent.join(", ")}` : ""}`);
                    else if (sb.notSent?.length) toast(`Saved in GenPrep. Not sent to Supabase: ${sb.notSent.join(", ")}`, "error");
                }
            }

            if (addAnother) {
                setForm({ ...EMPTY, options: blankOptions(), difficulty: form.difficulty, status: form.status });
                setNote("Saved! Write the next question for the same topic.");
                window.scrollTo(0, 0);
            } else {
                navigate(back);
            }
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <AdminLayout title="Edit question">
                <Loading />
            </AdminLayout>
        );
    }

    return (
        <AdminLayout
            title={isNew ? "Add question" : "Edit question"}
            actions={<BackLink to={back}>{back === "/admin/questions" ? "All questions" : "Back to the paper"}</BackLink>}
        >
            <form onSubmit={(e) => save(e)} className="mt-6 space-y-4">
                {error && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-4 py-3">{error}</div>}
                {note && <div className="rounded-lg bg-green-50 text-green-700 text-sm px-4 py-3">{note}</div>}

                <section className="bg-white rounded-xl border border-slate-200 p-5">
                    <h2 className="font-semibold text-slate-900 mb-3">Where it belongs</h2>
                    <SyllabusPicker value={place} onChange={setPlace} levels={["exam", "subject", "chapter", "topic"]} />
                </section>

                <section className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
                    <div className="grid sm:grid-cols-3 gap-3">
                        <Field label="Type">
                            <select value={form.type} onChange={(e) => changeType(e.target.value)} className={inputClass}>
                                <option value="mcq_single">One correct answer</option>
                                <option value="mcq_multi">More than one correct</option>
                            </select>
                        </Field>
                        <Field label="Difficulty">
                            <select value={form.difficulty} onChange={(e) => update("difficulty", e.target.value)} className={inputClass}>
                                <option value="easy">Easy</option>
                                <option value="medium">Medium</option>
                                <option value="hard">Hard</option>
                            </select>
                        </Field>
                        <Field label="Status">
                            <select value={form.status} onChange={(e) => update("status", e.target.value)} className={inputClass}>
                                <option value="published">Published (students can see it)</option>
                                <option value="draft">Draft (hidden)</option>
                            </select>
                        </Field>
                    </div>

                    <Field label="Question">
                        <textarea rows={4} value={form.text} onChange={(e) => update("text", e.target.value)} onPaste={pasteIntoQuestion} required className={inputClass} placeholder="Type the question. You can also paste an image here (Ctrl+V)." />
{/\$|\{\{IMG::/.test(form.text) && <div className="mt-2 rounded-lg bg-indigo-50 px-3 py-2 text-sm"><span className="text-xs font-semibold text-indigo-700">Preview: </span><MathText text={form.text} /></div>}
                    </Field>

                    <QuestionImages images={form.images} onChange={(imgs) => update("images", imgs)} />

                    <div>
                        <p className="text-xs font-medium text-slate-600 mb-1">
                            Options: tick the correct {form.type === "mcq_multi" ? "answers" : "answer"}
                        </p>
                        <OptionsEditor
                            options={form.options}
                            correct={form.correctOptionIds}
                            multi={form.type === "mcq_multi"}
                            onChangeText={setOptionText}
                            onToggleCorrect={toggleCorrect}
                            onChangeImage={setOptionImage}
                        />
                    </div>

<Field label="Explanation (shown after the test)">
                        <textarea rows={3} value={form.explanation} onChange={(e) => update("explanation", e.target.value)} className={inputClass} />
{/\$|\{\{IMG::/.test(form.explanation) && <div className="mt-2 rounded-lg bg-indigo-50 px-3 py-2 text-sm"><span className="text-xs font-semibold text-indigo-700">Preview: </span><MathText text={form.explanation} /></div>}
                    </Field>

                    <div className="grid sm:grid-cols-3 gap-3">
                        <Field label="Source">
                            <select value={form.sourceKind} onChange={(e) => update("sourceKind", e.target.value)} className={inputClass}>
                                <option value="original">Original</option>
                                <option value="pyq">Previous year paper</option>
                                <option value="ncert">NCERT</option>
                            </select>
                        </Field>
                        {form.sourceKind === "pyq" && (
                            <Field label="Year">
                                <input type="number" min="1990" max="2100" value={form.sourceYear} onChange={(e) => update("sourceYear", e.target.value)} className={inputClass} />
                            </Field>
                        )}
                        <Field label="Tags (comma separated)">
                            <input value={form.tags} onChange={(e) => update("tags", e.target.value)} className={inputClass} />
                        </Field>
                    </div>
                </section>

                <div className="flex flex-wrap gap-3">
                    <button type="submit" disabled={saving} className="rounded-lg bg-indigo-600 text-white text-sm font-medium px-5 py-2.5 hover:bg-indigo-700 disabled:opacity-60">
                        {saving ? "Saving..." : isNew ? "Save question" : "Save changes"}
                    </button>
                    {isNew && (
                        <button type="button" onClick={(e) => save(e, true)} disabled={saving} className="rounded-lg border border-slate-300 bg-white text-sm font-medium px-5 py-2.5 hover:border-slate-400">
                            Save and add another
                        </button>
                    )}
                    <Link to={back} className="text-sm text-slate-600 px-3 py-2.5 hover:text-slate-900">
                        Cancel
                    </Link>
                </div>
            </form>
        </AdminLayout>
    );
}