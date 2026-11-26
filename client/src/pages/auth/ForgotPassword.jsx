import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthShell from "../../components/AuthShell";
import api, { getErrorMessage } from "../../api/axios";

const inputClass =
    "w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500";
const labelClass = "block text-sm font-medium text-slate-700 mb-1";

export default function ForgotPassword() {
    const navigate = useNavigate();
    const [step, setStep] = useState("email"); // "email", then "reset"
    const [email, setEmail] = useState("");
    const [form, setForm] = useState({ otp: "", password: "", confirm: "" });
    const [info, setInfo] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);

    const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    // Step 1 (and "Resend code"): ask the server to send a code
    const sendCode = async (e) => {
        if (e) e.preventDefault();
        setError("");
        setInfo("");
        setBusy(true);
        try {
            const res = await api.post("/auth/forgot-password", { email });
            setInfo(res.data.message);
            setStep("reset");
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    // Step 2: check the code and set the new password
    const resetPassword = async (e) => {
        e.preventDefault();
        setError("");
        setInfo("");
        if (form.password.length < 6) return setError("Password must be at least 6 characters");
        if (form.password !== form.confirm) return setError("Passwords do not match");

        setBusy(true);
        try {
            const res = await api.post("/auth/reset-password", { email, otp: form.otp, password: form.password });
            navigate("/login", { replace: true, state: { message: res.data.message } });
        } catch (err) {
            setError(getErrorMessage(err));
            setBusy(false);
        }
    };

    return (
        <AuthShell>
                <h1 className="text-2xl font-bold text-slate-900">Reset your password</h1>
                <p className="text-slate-500 mt-1">
                    {step === "email"
                        ? "Enter your email and we'll send you a 6-digit code."
                        : `Enter the code sent to ${email} and choose a new password.`}
                </p>

                {info && <div className="mt-5 rounded-lg bg-green-50 text-green-700 text-sm px-4 py-3">{info}</div>}
                {error && <div className="mt-5 rounded-lg bg-red-50 text-red-700 text-sm px-4 py-3">{error}</div>}

                {step === "email" ? (
                    <form onSubmit={sendCode} className="mt-6 space-y-4">
                        <div>
                            <label className={labelClass} htmlFor="email">Email</label>
                            <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
                        </div>
                        <button
                            type="submit"
                            disabled={busy}
                            className="gp-btn gp-btn-dark w-full py-3.5"
                        >
                            {busy ? <><span className="gp-spinner" />Sending…</> : "Send code"}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={resetPassword} className="mt-6 space-y-4">
                        <div>
                            <label className={labelClass} htmlFor="otp">6-digit code</label>
                            <input
                                id="otp"
                                name="otp"
                                inputMode="numeric"
                                maxLength={6}
                                required
                                value={form.otp}
                                onChange={handleChange}
                                className={`${inputClass} tracking-[0.5em] font-mono text-lg`}
                            />
                        </div>
                        <div>
                            <label className={labelClass} htmlFor="password">New password</label>
                            <input id="password" name="password" type="password" required value={form.password} onChange={handleChange} className={inputClass} />
                        </div>
                        <div>
                            <label className={labelClass} htmlFor="confirm">Confirm new password</label>
                            <input id="confirm" name="confirm" type="password" required value={form.confirm} onChange={handleChange} className={inputClass} />
                        </div>
                        <button
                            type="submit"
                            disabled={busy}
                            className="gp-btn gp-btn-dark w-full py-3.5"
                        >
                            {busy ? <><span className="gp-spinner" />Saving…</> : "Change password"}
                        </button>
                        <div className="flex justify-between text-sm">
                            <button type="button" onClick={sendCode} disabled={busy} className="text-indigo-600 hover:underline">
                                Resend code
                            </button>
                            <button type="button" onClick={() => setStep("email")} className="text-slate-500 hover:text-slate-800">
                                Use a different email
                            </button>
                        </div>
                    </form>
                )}

                <p className="text-sm text-slate-600 mt-6 text-center">
                    Remembered it?{" "}
                    <Link to="/login" className="text-indigo-600 font-medium hover:underline">
                        Back to log in
                    </Link>
                </p>
            </AuthShell>
    );
}
