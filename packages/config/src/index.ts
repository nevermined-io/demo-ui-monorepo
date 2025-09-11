export type RuntimeConfig = {
  transport: "http" | "mcp" | "a2a";
  environment?: string;
  agentId?: string;
};

/**
 * Loads runtime configuration exposed by the server.
 * Falls back to Vite env when available.
 */
export function loadRuntimeConfig(): RuntimeConfig {
  const fromWindow = (globalThis as any).__RUNTIME_CONFIG__ || {};
  const fromVite = (import.meta as any)?.env || {};
  const transport = fromWindow.transport || fromVite.VITE_TRANSPORT || "http";
  return {
    transport,
    environment: fromWindow.environment || fromVite.VITE_NVM_ENVIRONMENT,
    agentId: fromWindow.agentId || fromVite.VITE_AGENT_ID,
  } as RuntimeConfig;
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
