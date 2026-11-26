import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import AuthShell from "../../components/AuthShell";
import { getErrorMessage } from "../../api/axios";

// The college list: MBPU first (the default), then others. Section A-D is asked only for MBPU.
const DEFAULT_COLLEGE = "MBPU";
const COLLEGES = [DEFAULT_COLLEGE, "Other"];

export default function Register() {
    const { register, user } = useAuth();
    const navigate = useNavigate();

    const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "", college: DEFAULT_COLLEGE, otherCollege: "", section: "" });
    const isMB = form.college === DEFAULT_COLLEGE;
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    if (user) return <Navigate to="/dashboard" replace />;

    const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        // Check these here first, so the user gets instant feedback
        const college = form.college === "Other" ? form.otherCollege.trim() : form.college;
        if (!college) {
            setError("Please type your college name");
            return;
        }
        if (isMB && !form.section) {
            setError("Please choose your section");
            return;
        }
        if (form.password.length < 6) {
            setError("Password must be at least 6 characters");
            return;
        }
        if (form.password !== form.confirm) {
            setError("Passwords do not match");
            return;
        }

        setSubmitting(true);
        try {
            await register(form.name, form.email, form.password, { college, section: isMB ? form.section : undefined });
            navigate("/dashboard");
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setSubmitting(false);
        }
    };

    const inputClass =
        "w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500";

    return (
        <AuthShell>
                <h1 className="text-2xl font-bold text-slate-900">Create your account</h1>
                <p className="text-slate-500 mt-1">Start preparing for NEET, JEE or KCET</p>

                {error && (
                    <div className="mt-5 rounded-lg bg-red-50 text-red-700 text-sm px-4 py-3">{error}</div>
                )}

                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="name">
                            Full name
                        </label>
                        <input id="name" name="name" required value={form.name} onChange={handleChange} className={inputClass} />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="college">
                            College name
                        </label>
                        <select id="college" name="college" value={form.college} onChange={(e) => setForm({ ...form, college: e.target.value, section: "" })} className={inputClass}>
                            {COLLEGES.map((c) => (
                                <option key={c} value={c}>
                                    {c === "Other" ? "Other college (type the name)" : c}
                                </option>
                            ))}
                        </select>
                        {form.college === "Other" && (
                            <input
                                name="otherCollege"
                                required
                                placeholder="Your college name"
                                value={form.otherCollege}
                                onChange={handleChange}
                                className={`${inputClass} mt-2`}
                                maxLength={120}
                            />
                        )}
                    </div>

                    {isMB && (
                        <div>
                            <p className="mb-1 text-sm font-medium text-slate-700">Section</p>
                            <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Section">
                                {["A", "B", "C", "D"].map((sec) => (
                                    <button
                                        key={sec}
                                        type="button"
                                        role="radio"
                                        aria-checked={form.section === sec}
                                        onClick={() => setForm({ ...form, section: sec })}
                                        className={`rounded-lg py-2 text-sm font-bold transition ${
                                            form.section === sec ? "bg-[#17140f] text-[#e5c372]" : "border border-slate-300 text-slate-700 hover:border-[#c9a24a]"
                                        }`}
                                    >
                                        {sec}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="email">
                            Email
                        </label>
                        <input id="email" name="email" type="email" required value={form.email} onChange={handleChange} className={inputClass} />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="password">
                            Password
                        </label>
                        <input id="password" name="password" type="password" required value={form.password} onChange={handleChange} className={inputClass} />
                        <p className="text-xs text-slate-500 mt-1">At least 6 characters</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="confirm">
                            Confirm password
                        </label>
                        <input id="confirm" name="confirm" type="password" required value={form.confirm} onChange={handleChange} className={inputClass} />
                    </div>

                    <button
                        type="submit"
                        disabled={submitting}
                        className="gp-btn gp-btn-dark w-full py-3.5"
                    >
                        {submitting ? <><span className="gp-spinner" />Creating account…</> : "Create account"}
                    </button>
                    <p className="text-center text-xs text-slate-500">
                        By creating an account you agree to the{" "}
                        <Link to="/terms" className="underline">Terms</Link> and{" "}
                        <Link to="/privacy" className="underline">Privacy policy</Link>.
                    </p>
                </form>

                <p className="text-sm text-slate-600 mt-6 text-center">
                    Already have an account?{" "}
                    <Link to="/login" className="text-indigo-600 font-medium hover:underline">
                        Log in
                    </Link>
                </p>
            </AuthShell>
    );
}
