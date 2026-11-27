import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import DeleteAccountForm from "./DeleteAccountForm";
import { toast } from "./Toaster";

// Profile: "Delete my account"
export function DeleteAccountCard() {
  const [open, setOpen] = useState(false);
  const { logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="rounded-2xl border border-rose-100 bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-slate-900">Delete my account</h2>
      {!open ? (
        <>
          <p className="mt-1 text-sm text-slate-500">Remove your account and all your marks for good.</p>
          <button type="button" onClick={() => setOpen(true)} className="mt-3 text-sm font-semibold text-rose-700 hover:underline">
            Delete my account…
          </button>
        </>
      ) : (
        <div className="mt-3">
          <DeleteAccountForm
            onDeleted={() => {
              logout();
              toast("Your account has been deleted.");
              navigate("/", { replace: true });
            }}
          />
          <button type="button" onClick={() => setOpen(false)} className="mt-2 w-full text-sm font-medium text-slate-500 hover:underline">
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
