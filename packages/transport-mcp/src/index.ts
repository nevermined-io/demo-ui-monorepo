import type { AgentClient, AgentCapabilities } from "@app/domain";

/**
 * MCP transport calling server proxy endpoints for tools and calls.
 * Compatible con demo-mcp-ui.
 */
export class McpAgentClient implements AgentClient {
  constructor(private baseUrl: string = "/") {}

  getCapabilities(): AgentCapabilities {
    return { tools: true, tasks: false };
  }

  private commonHeaders(): HeadersInit {
    const apiKey = localStorage.getItem("nvmApiKey") || "";
    const planId = localStorage.getItem("nvmPlanId") || "";
    return {
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      ...(planId ? { "X-Plan-Id": planId } : {}),
    } as HeadersInit;
  }

  async listTools(): Promise<any[]> {
    const resp = await fetch(
      new URL("/api/mcp/tools", this.baseUrl).toString(),
      {
        headers: this.commonHeaders(),
      }
    );
    if (!resp.ok) throw new Error("Failed to list MCP tools");
    return await resp.json();
  }

  async callTool(
    tool: string,
    args: Record<string, any>
  ): Promise<{ output: string; content?: any }> {
    const resp = await fetch(
      new URL("/api/mcp/tool", this.baseUrl).toString(),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...this.commonHeaders(),
        },
        body: JSON.stringify({ tool, args }),
      }
    );
    if (!resp.ok) throw new Error("Failed to call MCP tool");
    const data = await resp.json();
    return { output: data.output, content: data.content };
  }

  async createTask(
    input: string | { tool: string; args: Record<string, any> }
  ): Promise<{ output: string }> {
    const payload =
      typeof input === "string"
        ? { input_query: input }
        : { input_query: input };
    const resp = await fetch(new URL("/api/agent", this.baseUrl).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.commonHeaders() },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) throw new Error("Failed to call agent");
    const data = await resp.json();
    return { output: data.output || "" };
  }
}

export type { AgentClient };
