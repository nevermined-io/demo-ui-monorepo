import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "/mcp-agent/",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "../../packages/ui-core/src"),
    },
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    include: ["react", "react-dom"],
  },
  css: {
    postcss: path.resolve(__dirname, "./postcss.config.js"),
  },
  server: {
    port: 3000,
    strictPort: true,
    fs: { allow: ["..", path.resolve(__dirname, "../../packages/ui-core")] },
  },
});
