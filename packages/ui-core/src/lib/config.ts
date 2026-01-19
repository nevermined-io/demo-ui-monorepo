/**
 * Configuration system using environment variables
 * This matches the backend's approach using DEFAULT_AGENTS + env vars
 */

export interface AppConfig {
  transport: "http" | "mcp";
  agentId: string;
  agentEndpoint: string;
  environment: string;
  mcpClientId?: string;
}

// Default agent configurations (matches backend DEFAULT_AGENTS)
const DEFAULT_AGENTS = {
  http: {
    id: "did:nv:f82254a93e8486e102031b6567c2d734f21a71ca793358b1a07d03eb409a546a",
    endpoint: "http://localhost:3001/ask",
    environment: "staging_sandbox",
  },
  mcp: {
    id: "did:nv:3fe43029c257aad4694ad037e4ceae5360d7f2061c7982117bf8da9c20614000",
    endpoint: "http://localhost:4002",
    environment: "staging_sandbox",
  },
};

/**
 * Gets the current application configuration
 * Uses environment variables or defaults (same as backend)
 */
export function getAppConfig(): AppConfig {
  // Determine transport from path (same logic as before)
  const currentPath = window.location.pathname;
  const transport = currentPath.includes("mcp") ? "mcp" : "http";

  const defaults = DEFAULT_AGENTS[transport];

  // Get from environment variables (Vite exposes them as import.meta.env.VITE_*)
  const env = (import.meta as any).env;

  if (transport === "http") {
    return {
      transport: "http",
      agentId: (env.VITE_HTTP_AGENT_ID as string) || defaults.id,
      agentEndpoint:
        (env.VITE_HTTP_AGENT_ENDPOINT as string) || defaults.endpoint,
      environment: (env.VITE_NVM_ENVIRONMENT as string) || defaults.environment,
    };
  } else {
    return {
      transport: "mcp",
      agentId: (env.VITE_MCP_AGENT_ID as string) || defaults.id,
      agentEndpoint:
        (env.VITE_MCP_AGENT_ENDPOINT as string) || defaults.endpoint,
      environment: (env.VITE_NVM_ENVIRONMENT as string) || defaults.environment,
      mcpClientId: env.VITE_MCP_CLIENT_ID as string | undefined,
    };
  }
}

/**
 * Gets the current transport mode
 * Can be used in both React components and regular functions
 */
export function getTransport(): "http" | "mcp" {
  return getAppConfig().transport;
}

/**
 * Hook to get the current app configuration
 */
export function useAppConfig(): AppConfig {
  return getAppConfig();
}
