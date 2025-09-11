import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
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
  const client =
    cfg.transport === "mcp"
      ? new McpAgentClient("/")
      : new HttpAgentClient("/");
  return (
    <AgentProvider client={client}>
      <App />
    </AgentProvider>
  );
}
