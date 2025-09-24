import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@app/ui-core": path.resolve(__dirname, "../../packages/ui-core/src"),
    },
    dedupe: ["react", "react-dom"],
  },
  css: {
    postcss: path.resolve(__dirname, "./postcss.config.cjs"),
  },
});
