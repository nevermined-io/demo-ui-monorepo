import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "@/index.css";
import App from "./App.tsx";
import { AgentProvider } from "@app/agent-client";
import { loadRuntimeConfig } from "@app/config";
import { HttpAgentClient } from "@app/transport-http";
import { McpAgentClient } from "@app/transport-mcp";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Bootstrap />
  </StrictMode>
);

function Bootstrap() {
  const cfg = loadRuntimeConfig();
  const base = "/";
  const client =
    cfg.transport === "mcp"
      ? new McpAgentClient(base)
      : new HttpAgentClient(base);
  return (
    <AgentProvider client={client}>
      <App />
    </AgentProvider>
  );
}
