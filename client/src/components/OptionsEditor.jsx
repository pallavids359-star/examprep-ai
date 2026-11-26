import { useState } from "react";
import { ImageButtons, usePasteImage } from "./ImageTools";

// Four option boxes, each with a "Correct" tick (radio for one answer, checkbox for several)
// and an optional picture: upload, paste (Ctrl+V into the box) or Google Drive.
export default function OptionsEditor({ options, correct, multi, onChangeText, onToggleCorrect, onChangeImage }) {
  const [error, setError] = useState("");
  return (
    <div className="space-y-2">
      {options.map((opt) => {
        const isCorrect = correct.includes(opt.id);
        return (
          <OptionRow key={opt.id} opt={opt} isCorrect={isCorrect} multi={multi} onChangeText={onChangeText} onToggleCorrect={onToggleCorrect} onChangeImage={onChangeImage} onError={setError} />
        );
      })}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function OptionRow({ opt, isCorrect, multi, onChangeText, onToggleCorrect, onChangeImage, onError }) {
  const paste = usePasteImage((img) => onChangeImage?.(opt.id, img), onError);
  return (
    <div className={`rounded-lg border px-3 py-2 ${isCorrect ? "border-green-500 bg-green-50" : "border-slate-200"}`}>
      <div className="flex items-center gap-3">
        <span className="w-5 font-semibold text-slate-700">{opt.id}</span>
        <input
          value={opt.text}
          onChange={(e) => onChangeText(opt.id, e.target.value)}
          onPaste={onChangeImage ? paste : undefined}
          placeholder={`Option ${opt.id} (type, or paste an image)`}
          className="flex-1 bg-transparent text-sm focus:outline-none"
        />
        {onChangeImage && !opt.image?.url && <ImageButtons small label="option image" onAdd={(img) => onChangeImage(opt.id, img)} />}
        <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-600">
          <input type={multi ? "checkbox" : "radio"} name="correct-option" checked={isCorrect} onChange={() => onToggleCorrect(opt.id)} />
          Correct
        </label>
      </div>
      {opt.image?.url && (
        <div className="relative ml-8 mt-2 inline-block">
          <img src={opt.image.url} alt={`Option ${opt.id}`} className="max-h-28 rounded-lg border border-slate-200 bg-white object-contain" />
          <button type="button" onClick={() => onChangeImage(opt.id, undefined)} className="absolute -right-2 -top-2 h-6 w-6 rounded-full bg-red-600 text-sm leading-6 text-white" title="Remove image">
            ×
          </button>
        </div>
      )}
    </div>
  );
}
