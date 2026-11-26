import { Fragment, useEffect, useMemo, useState } from "react";
import api, { getErrorMessage } from "../../api/axios";
import AdminLayout from "../../components/AdminLayout";
import Loading from "../../components/Loading";

const TYPES = [
  ["single_correct", "MCQ (single)"],
  ["assertion_reason", "Assertion & reason"],
  ["statement_based", "Statement based"],
  ["match_following", "Match the following"],
  ["diagram_based", "Diagram based"],
  ["true_false", "True / False"],
  ["multi_correct", "Multiple correct"],
  ["numerical", "Numerical"],
  ["not_set", "Type not set"],
];
const LEVELS = [
  ["easy", "Easy", "bg-emerald-500"],
  ["medium", "Medium", "bg-amber-500"],
  ["hard", "Hard", "bg-rose-500"],
];
const n = (v) => (v || 0).toLocaleString("en-IN");
const CLASS = { 11: "1st PUC", 12: "2nd PUC" };

// Admin: how many questions there are, per subject, chapter, concept, type and difficulty
export default function QuestionCounts() {
  const [exam, setExam] = useState("NEET");
  const [status, setStatus] = useState("published");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [subject, setSubject] = useState(0);
  const [open, setOpen] = useState({});
  const [q, setQ] = useState("");

  useEffect(() => {
    setData(null);
    setError("");
    api
      .get("/admin/question-counts", { params: { exam, status } })
      .then((r) => {
        setData(r.data);
        setSubject(0);
      })
      .catch((e) => setError(getErrorMessage(e)));
  }, [exam, status]);

  const sub = data?.subjects?.[subject];
  // only the types that exist in this exam, so the table stays narrow
  const types = useMemo(() => TYPES.filter(([k]) => data?.types?.[k]), [data]);
  const chapters = useMemo(
    () => (sub?.chapters || []).filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()) || c.topics.some((t) => t.name.toLowerCase().includes(q.toLowerCase()))),
    [sub, q]
  );

  // Everything as a spreadsheet (opens in Excel)
  const download = () => {
    const head = ["Subject", "Class", "Chapter", "Concept", "Total", ...types.map(([, l]) => l), "Easy", "Medium", "Hard"];
    const row = (s, c, t, box) => [s, c ? CLASS[c.classLevel] || c.classLevel : "", c?.name || "", t?.name || "", box.total, ...types.map(([k]) => box.types[k] || 0), ...LEVELS.map(([k]) => box.levels[k] || 0)];
    const rows = [head, row(`${data.exam} (all)`, null, null, data)];
    for (const s of data.subjects) {
      rows.push(row(s.name, null, null, s));
      for (const c of s.chapters) {
        rows.push(row(s.name, c, null, c));
        for (const t of c.topics) rows.push(row(s.name, c, t, t));
      }
    }
    const csv = "﻿" + rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `${data.exam}-question-counts-${status}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <AdminLayout>
      <section className="gp-hero mt-2 p-6 md:p-8">
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-200/80">Question bank</p>
            <h1 className="mt-2 text-3xl font-extrabold text-white md:text-4xl">Question counts</h1>
            <p className="gp-muted mt-2 text-[15px]">Total, per subject, chapter, concept, question type and difficulty.</p>
          </div>
          {data && (
            <button type="button" onClick={download} className="gp-btn gp-btn-gold">
              ⤓ Download Excel
            </button>
          )}
        </div>
      </section>

      {/* Filters */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-2xl bg-[#efe6d2]/60 p-1 ring-1 ring-[#e7dcc3]">
          {(data?.exams || ["NEET", "JEE", "KCET"]).map((e) => (
            <button key={e} type="button" onClick={() => setExam(e)} className={`rounded-xl px-4 py-2 text-sm font-extrabold ${exam === e ? "bg-[#17140f] text-[#e5c372]" : "text-[#6b604c] hover:bg-white"}`}>
              {e}
            </button>
          ))}
        </div>
        <div className="flex gap-1 rounded-2xl bg-[#efe6d2]/60 p-1 ring-1 ring-[#e7dcc3]">
          {[["published", "Published"], ["draft", "Drafts"], ["all", "Both"]].map(([k, l]) => (
            <button key={k} type="button" onClick={() => setStatus(k)} className={`rounded-xl px-4 py-2 text-sm font-semibold ${status === k ? "bg-white text-slate-900 shadow-sm" : "text-[#6b604c] hover:bg-white/70"}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {!data && !error && <Loading label="Counting questions" />}

      {data && (
        <>
          {/* Totals */}
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <div className="gp-card p-6">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">{data.exam} total</p>
              <p className="mt-2 font-display text-5xl font-extrabold tabular-nums text-slate-900">{n(data.total)}</p>
              <p className="mt-1 text-sm text-slate-500">{status === "all" ? "published + drafts" : status === "draft" ? "drafts" : "published questions"}</p>
              <div className="mt-5 space-y-2">
                {data.subjects.map((s, i) => (
                  <button key={s._id} type="button" onClick={() => setSubject(i)} className="flex w-full items-center justify-between text-sm hover:underline">
                    <span className="text-slate-700">{s.name}</span>
                    <b className="tabular-nums text-slate-900">{n(s.total)}</b>
                  </button>
                ))}
              </div>
            </div>
            <div className="gp-card p-6">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">By question type</p>
              <div className="mt-4 space-y-2.5">
                {types.map(([k, l]) => (
                  <div key={k}>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-700">{l}</span>
                      <b className="tabular-nums">{n(data.types[k])}</b>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-[#f1e9d7]">
                      <div className="h-full rounded-full bg-gradient-to-r from-[#c9a24a] to-[#e5c372]" style={{ width: `${Math.max(1, (data.types[k] / data.total) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="gp-card p-6">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">By difficulty</p>
              <div className="mt-4 flex h-3 overflow-hidden rounded-full">
                {LEVELS.map(([k, , c]) => (
                  <div key={k} className={c} style={{ width: `${((data.levels[k] || 0) / (data.total || 1)) * 100}%` }} />
                ))}
              </div>
              <div className="mt-4 space-y-2">
                {LEVELS.map(([k, l, c]) => (
                  <div key={k} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-slate-700">
                      <i className={`h-2.5 w-2.5 rounded-full ${c}`} />
                      {l}
                    </span>
                    <b className="tabular-nums">
                      {n(data.levels[k])} <span className="font-normal text-slate-400">({Math.round(((data.levels[k] || 0) / (data.total || 1)) * 100)}%)</span>
                    </b>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Subject tabs */}
          <div className="mt-6 flex flex-wrap items-center gap-2">
            {data.subjects.map((s, i) => (
              <button key={s._id} type="button" onClick={() => { setSubject(i); setOpen({}); }} className={`rounded-xl px-4 py-2 text-sm font-semibold ring-1 ${i === subject ? "bg-[#17140f] text-[#e5c372] ring-[#17140f]" : "bg-white text-slate-700 ring-[#e7dcc3] hover:ring-[#c9a24a]"}`}>
                {s.name} <span className="opacity-70">{n(s.total)}</span>
              </button>
            ))}
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a chapter or concept…" className="ml-auto w-full rounded-xl border border-[#e7dcc3] bg-white px-3.5 py-2 text-sm outline-none focus:border-[#c9a24a] sm:w-64" />
          </div>

          {/* Chapter table, click to see concepts */}
          {sub && (
            <div className="gp-card mt-4 overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-[#fbf6ea] text-left text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Chapter / concept</th>
                    <th className="px-3 py-3">Class</th>
                    <th className="px-3 py-3 text-right">Total</th>
                    {types.map(([k, l]) => (
                      <th key={k} className="px-3 py-3 text-right">{l}</th>
                    ))}
                    {LEVELS.map(([k, l]) => (
                      <th key={k} className="px-3 py-3 text-right">{l}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {chapters.map((c) => {
                    const isOpen = open[c._id] || (q && c.topics.some((t) => t.name.toLowerCase().includes(q.toLowerCase())));
                    return (
                      <Fragment key={c._id}>
                        <tr className="cursor-pointer border-t border-[#f1e9d7] hover:bg-[#fdfaf2]" onClick={() => setOpen((o) => ({ ...o, [c._id]: !o[c._id] }))}>
                          <td className="px-4 py-2.5 font-semibold text-slate-900">
                            <span className="mr-1.5 inline-block w-3 text-slate-400">{isOpen ? "▾" : "▸"}</span>
                            {c.name}
                            <span className="ml-2 text-xs font-normal text-slate-400">{c.topics.length} concepts</span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{CLASS[c.classLevel] || c.classLevel}</td>
                          <td className={`px-3 py-2.5 text-right font-bold tabular-nums ${c.total ? "text-slate-900" : "text-rose-600"}`}>{n(c.total)}</td>
                          {types.map(([k]) => (
                            <td key={k} className="px-3 py-2.5 text-right tabular-nums text-slate-600">{c.types[k] ? n(c.types[k]) : <span className="text-slate-300">0</span>}</td>
                          ))}
                          {LEVELS.map(([k]) => (
                            <td key={k} className="px-3 py-2.5 text-right tabular-nums text-slate-600">{n(c.levels[k])}</td>
                          ))}
                        </tr>
                        {isOpen &&
                          c.topics.map((t) => (
                            <tr key={t._id} className="border-t border-[#f6f0e2] bg-[#fdfbf6] text-[13px]">
                              <td className="py-2 pl-11 pr-4 text-slate-700">{t.name}</td>
                              <td />
                              <td className={`px-3 py-2 text-right font-semibold tabular-nums ${t.total ? "text-slate-800" : "text-rose-600"}`}>{n(t.total)}</td>
                              {types.map(([k]) => (
                                <td key={k} className="px-3 py-2 text-right tabular-nums text-slate-500">{t.types[k] ? n(t.types[k]) : <span className="text-slate-300">0</span>}</td>
                              ))}
                              {LEVELS.map(([k]) => (
                                <td key={k} className="px-3 py-2 text-right tabular-nums text-slate-500">{n(t.levels[k])}</td>
                              ))}
                            </tr>
                          ))}
                      </Fragment>
                    );
                  })}
                  <tr className="border-t-2 border-[#e7dcc3] bg-[#fbf6ea] font-bold">
                    <td className="px-4 py-3">{sub.name} total</td>
                    <td />
                    <td className="px-3 py-3 text-right tabular-nums">{n(sub.total)}</td>
                    {types.map(([k]) => (
                      <td key={k} className="px-3 py-3 text-right tabular-nums">{n(sub.types[k])}</td>
                    ))}
                    {LEVELS.map(([k]) => (
                      <td key={k} className="px-3 py-3 text-right tabular-nums">{n(sub.levels[k])}</td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-xs text-slate-500">Click a chapter to see its concepts. Red 0 = no questions yet. "Download Excel" saves every subject, chapter and concept.</p>
        </>
      )}
    </AdminLayout>
  );
}
