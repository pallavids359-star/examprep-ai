import { useState } from "react";
import { GUIDES } from "../content/guides";

function Icon({ d, className = "h-5 w-5" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

// The user guide of one portal: "student", "lecturer" or "admin"
export default function GuidePage({ role }) {
  const g = GUIDES[role];
  const [open, setOpen] = useState(0);
  const [active, setActive] = useState(g.topics[0].id);
  const toc = [...g.topics.map((t) => [t.id, t.title]), ["faq", "Common problems"]];

  const go = (id) => {
    setActive(id);
    document.getElementById(`guide-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 md:px-8 md:py-8">
      <div className="gp-print-sheet">
        <section className="gp-hero p-6 md:p-8 print:rounded-none">
          <div className="relative flex flex-wrap items-center justify-between gap-6">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-200/80">{g.portal}</p>
              <h1 className="mt-2 text-3xl font-extrabold text-white md:text-4xl">User guide</h1>
              <p className="gp-muted mt-2 text-[15px]">{g.intro}</p>
            </div>
            <button type="button" onClick={() => window.print()} className="gp-gold-btn inline-flex items-center gap-2 px-5 py-3 text-sm print:hidden">
              <Icon d="M12 3v12M7 10l5 5 5-5M5 21h14" className="h-4 w-4" />
              Download PDF
            </button>
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[240px_1fr] print:block">
          {/* Contents */}
          <aside className="lg:sticky lg:top-6 lg:self-start print:hidden">
            <nav className="gp-card p-4" aria-label="Contents">
              <p className="gp-label px-2 pb-2">Contents</p>
              <ol className="space-y-0.5">
                {toc.map(([id, title], i) => {
                  const on = active === id;
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        onClick={() => go(id)}
                        className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-sm transition ${on ? "bg-[#f3ecdc] font-bold text-slate-900" : "text-slate-600 hover:bg-[#faf6ec]"}`}
                      >
                        <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg text-xs font-bold ${on ? "bg-[#17140f] text-[#e5c372]" : "bg-[#f3ecdc] text-[#8a6420]"}`}>{i + 1}</span>
                        {title}
                      </button>
                    </li>
                  );
                })}
              </ol>
            </nav>
          </aside>

          <div className="space-y-5">
            {g.topics.map((t, ti) => (
              <section key={t.id} id={`guide-${t.id}`} className="gp-card scroll-mt-6 p-6 print:mt-4 print:break-inside-avoid">
                <div className="flex items-start gap-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-b from-[#e5c372] to-[#b8862b] text-[#17140f]">
                    <Icon d={t.icon} />
                  </span>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-[#b8862b]">Part {ti + 1}</p>
                    <h2 className="text-xl font-extrabold text-slate-900">{t.title}</h2>
                    {t.intro && <p className="mt-0.5 text-sm text-slate-500">{t.intro}</p>}
                  </div>
                </div>
                <ol className="mt-5 space-y-3">
                  {t.steps.map(([what, more], i) => (
                    <li key={i} className="flex gap-3">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#17140f] font-display text-xs font-bold text-[#e5c372]">{i + 1}</span>
                      <div className="pt-0.5">
                        <p className="text-[15px] font-semibold text-slate-900">{what}</p>
                        {more && <p className="text-sm text-slate-500">{more}</p>}
                      </div>
                    </li>
                  ))}
                </ol>
                {t.tip && (
                  <div className="mt-5 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    <span className="shrink-0 whitespace-nowrap font-bold">💡 Tip</span>
                    <span>{t.tip}</span>
                  </div>
                )}
              </section>
            ))}

            <section id="guide-faq" className="gp-card scroll-mt-6 p-6 print:mt-4">
              <h2 className="text-xl font-extrabold text-slate-900">Common problems</h2>
              <div className="mt-4 divide-y divide-[#f1e9d7] overflow-hidden rounded-2xl border border-[#efe6d2]">
                {g.faq.map(([q, a], i) => (
                  <div key={q} className="bg-white print:break-inside-avoid">
                    <button type="button" onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-[15px] font-semibold text-slate-900">
                      {q}
                      <span className="text-lg text-[#b8862b] print:hidden">{open === i ? "−" : "+"}</span>
                    </button>
                    {/* every answer is printed in the PDF */}
                    <p className={`px-4 pb-4 text-sm text-slate-600 ${open === i ? "" : "hidden print:block"}`}>{a}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
