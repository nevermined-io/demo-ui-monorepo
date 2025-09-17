import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css"; // Tailwind preflight first
import "@app/ui-core/index.css"; // shared variables/base after
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
