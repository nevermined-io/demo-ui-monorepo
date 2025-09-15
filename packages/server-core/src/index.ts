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

  // Resolve monorepo root and app directories
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const repoRoot = path.resolve(__dirname, "../../..");
  const httpAppDir = path.resolve(repoRoot, "apps/agent-http-app");
  const mcpAppDir = path.resolve(repoRoot, "apps/agent-mcp-app");
  const httpBase = "/simple-agent";
  const mcpBase = "/mcp-agent";

  // Minimal landing page at /, served via Vite in dev and static in prod
  const publicDir = path.resolve(__dirname, "../public");
  if (fs.existsSync(publicDir)) {
    // Do not auto-serve index.html from public at '/'; landing is handled separately
    app.use(express.static(publicDir, { index: false } as any));
  }
  const landingAppDir = path.resolve(__dirname, "../../landing-app");
  const landingDistDir = path.resolve(landingAppDir, "dist");
  const landingIndexHtml = path.resolve(landingDistDir, "index.html");

  if (process.env.NODE_ENV !== "production") {
    // Dev: Vite middleware for both apps mounted under subpaths
    (async () => {
      const { createServer: createViteServer } = await import("vite");
      // Landing app via Vite middleware
      if (fs.existsSync(landingAppDir)) {
        const viteLanding = await createViteServer({
          root: landingAppDir,
          configFile: false,
          server: { middlewareMode: true, hmr: { port: 24677 } },
          appType: "custom",
        } as any);
        app.use(viteLanding.middlewares);
        const indexPath = path.resolve(landingAppDir, "index.html");
        app.get(["/", ""], async (_req, res, next) => {
          try {
            let template = await fs.promises.readFile(indexPath, "utf-8");
            template = await viteLanding.transformIndexHtml("/", template);
            res.status(200).set({ "Content-Type": "text/html" }).end(template);
          } catch (e) {
            next(e);
          }
        });
      }

      // Simple Agent (HTTP)
      const viteHttp = await createViteServer({
        root: httpAppDir,
        configFile: path.resolve(httpAppDir, "vite.config.ts"),
        base: `${httpBase}/`,
        server: { middlewareMode: true, hmr: { port: 24678 } },
        appType: "custom",
      } as any);
      app.use(httpBase, viteHttp.middlewares);
      const httpIndexPath = path.resolve(httpAppDir, "index.html");
      app.get([httpBase, `${httpBase}/`], async (_req, res, next) => {
        try {
          let template = await fs.promises.readFile(httpIndexPath, "utf-8");
          template = await viteHttp.transformIndexHtml(
            `${httpBase}/`,
            template
          );
          res.status(200).set({ "Content-Type": "text/html" }).end(template);
        } catch (e) {
          next(e);
        }
      });
      app.get(`${httpBase}/*`, async (_req, res, next) => {
        try {
          let template = await fs.promises.readFile(httpIndexPath, "utf-8");
          template = await viteHttp.transformIndexHtml(
            `${httpBase}/`,
            template
          );
          res.status(200).set({ "Content-Type": "text/html" }).end(template);
        } catch (e) {
          next(e);
        }
      });

      // MCP Agent
      const viteMcp = await createViteServer({
        root: mcpAppDir,
        configFile: path.resolve(mcpAppDir, "vite.config.ts"),
        base: `${mcpBase}/`,
        server: { middlewareMode: true, hmr: { port: 24679 } },
        appType: "custom",
      } as any);
      app.use(mcpBase, viteMcp.middlewares);
      const mcpIndexPath = path.resolve(mcpAppDir, "index.html");
      app.get([mcpBase, `${mcpBase}/`], async (_req, res, next) => {
        try {
          let template = await fs.promises.readFile(mcpIndexPath, "utf-8");
          template = await viteMcp.transformIndexHtml(`${mcpBase}/`, template);
          res.status(200).set({ "Content-Type": "text/html" }).end(template);
        } catch (e) {
          next(e);
        }
      });
      app.get(`${mcpBase}/*`, async (_req, res, next) => {
        try {
          let template = await fs.promises.readFile(mcpIndexPath, "utf-8");
          template = await viteMcp.transformIndexHtml(`${mcpBase}/`, template);
          res.status(200).set({ "Content-Type": "text/html" }).end(template);
        } catch (e) {
          next(e);
        }
      });
    })();
  } else {
    // Prod: serve both built apps under their subpaths
    const httpDistDir = path.resolve(httpAppDir, "dist");
    const httpIndexHtml = path.resolve(httpDistDir, "index.html");
    app.use(httpBase, express.static(httpDistDir));
    app.get([httpBase, `${httpBase}/*`], (_req: Request, res: Response) => {
      if (fs.existsSync(httpIndexHtml)) {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.send(fs.readFileSync(httpIndexHtml, "utf-8"));
        return;
      }
      res
        .status(500)
        .send("Simple Agent app not built. Please run its build first.");
    });

    const mcpDistDir = path.resolve(mcpAppDir, "dist");
    const mcpIndexHtml = path.resolve(mcpDistDir, "index.html");
    app.use(mcpBase, express.static(mcpDistDir));
    app.get([mcpBase, `${mcpBase}/*`], (_req: Request, res: Response) => {
      if (fs.existsSync(mcpIndexHtml)) {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.send(fs.readFileSync(mcpIndexHtml, "utf-8"));
        return;
      }
      res
        .status(500)
        .send("MCP Agent app not built. Please run its build first.");
    });
    // Landing built output
    if (fs.existsSync(landingDistDir)) {
      app.use(express.static(landingDistDir));
      app.get(["/", ""], (_req: Request, res: Response) => {
        if (fs.existsSync(landingIndexHtml)) {
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.send(fs.readFileSync(landingIndexHtml, "utf-8"));
          return;
        }
        res
          .status(500)
          .send("Landing app not built. Please run its build first.");
      });
    }
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
