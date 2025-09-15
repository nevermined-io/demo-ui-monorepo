import React from "react";
import { createRoot } from "react-dom/client";

function App() {
  return (
    <main className="container">
      <h1>Select an Agent UI</h1>
      <div className="grid">
        <a className="btn" href="/simple-agent/">
          Simple Agent
        </a>
        <a className="btn" href="/mcp-agent/">
          MCP Agent
        </a>
      </div>
      <style>{`
        :root { color-scheme: light dark; }
        body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Apple Color Emoji, Segoe UI Emoji; min-height: 100svh; background: #0b0c10; color: #fff; }
        .container { text-align: center; padding: 2rem; display: grid; place-items: center; min-height: 100svh; }
        h1 { font-size: 1.5rem; margin-bottom: 2rem; color: #e5e7eb; font-weight: 600; }
        .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; max-width: 720px; }
        a.btn { display: block; padding: 2rem; border-radius: 0.75rem; text-decoration: none; background: #111827; color: #f9fafb; border: 1px solid #1f2937; font-size: 1.125rem; font-weight: 600; transition: transform 150ms ease, background 150ms ease, border-color 150ms ease; }
        a.btn:hover { transform: translateY(-2px); background: #0f172a; border-color: #334155; }
        .note { margin-top: 1.25rem; color: #9ca3af; font-size: .875rem; }
        @media (max-width: 600px) { .grid { grid-template-columns: 1fr; } }
      `}</style>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
