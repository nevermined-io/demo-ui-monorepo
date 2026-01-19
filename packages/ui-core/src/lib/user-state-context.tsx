import React, { createContext, useContext, useState, useEffect } from "react";
import {
  extractApiKeyFromUrl,
  extractPlanIdFromUrl,
  getStoredPlanId,
  setStoredPlanId,
} from "./utils";
import { getWithTTL, setWithTTL } from "./storage-utils";
import { useAppConfig } from "./config";
import { McpOAuthClient } from "./mcp-oauth-client";

/**
 * Context for the global user state
 * Supports both HTTP (Nevermined) and MCP (OAuth) authentication
 * @module user-state-context
 */

interface UserStateContextType {
  // HTTP Agent (Nevermined flow)
  apiKey: string;
  setApiKey: (key: string) => void;
  planId: string;
  setPlanId: (planId: string) => void;

  // MCP Agent (OAuth flow)
  mcpOAuthClient: McpOAuthClient | null;
  mcpAccessToken: string | null;
  isMcpAuthenticated: boolean;
  startMcpAuth: () => Promise<void>;
  prepareAuthUrl: () => Promise<string>;

  // Shared
  credits: number | null;
  setCredits: (c: number | null) => void;
  refreshCredits: () => Promise<number | null>;
  initialized: boolean;
}

const UserStateContext = createContext<UserStateContextType | undefined>(
  undefined
);

export function useUserState() {
  const ctx = useContext(UserStateContext);
  if (!ctx)
    throw new Error("useUserState must be used within UserStateProvider");
  return ctx;
}

