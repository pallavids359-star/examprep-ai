import { useState } from "react";
import api, { getErrorMessage } from "../api/axios";

// ---------- helpers ----------

// Makes big pictures smaller before upload (max 1600 px, WEBP); GIFs stay as they are
const shrink = (file) =>
  new Promise((resolve) => {
    if (file.type === "image/gif") return resolve(file);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff"; // pasted screenshots with no background stay readable
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => resolve(blob && blob.size < file.size ? new File([blob], "image.webp", { type: "image/webp" }) : file), "image/webp", 0.9);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });

export const uploadImageFile = async (file) => {
  if (!file || !file.type.startsWith("image/")) throw new Error("That is not an image");
  const small = await shrink(file);
  if (small.size > 2 * 1024 * 1024) throw new Error("Image must be 2 MB or smaller");
  const data = new FormData();
  data.append("image", small);
  const res = await api.post("/admin/upload", data);
  return { ...res.data.image, alt: "" };
};

export const uploadFromDrive = async (link) => {
  const res = await api.post("/admin/upload/drive", { link });
  return { ...res.data.image, alt: "" };
};

// The picture in a paste event (Ctrl+V), if there is one
export const imageInPaste = (e) => {
  for (const item of e.clipboardData?.items || []) {
    if (item.kind === "file" && item.type.startsWith("image/")) return item.getAsFile();
  }
  return null;
};

// Reads a picture from the clipboard when a "Paste" button is clicked
const imageInClipboard = async () => {
  if (!navigator.clipboard?.read) throw new Error("Your browser can't paste from a button. Click the box and press Ctrl+V instead.");
  const items = await navigator.clipboard.read();
  for (const item of items) {
    const type = item.types.find((t) => t.startsWith("image/"));
    if (type) {
      const blob = await item.getType(type);
      return new File([blob], "pasted", { type });
    }
  }
  throw new Error("No picture copied. Copy an image first (right-click → Copy image, or a screenshot), then paste.");
};

const errText = (err) => (err?.response ? getErrorMessage(err) : err?.message || "Something went wrong");

// ---------- the buttons ----------

const ICON = {
  upload: "M12 16V4M7 9l5-5 5 5M5 20h14",
  paste: "M9 4h6v3H9zM8 5H6a1 1 0 00-1 1v13a1 1 0 001 1h12a1 1 0 001-1V6a1 1 0 00-1-1h-2",
  drive: "M8 3h8l6 10-4 7H6l-4-7zM8 3l6 10M16 3l-6 10M2 13h20",
};
function Icon({ d }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

// Upload / Paste / Google Drive. Calls onAdd(image) for each picture added.
//   small: icon-only buttons (for options)
export function ImageButtons({ onAdd, small = false, label = "image" }) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [driveOpen, setDriveOpen] = useState(false);
  const [link, setLink] = useState("");

  const run = async (key, fn) => {
    setBusy(key);
    setError("");
    try {
      const img = await fn();
      if (img) onAdd(img);
      return true;
    } catch (err) {
      setError(errText(err));
      return false;
    } finally {
      setBusy("");
    }
  };

  const btn = `inline-flex items-center gap-1.5 rounded-lg border border-[#e7dcc3] bg-white font-semibold text-slate-700 transition hover:border-[#c9a24a] hover:text-slate-900 disabled:opacity-50 ${small ? "h-8 w-8 justify-center" : "px-3 py-1.5 text-xs"}`;

  return (
    <div className={small ? "" : "space-y-2"}>
      <div className="flex flex-wrap items-center gap-1.5">
        <label className={`${btn} cursor-pointer`} title={`Upload ${label} from computer`}>
          <Icon d={ICON.upload} />
          {!small && (busy === "file" ? "Uploading…" : "Upload")}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            disabled={Boolean(busy)}
            onChange={(e) => {
              const f = e.target.files[0];
              e.target.value = "";
              if (f) run("file", () => uploadImageFile(f));
            }}
          />
        </label>
        <button type="button" className={btn} disabled={Boolean(busy)} title={`Paste a copied ${label}`} onClick={() => run("paste", async () => uploadImageFile(await imageInClipboard()))}>
          <Icon d={ICON.paste} />
          {!small && (busy === "paste" ? "Pasting…" : "Paste")}
        </button>
        <button type="button" className={btn} disabled={Boolean(busy)} title={`Add ${label} from Google Drive`} onClick={() => setDriveOpen((o) => !o)}>
          <Icon d={ICON.drive} />
          {!small && "Google Drive"}
        </button>
        {small && busy && <span className="text-xs text-slate-500">Adding…</span>}
      </div>
      {driveOpen && (
        <div className={`flex flex-wrap items-center gap-2 ${small ? "mt-2" : ""}`}>
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="Paste the Google Drive link of the image"
            className="min-w-[16rem] flex-1 rounded-lg border border-[#e7dcc3] bg-white px-3 py-1.5 text-sm outline-none focus:border-[#c9a24a]"
          />
          <button
            type="button"
            disabled={!link.trim() || Boolean(busy)}
            className="gp-gold-btn px-3 py-1.5 text-xs disabled:opacity-50"
            onClick={async () => {
              if (await run("drive", () => uploadFromDrive(link.trim()))) {
                setLink("");
                setDriveOpen(false);
              }
            }}
          >
            {busy === "drive" ? "Adding…" : "Add"}
          </button>
          <span className="w-full text-[11px] text-slate-500">In Drive: Share → General access → “Anyone with the link”, then Copy link.</span>
        </div>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

// Pastes a picture straight into a text box (Ctrl+V); text pastes work as normal
export const usePasteImage = (onAdd, onError) => async (e) => {
  const file = imageInPaste(e);
  if (!file) return;
  e.preventDefault();
  try {
    onAdd(await uploadImageFile(file));
  } catch (err) {
    onError?.(errText(err));
  }
};
