import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { Button } from "@app/ui-core";

function App() {
  return (
    <main className="min-h-svh grid place-items-center p-8 bg-zinc-950 text-zinc-50">
      <div className="w-full max-w-2xl text-center">
        <h1 className="text-2xl font-semibold mb-6">Select an Agent UI</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Button asChild>
            <a href="/simple-agent/">Simple Agent</a>
          </Button>
          <Button asChild>
            <a href="/mcp-agent/">MCP Agent</a>
          </Button>
        </div>
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
