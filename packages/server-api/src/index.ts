import type { Express } from "express";
import { createServer, type Server } from "http";
import {
  llmRouter,
  llmTitleSummarizer,
  llmIntentSynthesizer,
} from "./services/llmService";
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
} from "./services/paymentsService";
import { getCurrentBlockNumber } from "./services/blockchainService";
import { loadAgentPrompt, loadLLMRouterPrompt } from "./services/promptService";
import { loadAgentConfig } from "@app/config";

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
      const nvmApiKey = authHeader.replace("Bearer ", "").trim();
      if (!nvmApiKey) return res.status(401).json({ error: "Missing API Key" });
      const planId = req.headers["x-plan-id"] as string;
      if (!planId) return res.status(500).json({ error: "Missing plan DID" });
      const credit = await getUserCredits(nvmApiKey, planId);
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
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const nvmApiKey = authHeader.replace("Bearer ", "").trim();
        if (nvmApiKey) {
          try {
            const planId = req.headers["x-plan-id"] as string;
            if (planId) credits = await getUserCredits(nvmApiKey, planId);
          } catch {
            credits = 0;
          }
        }
      }
      const prompt = loadLLMRouterPrompt(req);
      const result = await llmRouter(message, history, credits, prompt);
      return res.json(result);
    } catch {
      return res
        .status(500)
        .json({ error: "Failed to call LLM or get credits" });
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
    const nvmApiKey = authHeader.replace("Bearer ", "").trim();
    if (!nvmApiKey) {
      return res.status(401).json({ error: "Missing API Key" });
    }
    try {
      const planId = req.headers["x-plan-id"] as string;
      if (!planId) {
        return res.status(500).json({ error: "Missing plan DID" });
      }

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
        const agentResponse = await createTask(
          inputQuery as any,
          nvmApiKey,
          planId,
          mode,
          agentConfig.endpoint,
          agentConfig.id,
          agentConfig.environment
        );
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
    const nvmApiKey = authHeader.replace("Bearer ", "").trim();
    if (!nvmApiKey) {
      return res.status(401).json({ error: "Missing API Key" });
    }
    try {
      const planId = req.headers["x-plan-id"] as string;
      if (!planId) {
        return res.status(500).json({ error: "Missing plan DID" });
      }

      // Load MCP agent configuration
      const agentConfig = loadAgentConfig("mcp");

      const tools = await listMcpTools(
        nvmApiKey,
        planId,
        agentConfig.id,
        agentConfig.environment,
        agentConfig.endpoint
      );
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
    const nvmApiKey = authHeader.replace("Bearer ", "").trim();
    if (!nvmApiKey) {
      return res.status(401).json({ error: "Missing API Key" });
    }
    try {
      const planId = req.headers["x-plan-id"] as string;
      if (!planId) {
        return res.status(500).json({ error: "Missing plan DID" });
      }

      // Load MCP agent configuration
      const agentConfig = loadAgentConfig("mcp");

      const prevEnv = {
        NVM_ENVIRONMENT: process.env.NVM_ENVIRONMENT,
      } as Record<string, string | undefined>;

      try {
        // Set environment for the MCP service
        process.env.NVM_ENVIRONMENT = agentConfig.environment;

        const result = await callMcpTool(
          tool,
          args || {},
          nvmApiKey,
          planId,
          agentConfig.id,
          agentConfig.environment,
          agentConfig.endpoint
        );
        res.json(result);
      } finally {
        process.env.NVM_ENVIRONMENT = prevEnv.NVM_ENVIRONMENT;
      }
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

  const httpServer = createServer(app);
  return httpServer;
}

export * from "./services/llmService";
export * from "./services/paymentsService";
export * from "./services/blockchainService";
export * from "./services/promptService";
