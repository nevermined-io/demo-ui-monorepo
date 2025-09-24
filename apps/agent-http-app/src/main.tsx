import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "@/index.css";
import App from "./App";
import { AgentProvider } from "@app/agent-client";
import { HttpAgentClient } from "@app/transport-http";
import { McpAgentClient } from "@app/transport-mcp";
import { useAppConfig, loadRuntimeConfig } from "@app/ui-core";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Bootstrap />
  </StrictMode>
);

function Bootstrap() {
  const [configLoaded, setConfigLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load runtime configuration before rendering the app
    loadRuntimeConfig()
      .then(() => {
        setConfigLoaded(true);
      })
      .catch((err: any) => {
        console.error("Failed to load runtime configuration:", err);
        setError("Failed to load configuration");
        // Still allow the app to render with fallback config
        setConfigLoaded(true);
      });
  }, []);

  // Read configuration directly from environment variables
  const { transport } = useAppConfig();
  const base = "/";
  const client =
    transport === "mcp" ? new McpAgentClient(base) : new HttpAgentClient(base);

  if (!configLoaded) {
    return <div>Loading configuration...</div>;
  }

  if (error) {
    console.warn("Configuration error:", error);
  }

  return (
    <AgentProvider client={client}>
      <App />
    </AgentProvider>
  );
}
