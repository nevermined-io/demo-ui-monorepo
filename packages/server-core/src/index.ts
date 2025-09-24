import "dotenv/config";
import dotenv from "dotenv";
import express, { type Express, type Request, type Response } from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { registerRoutes } from "@app/server-api";

/**
 * Create an Express server that serves the selected app (monorepo) and exposes /config.js
 */
export function createServer(): express.Express {
  const app: Express = express();
  // Parse JSON bodies for API endpoints
  app.use(express.json());

  // Ensure root .env is loaded when running with --prefix packages/server-core
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const repoRoot = path.resolve(__dirname, "../../..");
    dotenv.config({ path: path.resolve(repoRoot, ".env") });
  } catch {}

  // Runtime config: exposes window.__RUNTIME_CONFIG__
  app.get("/config.js", (req: Request, res: Response) => {
    // Determine transport based on the referer header or default to HTTP
    const referer = req.get("Referer") || "";
    const isMcpApp = referer.includes("/mcp-agent");

    let transport = "http";
    let agentId = "";
    let agentEndpoint = "";

    if (isMcpApp) {
      transport = "mcp";
      agentId = process.env.MCP_AGENT_ID || "";
      agentEndpoint = process.env.MCP_AGENT_ENDPOINT || "";
    } else {
      // Default to HTTP app
      transport = "http";
      agentId = process.env.HTTP_AGENT_ID || "";
      agentEndpoint = process.env.HTTP_AGENT_ENDPOINT || "";
    }

    const environment = process.env.NVM_ENVIRONMENT || "sandbox";

    const body =
      "window.__RUNTIME_CONFIG__ = Object.assign({}, window.__RUNTIME_CONFIG__, { " +
      "transport: " +
      JSON.stringify(transport) +
      ", " +
      "agentId: " +
      JSON.stringify(agentId) +
      ", " +
      "agentEndpoint: " +
      JSON.stringify(agentEndpoint) +
      ", " +
      "environment: " +
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
  const landingAppDir = path.resolve(repoRoot, "apps/landing-app");
  const httpBase = "/simple-agent";
  const mcpBase = "/mcp-agent";
  const demoAppDir = path.resolve(repoRoot, "apps/demo-app");

  // Minimal landing page at /, served via Vite in dev and static in prod
  const publicDir = path.resolve(__dirname, "../public");
  if (fs.existsSync(publicDir)) {
    // Do not auto-serve index.html from public at '/'; landing is handled separately
    app.use(express.static(publicDir, { index: false } as any));
  }
  const landingDistDir = path.resolve(landingAppDir, "dist");
  const landingIndexHtml = path.resolve(landingDistDir, "index.html");
  const demoDistDir = path.resolve(demoAppDir, "dist");
  const demoIndexHtml = path.resolve(demoDistDir, "index.html");

  if (process.env.NODE_ENV !== "production") {
    // Dev: Vite middleware mounts
    (async () => {
      const { createServer: createViteServer } = await import("vite");
      // Always serve demo-app at '/'
      const viteDemo = await createViteServer({
        root: demoAppDir,
        configFile: path.resolve(demoAppDir, "vite.config.ts"),
        server: { middlewareMode: true, hmr: { port: 24677 } },
        appType: "custom",
      } as any);
      // Let demo-app Vite handle EVERY root path except reserved prefixes
      app.use((req, res, next) => {
        const p = req.path || "/";
        if (
          p.startsWith(httpBase) ||
          p.startsWith(mcpBase) ||
          p.startsWith("/api") ||
          p === "/config.js"
        ) {
          return next();
        }
        return (viteDemo.middlewares as any)(req, res, next);
      });
      const indexPath = path.resolve(demoAppDir, "index.html");
      app.get(["/", ""], async (_req, res, next) => {
        try {
          let template = await fs.promises.readFile(indexPath, "utf-8");
          template = await viteDemo.transformIndexHtml("/", template);
          res.status(200).set({ "Content-Type": "text/html" }).end(template);
        } catch (e) {
          next(e);
        }
      });

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
      // Note: No catch-all fallback in dev to avoid intercepting agent apps
    })();
  } else {
    // Prod: serve built apps under their subpaths and demo app at '/'
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
    // Root app: always Demo app
    if (fs.existsSync(demoDistDir)) {
      app.use(express.static(demoDistDir));
    }

    // Serve demo app index.html for root and fallback routes
    app.get(["/", ""], (_req: Request, res: Response) => {
      if (fs.existsSync(demoIndexHtml)) {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.send(fs.readFileSync(demoIndexHtml, "utf-8"));
        return;
      }
      res.status(500).send("Demo app not built. Please run its build first.");
    });

    // Fallback for any non-app, non-API route to serve Demo index.html
    // But exclude static assets and other specific paths
    app.get("*", (_req: Request, res: Response, next) => {
      const p = _req.path || "/";
      if (
        p.startsWith(httpBase) ||
        p.startsWith(mcpBase) ||
        p.startsWith("/api") ||
        p.startsWith("/assets/") ||
        p.startsWith("/vite.svg") ||
        p === "/config.js"
      ) {
        return next();
      }
      if (fs.existsSync(demoIndexHtml)) {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.send(fs.readFileSync(demoIndexHtml, "utf-8"));
        return;
      }
      res.status(500).send("Demo app not built. Please run its build first.");
    });
  }

  // Mount API routes shared by clients
  (async () => {
    try {
      const httpServer = await registerRoutes(app);
      // We do not call httpServer.listen() here; server-core controls the listener below.
    } catch (e) {
      console.error("Failed to mount API routes from @app/server-api:", e);
    }
  })();

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
