import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "0.0.0.0", // Allow connections from network
    port: 8080,
    strictPort: false, // Try next available port if 8080 is taken
    https: false, // Explicitly disable HTTPS to avoid SSL errors on mobile
    proxy: {
      // Proxy API requests to backend - makes frontend and backend same-origin
      // This allows SameSite=Lax cookies to work in development
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""), // Remove /api prefix
      },
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
