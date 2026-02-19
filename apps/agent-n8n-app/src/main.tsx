import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/index.css";
import App from "./App";
import { AgentProvider } from "@app/agent-client";
import { N8nAgentClient } from "@app/transport-n8n";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Bootstrap />
  </StrictMode>
);

function Bootstrap() {
  const client = new N8nAgentClient("/");

  return (
    <AgentProvider client={client}>
      <App />
    </AgentProvider>
  );
}
