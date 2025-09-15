// @ts-nocheck
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// Switch to Tailwind v3 via PostCSS config for better interop with ui-core preset
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "/",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "../../packages/ui-core/src"),
      "@app/ui-core": path.resolve(__dirname, "../../packages/ui-core/src"),
    },
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    include: ["react", "react-dom"],
  },
  css: {
    postcss: path.resolve(__dirname, "./postcss.config.cjs"),
  },
  server: {
    port: 3000,
    strictPort: true,
    fs: {
      allow: ["..", path.resolve(__dirname, "../../packages/ui-core")],
    },
  },
});
