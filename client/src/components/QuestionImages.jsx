import { useState } from "react";
import { ImageButtons, imageInPaste, uploadImageFile } from "./ImageTools";

// The pictures of a question: upload, paste (Ctrl+V) or Google Drive; preview and remove
export default function QuestionImages({ images = [], onChange, title = "Question images (optional)" }) {
  const [pasting, setPasting] = useState(false);
  const [error, setError] = useState("");
  const add = (img) => onChange([...images, img]);
  const remove = (index) => onChange(images.filter((_, i) => i !== index));

  const onPaste = async (e) => {
    const file = imageInPaste(e);
    if (!file) return;
    e.preventDefault();
    setPasting(true);
    setError("");
    try {
      add(await uploadImageFile(file));
    } catch (err) {
      setError(err?.response?.data?.message || err.message);
    } finally {
      setPasting(false);
    }
  };

  return (
    <div>
      <p className="mb-1 text-xs font-medium text-slate-600">{title}</p>
      <div
        tabIndex={0}
        onPaste={onPaste}
        className="rounded-xl border-2 border-dashed border-[#e7dcc3] bg-[#fffdf8] p-3 outline-none transition focus:border-[#c9a24a] focus:bg-white"
        aria-label="Click here and press Ctrl+V to paste an image"
      >
        {images.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-3">
            {images.map((img, index) => (
              <div key={img.url + index} className="relative">
                <img src={img.url} alt={img.alt || "Question image"} className="h-28 rounded-lg border border-slate-200 bg-white object-contain" />
                <button type="button" onClick={() => remove(index)} className="absolute -right-2 -top-2 h-6 w-6 rounded-full bg-red-600 text-sm leading-6 text-white" title="Remove image">
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <ImageButtons onAdd={add} />
          <span className="text-xs text-slate-500">{pasting ? "Pasting…" : "or click this box and press Ctrl+V"}</span>
        </div>
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}
