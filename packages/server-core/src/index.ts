import "dotenv/config";
import dotenv from "dotenv";
import express, { type Express, type Request, type Response } from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

/**
 * Create an Express server that serves the selected app (monorepo) and exposes /config.js
 */
export function createServer(): express.Express {
  const app: Express = express();

  // Ensure root .env is loaded when running with --prefix packages/server-core
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const repoRoot = path.resolve(__dirname, "../../..");
    dotenv.config({ path: path.resolve(repoRoot, ".env") });
  } catch {}

  // Runtime config: exposes window.__RUNTIME_CONFIG__
  app.get("/config.js", (_req: Request, res: Response) => {
    const agentId = process.env.AGENT_DID || process.env.VITE_AGENT_ID || "";
    const environment =
      process.env.VITE_NVM_ENVIRONMENT ||
      process.env.NVM_ENVIRONMENT ||
      "sandbox";
    const body =
      "window.__RUNTIME_CONFIG__ = Object.assign({}, window.__RUNTIME_CONFIG__, { VITE_AGENT_ID: " +
      JSON.stringify(agentId) +
      ", VITE_NVM_ENVIRONMENT: " +
      JSON.stringify(environment) +
      " });";
    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    res.send(body);
  });

  // Resolve monorepo root and serve UI (dev via Vite, prod via dist)
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const repoRoot = path.resolve(__dirname, "../../..");
  const uiDirFromEnv = process.env.MONOREPO_UI_DIR || "apps/agent-http-app";
  const appDir = path.isAbsolute(uiDirFromEnv)
    ? uiDirFromEnv
    : path.resolve(repoRoot, uiDirFromEnv);

  if (process.env.NODE_ENV !== "production") {
    // Dev: Vite middleware for HMR and sourcemaps
    (async () => {
      const { createServer: createViteServer } = await import("vite");
      process.env.TAILWIND_CONFIG = path.resolve(appDir, "tailwind.config.ts");
      const vite = await createViteServer({
        root: appDir,
        configFile: path.resolve(appDir, "vite.config.ts"),
        server: { middlewareMode: true },
        appType: "custom",
      } as any);
      app.use(vite.middlewares);
      app.use("*", async (req, res, next) => {
        try {
          const templatePath = path.resolve(appDir, "index.html");
          let template = await fs.promises.readFile(templatePath, "utf-8");
          template = await vite.transformIndexHtml(req.originalUrl, template);
          res.status(200).set({ "Content-Type": "text/html" }).end(template);
        } catch (e) {
          next(e);
        }
      });
    })();
  } else {
    // Prod: serve built assets
    const distDir = path.resolve(appDir, "dist");
    const indexHtml = path.resolve(distDir, "index.html");
    app.use(express.static(distDir));
    app.use("*", (_req: Request, res: Response) => {
      if (fs.existsSync(indexHtml)) {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.send(fs.readFileSync(indexHtml, "utf-8"));
        return;
      }
      res.status(500).send("App not built. Please run the app build first.");
    });
  }

  return app;
}

if (process.env.NODE_ENV !== "test") {
  const app = createServer();
  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`serving monorepo on port ${PORT}`);
  });
}
export {};
