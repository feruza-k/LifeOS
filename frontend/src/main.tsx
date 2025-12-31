import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Enhanced error logging for uncaught errors
window.addEventListener("error", (event) => {
  const errorData = {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error,
    timestamp: new Date().toISOString(),
    url: window.location.href,
  };

  console.error("[Global Error]", errorData);

  // Log to localStorage in production for debugging
  if (import.meta.env.PROD) {
    try {
      const existingErrors = JSON.parse(localStorage.getItem("lifeos_errors") || "[]");
      existingErrors.push({
        ...errorData,
        error: event.error?.toString(),
        stack: event.error?.stack?.substring(0, 1000),
      });
      const recentErrors = existingErrors.slice(-10);
      localStorage.setItem("lifeos_errors", JSON.stringify(recentErrors));
    } catch (e) {
      // Silently fail
    }
  }
});

window.addEventListener("unhandledrejection", (event) => {
  const errorData = {
    reason: event.reason,
    timestamp: new Date().toISOString(),
    url: window.location.href,
  };

  console.error("[Unhandled Promise Rejection]", errorData);

  // Log to localStorage in production
  if (import.meta.env.PROD) {
    try {
      const existingErrors = JSON.parse(localStorage.getItem("lifeos_errors") || "[]");
      existingErrors.push({
        ...errorData,
        reason: event.reason?.toString(),
        stack: event.reason?.stack?.substring(0, 1000),
      });
      const recentErrors = existingErrors.slice(-10);
      localStorage.setItem("lifeos_errors", JSON.stringify(recentErrors));
    } catch (e) {
      // Silently fail
    }
  }
});

// Register Service Worker for PWA
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: 'none' }) // Always check for updates
      .then((registration) => {
        console.log("Service Worker registered:", registration.scope);
        // Force update check
        registration.update();
      })
      .catch((error) => {
        console.log("Service Worker registration failed:", error);
      });
  });
}

// Verify root element exists
const rootElement = document.getElementById("root");
if (!rootElement) {
  console.error("[Fatal] Root element not found!");
  document.body.innerHTML = '<div style="padding: 20px; text-align: center;"><h1>Fatal Error</h1><p>Root element not found. Check if index.html is correct.</p></div>';
} else {
  try {
    createRoot(rootElement).render(<App />);
    console.log("[App] React app mounted successfully");
  } catch (error) {
    console.error("[Fatal] Failed to mount React app:", error);
    rootElement.innerHTML = '<div style="padding: 20px; text-align: center;"><h1>Fatal Error</h1><p>Failed to load app. Check console for details.</p></div>';
  }
}
