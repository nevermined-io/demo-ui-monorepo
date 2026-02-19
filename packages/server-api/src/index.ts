import type { Express, Response } from "express";
import { createServer, type Server } from "http";
import {
  llmRouter,
  llmTitleSummarizer,
  llmIntentSynthesizer,
} from "./services/llmService.js";
import {
  getUserCredits,
  createTask,
  orderPlanCredits,
  getBurnTransactionInfo,
  getTask,
  getPlanCost,
  redeemCredits,
  listMcpTools,
  callMcpTool,
} from "./services/paymentsService.js";
import { getCurrentBlockNumber } from "./services/blockchainService.js";
import {
  loadAgentPrompt,
  loadLLMRouterPrompt,
} from "./services/promptService.js";
import { loadAgentConfig } from "@app/config";
import { decodeAccessToken } from "@nevermined-io/payments";
import crypto from "crypto";

/**
 * Helper function to extract planId from MCP OAuth access token.
 * @param accessToken - The MCP OAuth access token
 * @returns The planId extracted from the token, or null if not found
 */
function extractPlanIdFromMcpToken(accessToken: string): string | null {
  try {
    const paymentRequired = decodeAccessToken(accessToken);
    if (paymentRequired?.accepted?.planId) {
      return paymentRequired.accepted.planId;
    }
    return null;
  } catch (error) {
    console.warn("[extractPlanIdFromMcpToken] Failed to decode token:", error);
    return null;
  }
}

/**
 * Registers all API routes on a provided Express app and returns an http.Server.
 * This mirrors the monolithic servers so client apps can call the same endpoints.
 * @param app - Express application
 * @returns http server bound to the provided app
 */
