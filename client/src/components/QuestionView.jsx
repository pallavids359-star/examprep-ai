import MathText from "./MathText";
import { FlagButton } from "./ReportQuestion";

const DIFFICULTY_STYLES = {
  easy: "bg-emerald-50 text-emerald-700",
  medium: "bg-amber-50 text-amber-700",
  hard: "bg-red-50 text-red-700",
};

// One question card with big, easy-to-tap options
export default function QuestionView({ question, index, total, selected, isMarked, markingScheme, onChoose, onNumber, flag, onFlag }) {
  const isNumerical = question.type === "numerical" || !(question.options || []).length;
  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 md:p-7">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-lg font-bold text-slate-900">Question {index + 1}</span>
        <span className="text-sm text-slate-400">of {total}</span>
        {question.difficulty && (
          <span className={`px-2 py-0.5 rounded-md text-xs font-semibold capitalize ${DIFFICULTY_STYLES[question.difficulty] || ""}`}>
            {question.difficulty}
          </span>
        )}
        {markingScheme && (
          <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-600">
            +{markingScheme.correct} / {markingScheme.incorrect}
          </span>
        )}
        {isMarked && (
          <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-violet-50 text-violet-700">Marked for review</span>
        )}
        {onFlag && <FlagButton flag={flag} onClick={onFlag} />}
      </div>

      {question.type === "mcq_multi" && (
        <p className="mt-3 inline-block rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700">
          More than one answer can be correct
        </p>
      )}

      <MathText as="p" className="mt-5 text-lg md:text-xl leading-relaxed text-slate-900 whitespace-pre-line" text={question.text} />

      {question.images?.map((img) => (
        <img key={img.url} src={img.url} alt={img.alt || "Question diagram"} className="mt-4 max-h-72 rounded-lg border border-slate-200" />
      ))}

      {isNumerical && (
        <div className="mt-6">
          <label htmlFor="numerical-answer" className="block text-sm font-semibold text-slate-700">
            Your answer
          </label>
          <input
            id="numerical-answer"
            key={question._id}
            type="text"
            inputMode="text"
            autoComplete="off"
            placeholder="Type your answer"
            value={selected[0] || ""}
            onChange={(e) => {
              
              const v = e.target.value;
              if (onNumber) onNumber(v);
            }}
            className="mt-2 w-full max-w-xs rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-lg text-slate-900 focus:border-indigo-600 focus:outline-none"
          />
        </div>
      )}

      <div className="mt-6 space-y-3" role="group" aria-label="Options">
        {question.options.map((opt, i) => {
          const isSelected = selected.includes(opt.id);
          return (
            <button
              key={opt.id}
              onClick={() => onChoose(opt.id)}
              aria-pressed={isSelected}
              className={`w-full text-left flex items-start gap-4 rounded-xl border-2 px-4 py-3.5 transition ${
                isSelected ? "border-indigo-600 bg-indigo-50 shadow-sm" : "border-slate-200 hover:border-indigo-300 hover:bg-slate-50"
              }`}
            >
              <span
                className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  isSelected ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700"
                }`}
              >
                {opt.id}
              </span>
              <span className="flex-1 text-slate-800 pt-1">
                <MathText text={opt.text} />
                {opt.image?.url && <img src={opt.image.url} alt={`Option ${opt.id}`} className="mt-2 max-h-40 rounded" />}
              </span>
              <span className="hidden md:block pt-1.5 text-xs text-slate-300">{i + 1}</span>
            </button>
          );
        })}
      </div>

      <p className="hidden md:block mt-5 text-xs text-slate-400">
        {isNumerical
          ? "Tip: type your answer in the box. Use the arrow keys (outside the box) to move between questions."
          : "Tip: press 1-4 to choose an option, and the arrow keys to move between questions."}
      </p>
    </section>
  );
}