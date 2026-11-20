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
