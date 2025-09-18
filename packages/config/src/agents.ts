import type { AgentConfig, EnvConfig } from "./types";

/**
 * Default agent configurations
 */
const DEFAULT_AGENTS: Record<string, AgentConfig> = {
  http: {
    id: "did:nv:f82254a93e8486e102031b6567c2d734f21a71ca793358b1a07d03eb409a546a",
    name: "Financial Advisor Agent",
    transport: "http",
    endpoint: "http://localhost:3001/ask",
    environment: "staging_sandbox",
  },
  mcp: {
    id: "did:nv:3fe43029c257aad4694ad037e4ceae5360d7f2061c7982117bf8da9c20614000",
    name: "Weather Agent",
    transport: "mcp",
    endpoint: "http://localhost:3002/mcp",
    environment: "staging_sandbox",
  },
};

/**
 * Loads agent configuration from environment variables
 */
export function loadAgentConfig(transport: "http" | "mcp"): AgentConfig {
  const env = process.env as EnvConfig;
  const defaultAgent = DEFAULT_AGENTS[transport];

  if (!defaultAgent) {
    throw new Error(`Unknown transport: ${transport}`);
  }

  // Determine which environment variables to use based on transport
  const agentId =
    transport === "http"
      ? env.HTTP_AGENT_ID || env.AGENT_DID || env.VITE_AGENT_ID
      : env.MCP_AGENT_ID || env.AGENT_DID || env.VITE_AGENT_ID;

  const agentName =
    transport === "http" ? env.HTTP_AGENT_NAME : env.MCP_AGENT_NAME;

  const agentEndpoint =
    transport === "http" ? env.HTTP_AGENT_ENDPOINT : env.MCP_AGENT_ENDPOINT;

  const environment =
    env.NVM_ENVIRONMENT || env.VITE_NVM_ENVIRONMENT || "staging_sandbox";

  return {
    id: agentId || defaultAgent.id,
    name: agentName || defaultAgent.name,
    transport,
    endpoint: agentEndpoint || defaultAgent.endpoint,
    environment,
  };
}

/**
 * Loads all agent configurations
 */
export function loadAllAgentConfigs(): Record<string, AgentConfig> {
  return {
    http: loadAgentConfig("http"),
    mcp: loadAgentConfig("mcp"),
  };
}

/**
 * Gets agent configuration by ID
 */
export function getAgentById(agentId: string): AgentConfig | null {
  const configs = loadAllAgentConfigs();
  return Object.values(configs).find((agent) => agent.id === agentId) || null;
}
