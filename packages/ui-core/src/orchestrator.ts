import type { AgentClient } from "@app/domain";
import { FilePromptProvider } from "@app/prompts";
import { loadRuntimeConfig } from "@app/config";

/**
 * Orchestrates message flow. For MCP, prefetch tools and include them if needed.
 * For now, synthesize intent is mocked by returning the user input (no LLM step).
 */
export class ConversationOrchestrator {
  private agent: AgentClient;
  constructor(agent: AgentClient) {
    this.agent = agent;
  }

  async handleUserMessage(
    input: string,
    history: any[]
  ): Promise<{
    output: string;
    action?: "no_credit" | "forward" | "no_action";
  }> {
    const cfg = loadRuntimeConfig();
    const opts: { agentType?: string; transport?: string } = {};
    if (cfg.agentId) opts.agentType = "default";
    if (cfg.transport) opts.transport = String(cfg.transport);
    const prompts = new FilePromptProvider(opts);
    await prompts.getRouterPrompt();

    let tools: any[] | undefined;
    if (this.agent.getCapabilities().tools && this.agent.listTools) {
      try {
        tools = await this.agent.listTools();
      } catch {
        // degrade gracefully
      }
    }

    const action = await this.decideNextAction(input, history, tools);
    if (action.action === "no_credit") {
      return {
        output: action.message || action.reason || "No credits available",
        action: "no_credit",
      };
    }
    const synthesized = await this.synthesizeIntent(history, input, tools);
    const agentResp = await this.agent.createTask(synthesized);
    const act: "forward" | "no_action" | "no_credit" =
      action.action === "forward" || action.action === "no_action"
        ? action.action
        : "no_credit";
    return { output: agentResp.output || "", action: act };
  }

  private async synthesizeIntent(
    history: any[],
    input: string,
    tools?: any[]
  ): Promise<string> {
    try {
      const body: any = {
        history: [...history, { role: "user", content: input }],
      };
      if (tools && tools.length) body.toolsCatalog = tools;
      const resp = await fetch("/api/intent/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data && typeof data.intent === "string" && data.intent.trim())
          return data.intent;
      }
    } catch {
      // ignore and fallback
    }
    return input;
  }

  private async decideNextAction(
    message: string,
    history: any[],
    tools?: any[]
  ): Promise<{
    action: "forward" | "no_credit" | "order_plan" | "no_action";
    message?: string;
    reason?: string;
  }> {
    try {
      const body: any = { message, history };
      const resp = await fetch("/api/llm-router", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (resp.ok) return await resp.json();
    } catch {
      // ignore
    }
    return { action: "forward" };
  }
}
