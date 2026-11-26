import axios from "axios";

// Every request goes to /api/... (forwarded to the server)
const api = axios.create({ baseURL: "/api", timeout: 90000 });

// Counts requests that are taking long, which usually means the free server is waking up
let slowRequests = 0;
const announce = () => window.dispatchEvent(new CustomEvent("server-slow", { detail: slowRequests > 0 }));

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // After 4 seconds without an answer, show the "waking up" message
  config._slowTimer = setTimeout(() => {
    config._isSlow = true;
    slowRequests += 1;
    announce();
  }, 4000);
  return config;
});

const finished = (config) => {
  if (!config) return;
  clearTimeout(config._slowTimer);
  if (config._isSlow) {
    config._isSlow = false;
    slowRequests = Math.max(0, slowRequests - 1);
    announce();
  }
};

api.interceptors.response.use(
  (response) => {
    finished(response.config);
    return response;
  },
  (error) => {
    finished(error.config);
    // Login no longer valid (password changed, account removed): back to the login page
    const url = error.config?.url || "";
    if (error.response?.status === 401 && localStorage.getItem("token") && !url.startsWith("/auth/login") && !url.startsWith("/auth/me")) {
      localStorage.removeItem("token");
      if (!location.pathname.startsWith("/login")) location.assign(`/login?next=${encodeURIComponent(location.pathname)}`);
    }
    return Promise.reject(error);
  }
);

// Turns any error into a message we can show the user
export const getErrorMessage = (error) => {
  if (error.code === "ECONNABORTED") return "The server took too long to answer. Please try again.";
  return error.response?.data?.message || "Could not reach the server. Is it running?";
};

export default api;