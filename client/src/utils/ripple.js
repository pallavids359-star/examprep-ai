// A soft ripple from the click point on every button, button-style link and clickable card.
// One listener for the whole app, so every page gets it without changing each button.
const TARGET = "button, a.gp-btn, a.gp-gold-btn, a.gp-ghost-btn, .gp-nav-link, .gp-tab, [role='link'], .gp-card-hover";

export function startRipples() {
  if (typeof window === "undefined" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  document.addEventListener(
    "pointerdown",
    (e) => {
      if (e.button !== 0) return;
      const el = e.target.closest?.(TARGET);
      if (!el || el.tagName === "TR" || el.disabled || el.getAttribute("aria-disabled") === "true") return;
      const r = el.getBoundingClientRect();
      if (r.width < 24 || r.height < 18) return;
      const css = getComputedStyle(el);
      const size = Math.max(r.width, r.height) * 2;
      const dot = document.createElement("span");
      dot.className = "gp-ripple";
      dot.style.width = dot.style.height = `${size}px`;
      dot.style.left = `${e.clientX - r.left - size / 2}px`;
      dot.style.top = `${e.clientY - r.top - size / 2}px`;
      // Keep the ripple inside the button for a moment, then put everything back
      const restore = {};
      if (css.position === "static") {
        restore.position = el.style.position;
        el.style.position = "relative";
      }
      if (css.overflow === "visible") {
        restore.overflow = el.style.overflow;
        el.style.overflow = "hidden";
      }
      el.appendChild(dot);
      setTimeout(() => {
        dot.remove();
        Object.entries(restore).forEach(([k, v]) => (el.style[k] = v));
      }, 560);
    },
    { passive: true }
  );
}
