import type { AgentConfig, EnvConfig } from "./types.js";

/**
 * Default agent configurations
 * Centralized defaults used by both server and client
 */
export const DEFAULT_AGENTS: Record<string, AgentConfig> = {
  http: {
    //id: "42840616115630383331636037635687429922763882595058926899462535068495890946712",
    id: "1234567890",
    name: "Financial Advisor Agent",
    transport: "http",
    endpoint: "https://demo-finance-agent.nevermined.dev/ask",
    environment: "staging_sandbox",
  },
  mcp: {
    //id: "25558624986355531588229770682060163846923775146647232049329434255728263209016",
    id: "9876543210",
    name: "Weather Agent",
    transport: "mcp",
    endpoint: "https://weather-mcp-agent.nevermined.dev/mcp",
    environment: "staging_sandbox",
  },
  n8n: {
    id: "n8n-buyer-agent",
    name: "N8N Buyer Agent",
    transport: "n8n",
    endpoint: "http://localhost:4003",
    environment: "staging_sandbox",
  },
};

/**
 * Loads agent configuration from environment variables
 */
export function loadAgentConfig(transport: "http" | "mcp" | "n8n"): AgentConfig {
  const env = process.env as EnvConfig;
  const defaultAgent = DEFAULT_AGENTS[transport];

  if (!defaultAgent) {
    throw new Error(`Unknown transport: ${transport}`);
  }

  // Determine which environment variables to use based on transport
  let agentId: string | undefined;
  let agentName: string | undefined;
  let agentEndpoint: string | undefined;

  if (transport === "n8n") {
    agentEndpoint = env.N8N_WEBHOOK_URL;
  } else if (transport === "mcp") {
    agentId = env.MCP_AGENT_ID;
    agentName = env.MCP_AGENT_NAME;
    agentEndpoint = env.MCP_AGENT_ENDPOINT;
  } else {
    agentId = env.HTTP_AGENT_ID;
    agentName = env.HTTP_AGENT_NAME;
    agentEndpoint = env.HTTP_AGENT_ENDPOINT;
  }

  const environment = env.NVM_ENVIRONMENT || "sandbox";

  return {
    id: agentId ?? defaultAgent.id,
    name: agentName ?? defaultAgent.name,
    transport,
    endpoint: agentEndpoint ?? defaultAgent.endpoint,
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
    n8n: loadAgentConfig("n8n"),
  };
}

/**
 * Gets agent configuration by ID
 */
export function getAgentById(agentId: string): AgentConfig | null {
  const configs = loadAllAgentConfigs();
  return Object.values(configs).find((agent) => agent.id === agentId) || null;
}
