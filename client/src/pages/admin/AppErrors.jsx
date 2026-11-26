import { useEffect, useState } from "react";
import api, { getErrorMessage } from "../../api/axios";
import AdminLayout from "../../components/AdminLayout";
import { askConfirm } from "../../components/ConfirmDialog";
import { toast } from "../../components/Toaster";
import Loading from "../../components/Loading";

const fmt = (d) => new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const device = (ua = "") => (/Android/i.test(ua) ? "Android" : /iPhone|iPad/i.test(ua) ? "iPhone" : /Windows/i.test(ua) ? "Windows" : /Mac/i.test(ua) ? "Mac" : ua ? "Other" : "");

// Admin: errors from students' phones/browsers and from the server (kept 30 days)
export default function AppErrors() {
  const [list, setList] = useState(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    api.get("/admin/app-errors").then((r) => setList(r.data.errors)).catch((e) => setError(getErrorMessage(e)));
  }, [reload]);

  const clear = async () => {
    if (!(await askConfirm("Remove every error from this list? Do this after the problems are fixed.", { title: "Clear the list?", confirmText: "Clear" }))) return;
    await api.delete("/admin/app-errors");
    toast("Cleared");
    setReload((r) => r + 1);
  };

  return (
    <AdminLayout>
      <section className="gp-hero mt-2 p-6 md:p-8">
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-200/80">Health</p>
            <h1 className="mt-2 text-3xl font-extrabold text-white md:text-4xl">App errors</h1>
            <p className="gp-muted mt-2 text-[15px]">Problems from students' phones and from the server. The same error is shown once, with how many times it happened.</p>
          </div>
          {list?.length > 0 && (
            <button type="button" onClick={clear} className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/20 hover:bg-white/20">
              Clear list
            </button>
          )}
        </div>
      </section>
      {error && <div className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {!list && !error && <Loading />}
      {list && !list.length && <div className="gp-card mt-5 p-10 text-center text-slate-500">No errors. Everything is working. ✓</div>}
      <div className="mt-5 space-y-3">
        {list?.map((e) => (
          <div key={e._id} className="gp-card overflow-hidden">
            <button type="button" onClick={() => setOpen(open === e._id ? null : e._id)} className="flex w-full flex-wrap items-center gap-3 px-5 py-4 text-left">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${e.where === "app" ? "bg-sky-50 text-sky-700 ring-1 ring-sky-200" : "bg-rose-50 text-rose-700 ring-1 ring-rose-200"}`}>
                {e.where === "app" ? "App" : "Server"}
              </span>
              <span className="min-w-0 flex-1 truncate font-medium text-slate-900">{e.message}</span>
              <span className="text-xs text-slate-500">
                {e.count}× · last {fmt(e.lastAt)}
              </span>
            </button>
            {open === e._id && (
              <div className="border-t border-[#f1e9d7] bg-[#fdfbf6] px-5 py-4 text-sm text-slate-700">
                <p>
                  First seen {fmt(e.firstAt)}
                  {e.page ? ` · page ${e.page}` : ""}
                  {device(e.device) ? ` · ${device(e.device)}` : ""}
                </p>
                {e.stack && <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-white p-3 text-xs text-slate-600 ring-1 ring-[#efe6d2]">{e.stack}</pre>}
              </div>
            )}
          </div>
        ))}
      </div>
    </AdminLayout>
  );
}
