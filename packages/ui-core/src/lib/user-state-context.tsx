import React, { createContext, useContext, useState, useEffect } from "react";
import {
  extractApiKeyFromUrl,
  extractPlanIdFromUrl,
  getStoredPlanId,
  setStoredPlanId,
} from "./utils";
import { getWithTTL, setWithTTL } from "./storage-utils";
import { useAppConfig } from "./config";

/**
 * Context for the global user state (API Key and credits)
 * @module user-state-context
 */

interface UserStateContextType {
  apiKey: string;
  setApiKey: (key: string) => void;
  credits: number | null;
  setCredits: (c: number | null) => void;
  refreshCredits: () => Promise<number | null>;
  initialized: boolean;
  planId: string;
  setPlanId: (planId: string) => void;
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
  // Synchronous initialization
  const [apiKey, setApiKey] = useState(() => getWithTTL("nvmApiKey") || "");
  const [planId, setPlanId] = useState<string>(() => getStoredPlanId());
  const [credits, setCredits] = useState<number | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Refreshes the credits from the backend and returns the updated value
  const refreshCredits = async (): Promise<number | null> => {
    try {
      if (!apiKey) {
        setCredits(null);
        return null;
      }
      const planIdHeader = getStoredPlanId();
      const { transport } = useAppConfig();
      const resp = await fetch("/api/credit", {
        headers: {
          Authorization: `Bearer ${apiKey}`,
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

  // Refresh credits when the API Key changes
  useEffect(() => {
    (async () => {
      await refreshCredits();
      setInitialized(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  // On first mount, parse api key from return_url and store it
  useEffect(() => {
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

  // Listen for changes in localStorage to refresh credits after burning in other tabs
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === "nvmCreditsUpdated") {
        refreshCredits();
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  return (
    <UserStateContext.Provider
      value={{
        apiKey,
        setApiKey,
        credits,
        setCredits,
        refreshCredits,
        initialized,
        planId,
        setPlanId,
      }}
    >
      {children}
    </UserStateContext.Provider>
  );
}
