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
 * Uses runtime config from window.__RUNTIME_CONFIG__ (injected by server) or
 * build-time Vite environment variables, with defaults as fallback
 */
export function getAppConfig(): AppConfig {
  // Try to get from window globals first (injected by server at runtime)
  const fromWindow = (globalThis as any)?.__RUNTIME_CONFIG__ || {};

  // Determine transport from path or window config
  const currentPath = window.location.pathname;
  const transport: "http" | "mcp" =
    (fromWindow.transport as "http" | "mcp") ||
    (currentPath.includes("mcp") ? "mcp" : "http");

  const defaults = DEFAULT_AGENTS[transport as keyof typeof DEFAULT_AGENTS];

  // Get from environment variables (Vite exposes them as import.meta.env.VITE_*)
  const env = (import.meta as any).env;

  // Debug logging
  console.group("🔧 [getAppConfig] Configuration Debug");
  console.log("📦 window.__RUNTIME_CONFIG__:", fromWindow);
  console.log("🔨 Vite env vars:", {
    VITE_HTTP_AGENT_ID: env.VITE_HTTP_AGENT_ID,
    VITE_HTTP_AGENT_ENDPOINT: env.VITE_HTTP_AGENT_ENDPOINT,
    VITE_MCP_AGENT_ID: env.VITE_MCP_AGENT_ID,
    VITE_MCP_AGENT_ENDPOINT: env.VITE_MCP_AGENT_ENDPOINT,
    VITE_NVM_ENVIRONMENT: env.VITE_NVM_ENVIRONMENT,
    VITE_MCP_CLIENT_ID: env.VITE_MCP_CLIENT_ID,
  });
  console.log("🎯 Transport:", transport);
  console.log("📋 Defaults:", defaults);

  let config: AppConfig;

  if (transport === "http") {
    config = {
      transport: "http",
      agentId:
        fromWindow.agentId ||
        (env.VITE_HTTP_AGENT_ID as string) ||
        defaults.id,
      agentEndpoint:
        fromWindow.agentEndpoint ||
        (env.VITE_HTTP_AGENT_ENDPOINT as string) ||
        defaults.endpoint,
      environment:
        fromWindow.environment ||
        (env.VITE_NVM_ENVIRONMENT as string) ||
        defaults.environment,
    };
  } else {
    config = {
      transport: "mcp",
      agentId:
        fromWindow.agentId ||
        (env.VITE_MCP_AGENT_ID as string) ||
        defaults.id,
      agentEndpoint:
        fromWindow.agentEndpoint ||
        (env.VITE_MCP_AGENT_ENDPOINT as string) ||
        defaults.endpoint,
      environment:
        fromWindow.environment ||
        (env.VITE_NVM_ENVIRONMENT as string) ||
        defaults.environment,
      mcpClientId: env.VITE_MCP_CLIENT_ID as string | undefined,
    };
  }

  console.log("✅ Final config:", config);
  console.log(
    "📍 Environment source:",
    fromWindow.environment
      ? "window.__RUNTIME_CONFIG__ (runtime)"
      : env.VITE_NVM_ENVIRONMENT
        ? "VITE_NVM_ENVIRONMENT (build-time)"
        : "defaults"
  );
  console.groupEnd();

  return config;
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
