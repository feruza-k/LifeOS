import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // CRITICAL: base must be "/" to prevent path rewriting that breaks form actions
  // Any non-empty base path will cause Safari to prepend it to form action URLs
  base: "/",
  server: mode === "development" ? {
    host: "0.0.0.0", // Allow connections from network
    port: 8080,
    strictPort: false, // Try next available port if 8080 is taken
    proxy: {
      // Proxy API requests to backend - makes frontend and backend same-origin
      // This allows SameSite=Lax cookies to work in development
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""), // Remove /api prefix
      },
    },
  } : undefined,
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
      },
    },
  },
  publicDir: "public",
}));
