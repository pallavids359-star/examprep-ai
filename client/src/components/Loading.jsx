// Gold spinner with a short label, for any part of a page that is waiting for data
export default function Loading({ label = "Loading", className = "" }) {
  return (
    <div className={`gp-loading ${className}`} role="status" aria-live="polite">
      <span className="gp-spinner" aria-hidden="true" />
      <span>{label}…</span>
    </div>
  );
}

// Full-screen loader with the logo (first load and page changes)
export function SplashLoader({ label = "Loading GenPrep" }) {
  return (
    <div className="gp-splash" role="status" aria-busy="true">
      <div className="gp-splash-ring">
        <img src="/icons/icon-192.png" alt="" />
      </div>
      <p>{label}</p>
    </div>
  );
}
