import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { getTransport } from "./config";
import { getWithTTL, setWithTTL } from "./storage-utils";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Builds a Nevermined Checkout URL for a given agent id.
 * @param {string} agentId - The Nevermined agent identifier used by checkout.
 * @param {{ returnApiKey?: boolean, returnUrl?: string }} options - Checkout options.
 * @returns {string} The absolute checkout URL to redirect the user.
 */
export function buildNeverminedCheckoutUrl(
  agentId: string,
  options: { returnApiKey?: boolean; returnUrl?: string } = {}
): string {
  // Get environment from Vite env vars
  const env = (import.meta as any).env;
  const environment = (env.VITE_NVM_ENVIRONMENT as string) || "sandbox";
  const baseUrl =
    environment === "sandbox"
      ? "https://nevermined.app"
      : "https://nevermined.dev";
  const base = `${baseUrl}/checkout/${encodeURIComponent(agentId)}`;
  const params = new URLSearchParams();
  if (options.returnApiKey) params.set("export", "nvm-api-key");
  const returnUrl = options.returnUrl || getDefaultReturnUrl();
  if (returnUrl) params.set("returnUrl", returnUrl);
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

/**
 * Returns a sensible default return URL (origin + pathname) without query or hash.
 * @returns {string}
 */
export function getDefaultReturnUrl(): string {
  try {
    const { origin, pathname } = window.location;
    return `${origin}${pathname}`;
  } catch {
    return "";
  }
}

/**
 * Extracts an API Key from the current URL query parameters and optionally cleans it.
 * Accepts multiple common parameter names: `api_key`, `nvmApiKey`.
 * @param {boolean} cleanUrl - Whether to remove the api_key parameter from the URL bar.
 * @returns {string | null} The extracted API Key or null if not present.
 */
export function extractApiKeyFromUrl(cleanUrl: boolean = true): string | null {
  try {
    const url = new URL(window.location.href);
    const apiKey = url.searchParams.get("nvm-api-key");
    if (apiKey && cleanUrl) {
      url.searchParams.delete("nvm-api-key");
      const newUrl = `${url.origin}${url.pathname}${url.search}${url.hash}`;
      window.history.replaceState({}, document.title, newUrl);
    }
    return apiKey;
  } catch {
    return null;
  }
}

/**
 * Extracts the Plan ID from the URL parameter 'planId'.
 * @param {boolean} [cleanUrl=true] - Whether to remove the parameter from the URL.
 * @returns {string | null}
 */
export function extractPlanIdFromUrl(cleanUrl: boolean = true): string | null {
  try {
    const url = new URL(window.location.href);
    const value = url.searchParams.get("planId");
    if (value && cleanUrl) {
      url.searchParams.delete("planId");
      const newUrl = `${url.origin}${url.pathname}${url.search}${url.hash}`;
      window.history.replaceState({}, document.title, newUrl);
    }
    return value;
  } catch {
    return null;
  }
}

/**
 * Builds a local link to this same page that encodes checkout intent in query params.
 * The app can detect these params and redirect to Nevermined checkout.
 * @param {string} agentId - The agent identifier.
 * @param {{ returnApiKey?: boolean }} options - Whether to request API key on return.
 * @returns {string} The local URL pointing to this page with checkout params.
 */
export function buildLocalCheckoutLink(
  agentId: string,
  options: { returnApiKey?: boolean } = {}
): string {
  try {
    const { origin, pathname } = window.location;
    const url = new URL(`${origin}${pathname}`);
    url.searchParams.set("nvm_checkout", "1");
    if (agentId) url.searchParams.set("agent_id", agentId);
    if (options.returnApiKey) url.searchParams.set("return_api_key", "1");
    return url.toString();
  } catch {
    return "";
  }
}

/**
 * Returns the localStorage key for storing the Plan ID, namespaced by transport (agent type).
 * Falls back to legacy key "nvmPlanId" if transport is unavailable.
 * @returns {string} The localStorage key to use for Plan ID persistence.
 */
export function getPlanIdStorageKey(): string {
  try {
    // Get transport from environment variables (same as other parts of the codebase)
    const transport = getTransport();
    return `nvmPlanId_${transport}`;
  } catch (error) {
    console.warn("[getPlanIdStorageKey] Error getting transport:", error);
    return "nvmPlanId_http";
  }
}

/**
 * Reads the stored Plan ID from localStorage using a transport-scoped key,
 * with a backward-compatible fallback to the legacy unscoped key.
 * @returns {string} The stored Plan ID or an empty string if not present.
 */
export function getStoredPlanId(): string {
  try {
    const scopedKey = getPlanIdStorageKey();
    const scopedValue = getWithTTL(scopedKey);
    return scopedValue || "";
  } catch (error) {
    console.warn("[getStoredPlanId] Error:", error);
    return "";
  }
}

/**
 * Persists the given Plan ID to localStorage using a transport-scoped key.
 * Does not write to the legacy key to avoid cross-transport collisions.
 * @param {string} planId - The plan DID to store.
 * @returns {void}
 */
export function setStoredPlanId(planId: string): void {
  try {
    const scopedKey = getPlanIdStorageKey();
    setWithTTL(scopedKey, planId);
  } catch (error) {
    console.warn("[setStoredPlanId] Error:", error);
  }
}
