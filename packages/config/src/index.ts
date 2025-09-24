import type { RuntimeConfig, AgentConfig } from "./types.js";
import { loadAgentConfig } from "./agents.js";

/**
 * Loads runtime configuration from environment variables and window globals.
 * @param req - Optional Express request to infer the app
 * @returns Runtime configuration object
 */
export function loadRuntimeConfig(req?: any): RuntimeConfig {
  // Try to get from window globals first (for client-side)
  const fromWindow = (globalThis as any)?.__RUNTIME_CONFIG__ || {};

  // Determine transport from various sources
  const transport = (fromWindow.transport ||
    process.env.TRANSPORT ||
    "http") as "http" | "mcp";

  // Load agent configuration based on transport
  const agent = loadAgentConfig(transport);

  // Override with window globals if available
  const finalAgent: AgentConfig = {
    ...agent,
    id: fromWindow.agentId || agent.id,
    name: fromWindow.agentName || agent.name,
    endpoint: fromWindow.endpoint || agent.endpoint,
    environment: fromWindow.environment || agent.environment,
  };

  return {
    transport,
    agent: finalAgent,
    environment: finalAgent.environment,
  };
}

/**
 * Gets the current agent configuration
 */
export function getCurrentAgent(): AgentConfig {
  const config = loadRuntimeConfig();
  return config.agent;
}

/**
 * Gets agent configuration by transport type
 */
export function getAgentByTransport(transport: "http" | "mcp"): AgentConfig {
  return loadAgentConfig(transport);
}

/**
 * Builds a Nevermined Checkout URL for a given agent id.
 * Uses environment to pick the base host.
 */
export function buildNeverminedCheckoutUrl(
  agentId: string,
  options: { returnApiKey?: boolean; returnUrl?: string } = {}
): string {
  const { environment } = loadRuntimeConfig();
  const baseUrl =
    environment === "sandbox"
      ? "https://nevermined.app"
      : "https://nevermined.dev";
  const base = `${baseUrl}/checkout/${encodeURIComponent(agentId)}`;
  const params = new URLSearchParams();
  if (options.returnApiKey) params.set("export", "nvm-api-key");
  const returnUrl =
    options.returnUrl ||
    (() => {
      try {
        const { origin, pathname } = window.location;
        return `${origin}${pathname}`;
      } catch {
        return "";
      }
    })();
  if (returnUrl) params.set("returnUrl", returnUrl);
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

// Re-export types and functions
export type { RuntimeConfig, AgentConfig } from "./types.js";
export {
  loadAgentConfig,
  loadAllAgentConfigs,
  getAgentById,
} from "./agents.js";
