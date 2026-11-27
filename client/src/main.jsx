import ErrorBoundary from "./components/ErrorBoundary.jsx";
import Toaster from "./components/Toaster.jsx";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import WakeUpBanner from "./components/WakeUpBanner.jsx";
import ConfirmDialog from "./components/ConfirmDialog.jsx";
import { watchErrors } from "./utils/reportError";
import { startRipples } from "./utils/ripple";

watchErrors();
startRipples();

// GenPrep is a website only: remove the old installable-app worker and its saved copies, if this browser has them
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister())).catch(() => {});
  if (window.caches) caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {});
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <WakeUpBanner />
        <ConfirmDialog />
        <Toaster />
        <ErrorBoundary><App /></ErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
import "./fonts.css";
import "./theme.css";
import "./premium.css";
import "./loader";
