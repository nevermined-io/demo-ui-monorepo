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

// Re-export types and functions
export type { RuntimeConfig, AgentConfig } from "./types.js";
export {
  loadAgentConfig,
  loadAllAgentConfigs,
  getAgentById,
  DEFAULT_AGENTS,
} from "./agents.js";
