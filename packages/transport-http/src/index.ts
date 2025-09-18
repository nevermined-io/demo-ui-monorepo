import type { AgentClient, AgentCapabilities } from "@app/domain";
// Removed loadRuntimeConfig import - using environment variables directly

/**
 * Gets the stored Plan ID with transport-specific namespacing.
 * @returns {string} The stored Plan ID or empty string if not present.
 */
function getStoredPlanId(): string {
  try {
    const transport = "http"; // HTTP transport is hardcoded for this package
    const scopedKey = `nvmPlanId_${transport}`;
    const scopedValue = localStorage.getItem(scopedKey);
    const legacyValue = localStorage.getItem("nvmPlanId");
    return scopedValue || legacyValue || "";
  } catch (error) {
    console.warn("[transport-http] getStoredPlanId error:", error);
    return "";
  }
}

/**
 * HTTP transport calling existing backend proxy endpoints.
 * Compatible con demo-agent-ui.
 */
export class HttpAgentClient implements AgentClient {
  constructor(private baseUrl: string = "/") {}

  getCapabilities(): AgentCapabilities {
    return { tools: false, tasks: true };
  }

  private commonHeaders(): HeadersInit {
    const apiKey = localStorage.getItem("nvmApiKey") || "";
    const transport = "http"; // HTTP transport is hardcoded for this package
    const scopedKey = `nvmPlanId_${transport}`;
    const planId = getStoredPlanId();
    const endpoint = (globalThis as any)?.__RUNTIME_CONFIG__?.endpoint || "";
    return {
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      ...(planId ? { "X-Plan-Id": planId } : {}),
      ...(endpoint ? { "X-Agent-Endpoint": endpoint } : {}),
      "X-Agent-Mode": transport,
    } as HeadersInit;
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

  async getTask(taskId: string): Promise<any> {
    const resp = await fetch(
      new URL(
        `/api/task?task_id=${encodeURIComponent(taskId)}`,
        this.baseUrl
      ).toString(),
      {
        headers: {
          "Content-Type": "application/json",
          ...this.commonHeaders(),
        },
      }
    );
    if (!resp.ok) throw new Error("Failed to get task");
    return await resp.json();
  }
}

export type { AgentClient };
