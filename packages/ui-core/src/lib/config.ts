/**
 * Dynamic configuration system for runtime environment variables
 * This allows changing configuration without rebuilding the application
 */

export interface AppConfig {
  transport: "http" | "mcp";
  agentId: string;
  agentEndpoint: string;
  environment: string;
}

/**
 * Loads the runtime configuration from the server
 * This function dynamically loads /config.js and executes it
 */
export async function loadRuntimeConfig(): Promise<void> {
  try {
    // Create a script element to load the config
    const script = document.createElement("script");
    script.src = "/config.js";
    script.async = true;

    // Return a promise that resolves when the script loads
    return new Promise((resolve, reject) => {
      script.onload = () => {
        resolve();
      };
      script.onerror = () => {
        console.warn(
          "[AppConfig] Failed to load runtime configuration from /config.js"
        );
        reject(new Error("Failed to load runtime configuration"));
      };

      // Append the script to the document head
      document.head.appendChild(script);
    });
  } catch (error) {
    console.error("[AppConfig] Error loading runtime configuration:", error);
    throw error;
  }
}

/**
 * Gets the current application configuration
 * First checks for runtime config, then falls back to build-time env vars
 */
export function getAppConfig(): AppConfig {
  const runtimeConfig = (window as any).__RUNTIME_CONFIG__;

  if (runtimeConfig) {
    return {
      transport: runtimeConfig.transport || "http",
      agentId: runtimeConfig.agentId || "",
      agentEndpoint: runtimeConfig.agentEndpoint || "",
      environment: runtimeConfig.environment || "",
    };
  }

  const currentPath = window.location.pathname;
  const transport = currentPath.startsWith("/mcp-agent") ? "mcp" : "http";

  return {
    transport,
    agentId: "",
    agentEndpoint: "",
    environment: "",
  };
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
