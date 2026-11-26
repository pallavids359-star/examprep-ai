import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import AuthShell from "../../components/AuthShell";
import { getErrorMessage } from "../../api/axios";

const inputClass =
    "w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500";

export default function Login() {
    const { login, user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const notice = location.state?.message; // for example, after a password reset

    const [form, setForm] = useState({ email: "", password: "" });
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    // Already logged in? Go to the right home page
    const next = new URLSearchParams(location.search).get("next") || "";
    const goTo = next.startsWith("/") && !next.startsWith("//") ? next : "/";
    if (user) return <Navigate to={goTo} replace />;

    const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setSubmitting(true);
        try {
            await login(form.email, form.password);
            navigate(goTo);
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <AuthShell>
                <h1 className="text-2xl font-bold text-slate-900">Welcome back</h1>
                <p className="text-slate-500 mt-1">Log in to continue your preparation</p>

                {notice && !error && <div className="mt-5 rounded-lg bg-green-50 text-green-700 text-sm px-4 py-3">{notice}</div>}
                {error && <div className="mt-5 rounded-lg bg-red-50 text-red-700 text-sm px-4 py-3">{error}</div>}

                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="email">
                            Email
                        </label>
                        <input id="email" name="email" type="email" required value={form.email} onChange={handleChange} className={inputClass} />
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="block text-sm font-medium text-slate-700" htmlFor="password">
                                Password
                            </label>
                            <Link to="/forgot-password" className="text-sm text-indigo-600 hover:underline">
                                Forgot password?
                            </Link>
                        </div>
                        <input id="password" name="password" type="password" required value={form.password} onChange={handleChange} className={inputClass} />
                    </div>

                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full rounded-lg bg-indigo-600 text-white font-medium py-2.5 hover:bg-indigo-700 disabled:opacity-60"
                    >
                        {submitting ? "Logging in..." : "Log in"}
                    </button>
                </form>

                <p className="text-sm text-slate-600 mt-6 text-center">
                    New here?{" "}
                    <Link to="/register" className="text-indigo-600 font-medium hover:underline">
                        Create an account
                    </Link>
                </p>
            </AuthShell>
    );
}
