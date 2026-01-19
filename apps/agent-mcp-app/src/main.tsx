import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "@/index.css";
import App from "./App.tsx";
import { AgentProvider } from "@app/agent-client";
import { HttpAgentClient } from "@app/transport-http";
import { McpAgentClient } from "@app/transport-mcp";
import { useAppConfig } from "@app/ui-core";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Bootstrap />
  </StrictMode>
);

function Bootstrap() {
  // Read configuration from environment variables
  const { transport } = useAppConfig();
  const base = "/";
  const client =
    transport === "mcp" ? new McpAgentClient(base) : new HttpAgentClient(base);

  return (
    <AgentProvider client={client}>
      <App />
    </AgentProvider>
  );
}