export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/title/summarize", async (req, res) => {
    try {
      const { history } = req.body;
      if (!Array.isArray(history)) {
        return res.status(400).json({ error: "Missing or invalid history" });
      }
      const title = await llmTitleSummarizer(history);
      res.json({ title });
    } catch {
      res.status(500).json({ error: "Failed to generate title" });
    }
  });

  app.get("/api/credit", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res
          .status(401)
          .json({ error: "Missing or invalid Authorization header" });
      }
      const authToken = authHeader.replace("Bearer ", "").trim();
      if (!authToken)
        return res.status(401).json({ error: "Missing authentication token" });

      // Get agent mode from header
      const headerMode = String(
        (req.headers["x-agent-mode"] as string) || ""
      ).toLowerCase();

      let planId = req.headers["x-plan-id"] as string;

      // For MCP mode, always decode the token to extract planId
      // (frontend doesn't send X-Plan-Id for MCP transport)
      if (headerMode === "mcp") {
        const decodedPlanId = extractPlanIdFromMcpToken(authToken);
        if (decodedPlanId) {
          planId = decodedPlanId;
          console.log("[api/credit] Extracted Plan ID from MCP token:", planId);
        }
      }

      if (!planId) return res.status(500).json({ error: "Missing plan DID" });

      // For HTTP mode, authToken is nvmApiKey; for MCP mode, it's the OAuth access token
      const credit = await getUserCredits(authToken, planId);
      res.json({ credit });
    } catch (err) {
      console.error("Error fetching credit:", err);
      res.status(500).json({ error: "Failed to fetch credit" });
    }
  });

  app.post("/api/llm-router", async (req, res) => {
    const { message, history } = req.body;
    if (typeof message !== "string") {
      return res.status(400).json({ error: "Missing message" });
    }
    try {
      const authHeader = req.headers.authorization;
      let credits = 0;
      let isAuthenticated = false;

      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.replace("Bearer ", "").trim();
        if (token) {
          // User has a token (either API key for HTTP or access token for MCP)
          isAuthenticated = true;

          // Try to get credits (for HTTP mode with planId, or MCP mode by decoding token)
          try {
            const headerMode = String(
              (req.headers["x-agent-mode"] as string) || ""
            ).toLowerCase();
            let planId = req.headers["x-plan-id"] as string;

            // For MCP mode, decode the token to extract planId
            if (headerMode === "mcp" && !planId) {
              planId = extractPlanIdFromMcpToken(token) || "";
            }

            if (planId) {
              credits = await getUserCredits(token, planId);
            }
          } catch {
            credits = 0;
          }
        }
      }

      const prompt = loadLLMRouterPrompt(req);
      const result = await llmRouter(
        message,
        history,
        credits,
        isAuthenticated,
        prompt
      );
      return res.json(result);
    } catch {
      return res
        .status(500)
        .json({ error: "Failed to call LLM or get credits" });
    }
  });

  // Development endpoint to reload LLM router prompt (clears cache)
  app.post("/api/dev/reload-prompt", async (req, res) => {
    try {
      const { reloadLLMRouterPrompt } = await import(
        "./services/promptService.js"
      );
      const prompt = reloadLLMRouterPrompt(req);
      return res.json({
        success: true,
        message: "LLM router prompt reloaded from disk",
        promptLength: prompt.length,
      });
    } catch (error) {
      return res.status(500).json({
        error: "Failed to reload prompt",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.post("/api/order-plan", async (req, res) => {
    const planId = req.headers["x-plan-id"] as string;
    if (!planId) {
      return res.status(500).json({ error: "Missing plan DID" });
    }
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ error: "Missing or invalid Authorization header" });
    }
    const nvmApiKey = authHeader.replace("Bearer ", "").trim();
    if (!nvmApiKey) {
      return res.status(401).json({ error: "Missing API Key" });
    }
    const result = await orderPlanCredits(planId, nvmApiKey);
    if (result.success) {
      res.json({
        message:
          result.message ||
          "Plan purchased successfully. You now have credits!",
        txHash: result.txHash,
        credits: result.credits,
        planId,
      });
    } else {
      res.status(402).json({ error: result.message });
    }
  });

  app.post("/api/intent/synthesize", async (req, res) => {
    try {
      const { history, toolsCatalog } = req.body || {};
      if (!Array.isArray(history)) {
        return res.status(400).json({ error: "Missing or invalid history" });
      }
      const agentPrompt = loadAgentPrompt(req);
      const intent = await llmIntentSynthesizer(
        history,
        agentPrompt,
        toolsCatalog
      );
      res.json({ intent });
    } catch {
      res.status(500).json({ error: "Failed to synthesize intent" });
    }
  });

  app.post("/api/agent", async (req, res) => {
    const { input_query: inputQuery } = req.body || {};
    if (
      typeof inputQuery !== "string" &&
      !(
        inputQuery &&
        typeof inputQuery === "object" &&
        typeof inputQuery.tool === "string"
      )
    ) {
      return res.status(400).json({ error: "Missing or invalid input_query" });
    }
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ error: "Missing or invalid Authorization header" });
    }
    const authToken = authHeader.replace("Bearer ", "").trim();
    if (!authToken) {
      return res.status(401).json({ error: "Missing authentication token" });
    }
    try {
      // Get agent mode from header only (no fallback inference)
      const headerMode = String(
        (req.headers["x-agent-mode"] as string) || ""
      ).toLowerCase();

      if (headerMode !== "http" && headerMode !== "mcp") {
        return res.status(400).json({
          error:
            "Missing or invalid x-agent-mode header. Must be 'http' or 'mcp'",
        });
      }

      const mode = headerMode as "http" | "mcp";

      // Load agent configuration based on mode
      const agentConfig = loadAgentConfig(mode);

      try {
        let agentResponse;

        if (mode === "http") {
          // HTTP mode: requires planId and uses Nevermined
          const planId = req.headers["x-plan-id"] as string;
          if (!planId) {
            return res
              .status(500)
              .json({ error: "Missing plan DID for HTTP agent" });
          }

          agentResponse = await createTask(
            inputQuery as any,
            authToken, // nvmApiKey for HTTP
            mode,
            agentConfig.endpoint,
            agentConfig.id,
            agentConfig.environment,
            planId
          );
        } else {
          // MCP mode: uses OAuth access token directly
          agentResponse = await createTask(
            inputQuery as any,
            authToken, // OAuth access token for MCP
            mode,
            agentConfig.endpoint
          );
        }

        return res.status(200).json(agentResponse);
      } catch (error) {
        console.error("Error creating task:", error);
        return res.status(500).json({ error: "Failed to call agent" });
      }
    } catch (error) {
      console.error("Error creating task:", error);
      return res.status(500).json({ error: "Failed to call agent" });
    }
  });

  app.get("/api/mcp/tools", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ error: "Missing or invalid Authorization header" });
    }
    const accessToken = authHeader.replace("Bearer ", "").trim();
    if (!accessToken) {
      return res.status(401).json({ error: "Missing access token" });
    }
    try {
      // Load MCP agent configuration
      const agentConfig = loadAgentConfig("mcp");

      // Use OAuth access token directly (no need for Nevermined SDK)
      const tools = await listMcpTools(accessToken, agentConfig.endpoint);
      res.json(tools);
    } catch (err) {
      console.error("Error listing MCP tools:", err);
      res.status(500).json({ error: "Failed to list MCP tools" });
    }
  });

  app.post("/api/mcp/tool", async (req, res) => {
    const { tool, args } = req.body || {};
    if (typeof tool !== "string") {
      return res.status(400).json({ error: "Missing tool" });
    }
    if (args && typeof args !== "object") {
      return res.status(400).json({ error: "Invalid args" });
    }
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ error: "Missing or invalid Authorization header" });
    }
    const accessToken = authHeader.replace("Bearer ", "").trim();
    if (!accessToken) {
      return res.status(401).json({ error: "Missing access token" });
    }
    try {
      // Load MCP agent configuration
      const agentConfig = loadAgentConfig("mcp");

      // Use OAuth access token directly (no need for Nevermined SDK)
      const result = await callMcpTool(
        tool,
        args || {},
        accessToken,
        agentConfig.endpoint
      );
      res.json(result);
    } catch (err) {
      console.error("Error calling MCP tool:", err);
      res.status(500).json({ error: "Failed to call MCP tool" });
    }
  });

  app.get("/api/latest-block", async (_req, res) => {
    try {
      const blockNumber = await getCurrentBlockNumber();
      res.json({ blockNumber });
    } catch {
      res.status(500).json({ error: "Failed to fetch latest block" });
    }
  });

  app.get("/api/find-burn-tx", async (req, res) => {
    const { fromBlock } = req.query;
    if (!fromBlock) {
      return res.status(400).json({ error: "Missing fromBlock parameter" });
    }
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ error: "Missing or invalid Authorization header" });
    }
    const nvmApiKey = authHeader.replace("Bearer ", "").trim();
    if (!nvmApiKey) {
      return res.status(401).json({ error: "Missing API Key" });
    }
    try {
      const planId = req.headers["x-plan-id"] as string;
      if (!planId) {
        return res.status(500).json({ error: "Missing plan DID" });
      }
      const result = await getBurnTransactionInfo(
        Number(fromBlock),
        nvmApiKey,
        planId
      );
      if (result && (result as any).txHash) {
        res.json(result);
      } else {
        res.status(404).json({ message: "No burn transaction found" });
      }
    } catch {
      res.status(500).json({ error: "Failed to search for burn transaction" });
    }
  });

  app.get("/api/task", async (req, res) => {
    const { task_id } = req.query;
    if (!task_id) {
      return res.status(400).json({ error: "Missing task_id" });
    }
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ error: "Missing or invalid Authorization header" });
    }
    const nvmApiKey = authHeader.replace("Bearer ", "").trim();
    if (!nvmApiKey) {
      return res.status(401).json({ error: "Missing API Key" });
    }
    const planId = req.headers["x-plan-id"] as string;
    if (!planId) {
      return res.status(500).json({ error: "Missing plan DID" });
    }
    const task = await getTask(String(task_id), nvmApiKey, planId);
    res.json(task);
  });

  app.get("/api/plan/cost", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ error: "Missing or invalid Authorization header" });
    }
    const nvmApiKey = authHeader.replace("Bearer ", "").trim();
    if (!nvmApiKey) {
      return res.status(401).json({ error: "Missing API Key" });
    }
    try {
      const planId = req.headers["x-plan-id"] as string;
      if (!planId) {
        return res.status(500).json({ error: "Missing plan DID" });
      }
      const result = await getPlanCost(nvmApiKey, planId);
      res.json(result);
    } catch {
      res.status(500).json({ error: "Failed to get plan price and credits" });
    }
  });

  app.post("/api/burn-credits", async (req, res) => {
    const { credits } = req.body || {};
    if (!credits || isNaN(Number(credits)) || Number(credits) <= 0) {
      return res
        .status(400)
        .json({ error: "Missing or invalid credits amount" });
    }
    const planId = req.headers["x-plan-id"] as string;
    if (!planId) {
      return res.status(500).json({ error: "Missing plan DID" });
    }
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ error: "Missing or invalid Authorization header" });
    }
    const nvmApiKey = authHeader.replace("Bearer ", "").trim();
    if (!nvmApiKey) {
      return res.status(401).json({ error: "Missing API Key" });
    }
    const result = await redeemCredits(planId, String(credits), nvmApiKey);
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json({ error: result.message });
    }
  });

  // ── N8N Agent: in-memory session store ──────────────────────────────
  interface N8nEvent {
    sessionId: string;
    timestamp: string;
    step: string;
    data?: any;
  }
  interface N8nSession {
    events: N8nEvent[];
    sseClients: Set<Response>;
  }
  const n8nSessions = new Map<string, N8nSession>();

  const SESSION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Pushes an event to an n8n session and notifies all SSE clients.
   */
  function pushN8nEvent(sessionId: string, step: string, data?: any) {
    const session = n8nSessions.get(sessionId);
    if (!session) return;

    const event: N8nEvent = {
      sessionId,
      timestamp: new Date().toISOString(),
      step,
      data,
    };
    session.events.push(event);

    for (const client of session.sseClients) {
      try {
        client.write(`data: ${JSON.stringify(event)}\n\n`);
      } catch {}
    }

    // If complete or error, close SSE connections after a short delay
    if (step === "complete" || step === "error") {
      setTimeout(() => {
        for (const client of session.sseClients) {
          try { client.end(); } catch {}
        }
        session.sseClients.clear();
      }, 500);
    }
  }

  /**
   * Extracts year numbers from a text string.
   * Looks for 4-digit numbers between 1900 and 2100.
   */
  function parseYearsFromInput(input: string): number[] {
    const matches = input.match(/\b(19|20)\d{2}\b/g);
    if (!matches || matches.length === 0) return [2021, 2024]; // defaults
    return [...new Set(matches.map(Number))].sort();
  }

  /**
   * POST /api/n8n/trigger
   * Receives { input } from the frontend, parses years, calls the research
   * agent once per year (sequentially). The agent sends intermediate events
   * to /api/n8n/callback which streams them to the frontend via SSE.
   * After all years are processed, pushes a final "complete" event.
   */
  app.post("/api/n8n/trigger", async (req, res) => {
    try {
      const { input } = req.body || {};
      if (typeof input !== "string") {
        return res.status(400).json({ error: "Missing or invalid input" });
      }

      const sessionId = crypto.randomUUID();
      n8nSessions.set(sessionId, { events: [], sseClients: new Set() });

      // Auto-cleanup after timeout
      setTimeout(() => {
        const session = n8nSessions.get(sessionId);
        if (session) {
          for (const client of session.sseClients) {
            try { client.end(); } catch {}
          }
          n8nSessions.delete(sessionId);
        }
      }, SESSION_TIMEOUT_MS);

      const years = parseYearsFromInput(input);
      const agentConfig = loadAgentConfig("n8n");
      const agentUrl = agentConfig.endpoint;

      // Callback URL — sessionId sent as a separate field
      const protocol = req.protocol;
      const host = req.get("host") || "localhost:3000";
      const callbackUrl = `${protocol}://${host}/api/n8n/callback`;

      // Respond immediately — the rest happens in the background
      res.json({ output: "Processing your request...", sessionId });

      // Single POST to the n8n agent with all years.
      // The agent sends intermediate events to callbackUrl during processing.
      // When done, its HTTP response contains the final summary/financial records.
      (async () => {
        try {
          const agentResp = await fetch(agentUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ years, callbackUrl, sessionId }),
          });
          const agentData = await agentResp.json();
          console.log("[n8n/trigger] Agent response:", JSON.stringify(agentData).slice(0, 500));

          // Push the final "complete" event with the summary from the agent response
          pushN8nEvent(sessionId, "complete", {
            summary: agentData.summary || agentData.message || "Analysis complete.",
            articles: agentData.articles || [],
          });
        } catch (err) {
          console.error("[n8n/trigger] Failed to call research agent:", err);
          pushN8nEvent(sessionId, "error", {
            message: "Failed to reach research agent",
          });
        }
      })();
    } catch (error) {
      console.error("[n8n/trigger] Error:", error);
      if (!res.headersSent) {
        return res.status(500).json({ error: "Failed to trigger n8n agent" });
      }
    }
  });

  /**
   * POST /api/n8n/callback
   * Receives events from the research agent.
   * sessionId comes from the query param (set by our trigger), not from the body
   * (which contains the agent's own sessionId).
   */
  app.post("/api/n8n/callback", (req, res) => {
    const { sessionId, timestamp, step, data } = req.body || {};

    console.log("[n8n/callback] Received:", { sessionId, step, data: JSON.stringify(data)?.slice(0, 300) });

    if (!sessionId || !step) {
      return res.status(400).json({ error: "Missing sessionId query param or step in body" });
    }

    // Ignore "complete" from callbacks — we generate our own from the HTTP response
    // (which includes the full summary). This avoids duplicate complete events.
    if (step === "complete") {
      return res.status(200).json({ ok: true, ignored: true });
    }

    let session = n8nSessions.get(sessionId);
    if (!session) {
      // Create session on the fly if it doesn't exist yet (race condition safety)
      session = { events: [], sseClients: new Set() };
      n8nSessions.set(sessionId, session);
    }

    const event: N8nEvent = {
      sessionId,
      timestamp: timestamp || new Date().toISOString(),
      step,
      data,
    };
    session.events.push(event);

    // Push to all connected SSE clients
    for (const client of session.sseClients) {
      try {
        client.write(`data: ${JSON.stringify(event)}\n\n`);
      } catch {}
    }

    return res.status(200).json({ ok: true });
  });

  /**
   * GET /api/n8n/events/:sessionId
   * SSE endpoint. Replays existing events then streams new ones in real time.
   */
  app.get("/api/n8n/events/:sessionId", (req, res) => {
    const { sessionId } = req.params;
    const session = n8nSessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    // Set up SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    // Replay existing events
    for (const event of session.events) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }

    // Check if session is already complete
    const isComplete = session.events.some((e) => e.step === "complete" || e.step === "error");
    if (isComplete) {
      res.end();
      return;
    }

    // Register this client for future events
    session.sseClients.add(res);

    // Safety timeout
    const timeout = setTimeout(() => {
      session.sseClients.delete(res);
      try { res.end(); } catch {}
    }, SESSION_TIMEOUT_MS);

    // Clean up on client disconnect
    req.on("close", () => {
      clearTimeout(timeout);
      session.sseClients.delete(res);
    });
  });

  const httpServer = createServer(app);
  return httpServer;
}

export * from "./services/llmService.js";
export * from "./services/paymentsService.js";
export * from "./services/blockchainService.js";
export * from "./services/promptService.js";
