/**
 * Configuration system using environment variables
 * Uses centralized DEFAULT_AGENTS from @app/config
 */
import { DEFAULT_AGENTS } from "@app/config";

export interface AppConfig {
  transport: "http" | "mcp" | "n8n";
  agentId: string;
  agentEndpoint: string;
  environment: string;
  mcpClientId?: string;
}

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
  const transport: "http" | "mcp" | "n8n" =
    (fromWindow.transport as "http" | "mcp" | "n8n") ||
    (currentPath.includes("/n8n-agent") ? "n8n" :
     currentPath.includes("mcp") ? "mcp" : "http");

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

  if (transport === "n8n") {
    config = {
      transport: "n8n",
      agentId: fromWindow.agentId || defaults.id,
      agentEndpoint:
        fromWindow.agentEndpoint ||
        (env.VITE_N8N_WEBHOOK_URL as string) ||
        defaults.endpoint,
      environment:
        fromWindow.environment ||
        (env.VITE_NVM_ENVIRONMENT as string) ||
        defaults.environment,
    };
  } else if (transport === "http") {
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
export function getTransport(): "http" | "mcp" | "n8n" {
  return getAppConfig().transport;
}

/**
 * Hook to get the current app configuration
 */
export function useAppConfig(): AppConfig {
  return getAppConfig();
}
