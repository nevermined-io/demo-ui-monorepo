import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "/mcp-agent/",
  define: {
    // Define environment variables for MCP agent
    "import.meta.env.VITE_TRANSPORT": '"mcp"',
    "import.meta.env.VITE_MCP_AGENT_ID": JSON.stringify(
      process.env.MCP_AGENT_ID || ""
    ),
    "import.meta.env.VITE_MCP_AGENT_ENDPOINT": JSON.stringify(
      process.env.MCP_AGENT_ENDPOINT || ""
    ),
    "import.meta.env.VITE_NVM_ENVIRONMENT": JSON.stringify(
      process.env.NVM_ENVIRONMENT || ""
    ),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "../../packages/ui-core/src"),
      "@app/agent-client": path.resolve(
        __dirname,
        "../../packages/agent-client/src"
      ),
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
    fs: {
      allow: [
        "..",
        path.resolve(__dirname, "../../packages/ui-core"),
        path.resolve(__dirname, "../../packages/agent-client"),
      ],
    },
  },
});
