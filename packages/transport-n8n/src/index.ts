import type { AgentClient, AgentCapabilities } from "@app/domain";

/**
 * N8N transport client.
 * Triggers an n8n workflow via the server proxy and returns a sessionId.
 * Real-time events are consumed via SSE by the frontend hook (use-n8n-events).
 */
export class N8nAgentClient implements AgentClient {
  constructor(private baseUrl: string = "/") {}

  getCapabilities(): AgentCapabilities {
    return { tools: false, tasks: false };
  }

  async createTask(
    input: string | { tool: string; args: Record<string, any> }
  ): Promise<{ output: string; sessionId?: string }> {
    const payload = typeof input === "string" ? { input } : { input: JSON.stringify(input) };
    const resp = await fetch(new URL("/api/n8n/trigger", this.baseUrl).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) throw new Error("Failed to trigger n8n agent");
    return resp.json();
  }
}

export type { AgentClient };
