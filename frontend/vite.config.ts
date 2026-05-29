import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// Dev: proxy /api to the local api-gateway so the browser can hit
// http://localhost:5173/api/... without CORS or token-host mismatches.
// Prod (in cluster): the built static files are served by nginx behind the
// same Ingress as the gateway, so /api goes to the gateway natively.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.VITE_GATEWAY_URL ?? "http://localhost:18080",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
