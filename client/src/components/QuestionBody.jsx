import { useState } from "react";
import MathText from "./MathText";

// A question with its options, the correct answer and the solution.
// Used by the lecturer's picker, the head lecturer's review and the live test report.
//   q: { type, text, images, options, correctOptionIds, numericalAnswer | correctNumericalValue, explanation }
//   chosen: the student's options (report only); numericalValue: the student's number
export default function QuestionBody({ q, chosen = null, numericalValue = null, solutionOpen = true, compact = false }) {
  const [open, setOpen] = useState(solutionOpen);
  const correct = q.correctOptionIds || [];
  const isNumerical = q.type === "numerical" || !(q.options || []).length;
  const answerValue = q.numericalAnswer?.value ?? q.correctNumericalValue ?? null;
  const tolerance = q.numericalAnswer?.tolerance || 0;
  const exp = q.explanation || {};
  const hasSolution = Boolean(exp.text || (exp.images || []).length || exp.videoUrl);

  return (
    <div>
      {q.type === "mcq_multi" && (
        <p className="mb-2 inline-block rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">More than one answer can be correct</p>
      )}
      <MathText as="div" className={`${compact ? "text-[15px]" : "text-base"} leading-relaxed text-slate-900 whitespace-pre-line`} text={q.text} />
      {(q.images || []).map((img) => (
        <img key={img.url} src={img.url} alt={img.alt || "Question diagram"} className="mt-3 max-h-64 rounded-lg border border-slate-200" />
      ))}

      {isNumerical ? (
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <span className="rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-green-800">
            Answer: <b>{answerValue ?? "—"}</b>
            {tolerance ? ` (± ${tolerance})` : ""}
          </span>
          {chosen !== null && (
            <span
              className={`rounded-lg border px-3 py-2 ${numericalValue === null || numericalValue === undefined ? "border-slate-200 text-slate-500" : Number(numericalValue) === Number(answerValue) ? "border-green-300 bg-green-50 text-green-800" : "border-orange-300 bg-orange-50 text-orange-800"}`}
            >
              Your answer: <b>{numericalValue ?? "not answered"}</b>
            </span>
          )}
        </div>
      ) : (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {q.options.map((o) => {
            const isRight = correct.includes(o.id);
            const isMine = chosen ? chosen.includes(o.id) : false;
            const tone = isRight
              ? "border-green-300 bg-green-50 text-green-900"
              : isMine
                ? "border-orange-300 bg-orange-50 text-orange-900"
                : "border-slate-200 text-slate-800";
            return (
              <li key={o.id} className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${tone}`}>
                <b className="shrink-0">{o.id}.</b>
                <div className="min-w-0 flex-1">
                  <MathText text={o.text} />
                  {o.image?.url && <img src={o.image.url} alt={o.image.alt || `Option ${o.id}`} className="mt-1 max-h-32 rounded border border-slate-200" />}
                </div>
                {(isRight || isMine) && (
                  <span className="shrink-0 text-xs font-semibold">
                    {isRight && isMine ? "Your answer ✓" : isRight ? "Correct ✓" : "Your answer ✗"}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {hasSolution && (
        <div className="mt-3">
          <button type="button" onClick={() => setOpen((v) => !v)} className="text-sm font-semibold text-indigo-700 hover:underline" aria-expanded={open}>
            {open ? "Hide solution" : "Show solution"}
          </button>
          {open && (
            <div className="mt-2 rounded-xl bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-800">
              <MathText as="div" className="whitespace-pre-line" text={exp.text} />
              {(exp.images || []).map((img) => (
                <img key={img.url} src={img.url} alt={img.alt || "Solution diagram"} className="mt-2 max-h-64 rounded-lg border border-slate-200" />
              ))}
              {exp.videoUrl && (
                <a href={exp.videoUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block font-medium text-indigo-700 hover:underline">
                  Watch the video solution
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
