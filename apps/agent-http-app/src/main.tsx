import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/index.css";
import App from "./App";
import { AgentProvider } from "@app/agent-client";
import { HttpAgentClient } from "@app/transport-http";
import { McpAgentClient } from "@app/transport-mcp";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Bootstrap />
  </StrictMode>
);

function Bootstrap() {
  // Read configuration directly from environment variables
  const transport = (import.meta as any).env?.VITE_TRANSPORT || "http";
  const base = "/";
  const client =
    transport === "mcp" ? new McpAgentClient(base) : new HttpAgentClient(base);
  return (
    <AgentProvider client={client}>
      <App />
    </AgentProvider>
  );
}
