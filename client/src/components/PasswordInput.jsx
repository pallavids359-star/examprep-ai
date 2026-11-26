import { useState } from "react";

// A password box with an eye button to show or hide what was typed
export default function PasswordInput({ className = "", ...props }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={show ? "text" : "password"} autoCapitalize="none" autoCorrect="off" spellCheck={false} className={`${className} pr-11`} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
        title={show ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-0 grid w-11 place-items-center text-slate-400 transition hover:text-slate-800"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {show ? (
            <path d="M17.9 17.9A10.4 10.4 0 0112 20C5 20 1 12 1 12a18.5 18.5 0 015.1-5.9M9.9 4.2A9.6 9.6 0 0112 4c7 0 11 8 11 8a18.6 18.6 0 01-2.2 3.2M14.1 14.1a3 3 0 11-4.2-4.2M1 1l22 22" />
          ) : (
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12zM12 15a3 3 0 100-6 3 3 0 000 6z" />
          )}
        </svg>
      </button>
    </div>
  );
}
