import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Add error handler for uncaught errors
window.addEventListener("error", (event) => {
  console.error("[Global Error]", event.error);
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("[Unhandled Promise Rejection]", event.reason);
});

// Register Service Worker for PWA
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.log("Service Worker registered:", registration.scope);
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