export function UserStateProvider({ children }: { children: React.ReactNode }) {
  const { transport } = useAppConfig();
  const isMcpAgent = transport === "mcp";

  // HTTP Agent state (Nevermined flow)
  const [apiKey, setApiKey] = useState(() => getWithTTL("nvmApiKey") || "");
  const [planId, setPlanId] = useState<string>(() => getStoredPlanId());

  // MCP Agent state (OAuth flow)
  const [mcpOAuthClient, setMcpOAuthClient] = useState<McpOAuthClient | null>(
    null
  );
  const [mcpAccessToken, setMcpAccessToken] = useState<string | null>(null);
  const [isMcpAuthenticated, setIsMcpAuthenticated] = useState(false);

  // Shared state
  const [credits, setCredits] = useState<number | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Refreshes the credits from the backend and returns the updated value
  const refreshCredits = async (): Promise<number | null> => {
    try {
      const { transport } = useAppConfig();

      // Determine which credential to use based on transport
      let authToken = "";
      let planIdHeader = "";
      
      if (transport === "http") {
        if (!apiKey) {
          setCredits(null);
          return null;
        }
        authToken = apiKey;
        planIdHeader = getStoredPlanId();
      } else if (transport === "mcp") {
        if (!mcpAccessToken) {
          setCredits(null);
          return null;
        }
        authToken = mcpAccessToken;
        // For MCP, the backend will decode the token to extract planId
        // No need to send X-Plan-Id header
        planIdHeader = "";
      }

      const resp = await fetch("/api/credit", {
        headers: {
          Authorization: `Bearer ${authToken}`,
          ...(planIdHeader ? { "X-Plan-Id": planIdHeader } : {}),
          "X-Agent-Mode": transport,
        },
      });
      if (!resp.ok) throw new Error();
      const data = await resp.json();
      const creditValue = typeof data.credit === "number" ? data.credit : null;
      setCredits(creditValue);
      return creditValue;
    } catch {
      setCredits(null);
      return null;
    }
  };

  // Initialize MCP OAuth client (only for MCP transport)
  useEffect(() => {
    if (isMcpAgent && !mcpOAuthClient) {
      const { agentEndpoint } = useAppConfig();
      const redirectUri = `${window.location.origin}${window.location.pathname}`;

      if (!agentEndpoint) {
        console.error("[UserStateProvider] MCP agent endpoint not configured");
        return;
      }

      const client = new McpOAuthClient(agentEndpoint, redirectUri);
      setMcpOAuthClient(client);
    }
  }, [isMcpAgent, mcpOAuthClient]);

  // Initialize MCP OAuth flow (only for MCP transport)
  useEffect(() => {
    if (!isMcpAgent || !mcpOAuthClient) {
      return;
    }

    (async () => {
      try {
        // Check if there's an OAuth code in the URL (callback)
        const hasCode = new URLSearchParams(window.location.search).has("code");
        if (hasCode) {
          console.log(
            "[UserStateProvider] OAuth callback detected, completing flow"
          );
          await mcpOAuthClient.completeAuthorizationFlow();

          // Dispatch event to resume pending chat action
          const event = new CustomEvent("oauth-callback-complete");
          window.dispatchEvent(event);
        }

        // Check if there's a valid token
        const isAuth = mcpOAuthClient.isAuthenticated();
        setIsMcpAuthenticated(isAuth);

        if (isAuth) {
          const token = await mcpOAuthClient.getAccessToken();
          setMcpAccessToken(token);
          console.log("[UserStateProvider] MCP OAuth authenticated");
        } else {
          console.log("[UserStateProvider] MCP OAuth not authenticated");
        }

        await refreshCredits();
        setInitialized(true);
      } catch (error) {
        console.error(
          "[UserStateProvider] MCP OAuth initialization failed:",
          error
        );
        setIsMcpAuthenticated(false);
        setInitialized(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mcpOAuthClient]);

  // Initialize HTTP Nevermined flow (only for HTTP transport)
  useEffect(() => {
    if (isMcpAgent) {
      return; // Skip HTTP initialization for MCP agent
    }

    (async () => {
      await refreshCredits();
      setInitialized(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  // On first mount, parse api key from return_url and store it (HTTP only)
  useEffect(() => {
    if (isMcpAgent) {
      return; // Skip for MCP agent
    }

    const parsedKey = extractApiKeyFromUrl(true);
    if (parsedKey) {
      setWithTTL("nvmApiKey", parsedKey);
      setApiKey(parsedKey);
      console.log("🔑 Extracted API Key from URL:", parsedKey);

      // Dispatch event to resume pending chat action after checkout return
      const event = new CustomEvent("checkout-return");
      window.dispatchEvent(event);
    }
    const parsedPlan = extractPlanIdFromUrl(true);
    if (parsedPlan) {
      setStoredPlanId(parsedPlan);
      setPlanId(parsedPlan);
    }
    // We don't include setters in deps to avoid loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for changes in localStorage to refresh credits (HTTP only)
  useEffect(() => {
    if (isMcpAgent) {
      return;
    }

    const handler = (e: StorageEvent) => {
      if (e.key === "nvmCreditsUpdated") {
        refreshCredits();
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  /**
   * Starts MCP OAuth authorization flow (redirects immediately)
   */
  const startMcpAuth = async (): Promise<void> => {
    if (!mcpOAuthClient) {
      throw new Error("MCP OAuth client not initialized");
    }

    try {
      await mcpOAuthClient.discover();
      await mcpOAuthClient.registerClient();
      await mcpOAuthClient.startAuthorizationFlow();
    } catch (error) {
      console.error("[UserStateProvider] Failed to start MCP auth:", error);
      throw error;
    }
  };

  /**
   * Prepares OAuth authorization URL without redirecting
   * Returns the URL to use in a "Connect" button
   */
  const prepareAuthUrl = async (): Promise<string> => {
    if (!mcpOAuthClient) {
      throw new Error("MCP OAuth client not initialized");
    }

    try {
      return await mcpOAuthClient.prepareAuthorizationUrl();
    } catch (error) {
      console.error("[UserStateProvider] Failed to prepare auth URL:", error);
      throw error;
    }
  };

  return (
    <UserStateContext.Provider
      value={{
        // HTTP Agent
        apiKey,
        setApiKey,
        planId,
        setPlanId,

        // MCP Agent
        mcpOAuthClient,
        mcpAccessToken,
        isMcpAuthenticated,
        startMcpAuth,
        prepareAuthUrl,

        // Shared
        credits,
        setCredits,
        refreshCredits,
        initialized,
      }}
    >
      {children}
    </UserStateContext.Provider>
  );
}
