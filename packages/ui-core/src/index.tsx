import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { HttpPaymentsClient } from "@app/payments-client";
import type { PaymentsClient } from "@app/domain";

function extractParamFromUrl(
  param: string,
  clean: boolean = true
): string | null {
  try {
    const url = new URL(window.location.href);
    const value = url.searchParams.get(param);
    if (value && clean) {
      url.searchParams.delete(param);
      const newUrl = `${url.origin}${url.pathname}${url.search}${url.hash}`;
      window.history.replaceState({}, document.title, newUrl);
    }
    return value;
  } catch {
    return null;
  }
}

/**
 * User state: apiKey, planId, credits, initialized.
 */
type UserState = {
  apiKey: string;
  setApiKey: (k: string) => void;
  planId: string;
  setPlanId: (p: string) => void;
  credits: number | null;
  setCredits: (c: number | null) => void;
  refreshCredits: () => Promise<void>;
  initialized: boolean;
};

const UserStateContext = createContext<UserState | undefined>(undefined);

export function useUserState(): UserState {
  const ctx = useContext(UserStateContext);
  if (!ctx)
    throw new Error("useUserState must be used within UserStateProvider");
  return ctx;
}

/**
 * Provider for user state compatible with existing apps (localStorage nvmApiKey/nvmPlanId).
 */
export function UserStateProvider({ children }: { children: React.ReactNode }) {
  const [apiKey, setApiKey] = useState(
    () => localStorage.getItem("nvmApiKey") || ""
  );
  const [planId, setPlanId] = useState(
    () => localStorage.getItem("nvmPlanId") || ""
  );
  const [credits, setCredits] = useState<number | null>(null);
  const [initialized, setInitialized] = useState(false);

  const payments: PaymentsClient = useMemo(
    () => new HttpPaymentsClient("/"),
    []
  );

  const refreshCredits = async () => {
    try {
      if (!apiKey) {
        setCredits(null);
        return;
      }
      const c = await payments.getUserCredits(apiKey, planId || "");
      setCredits(typeof c === "number" ? c : null);
    } catch {
      setCredits(null);
    }
  };

  useEffect(() => {
    (async () => {
      const apiFromUrl = extractParamFromUrl("nvm-api-key", true);
      if (apiFromUrl) {
        localStorage.setItem("nvmApiKey", apiFromUrl);
        setApiKey(apiFromUrl);
      }
      const planFromUrl = extractParamFromUrl("planId", true);
      if (planFromUrl) {
        localStorage.setItem("nvmPlanId", planFromUrl);
        setPlanId(planFromUrl);
      }
      await refreshCredits();
      setInitialized(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, planId]);

  const value = useMemo<UserState>(
    () => ({
      apiKey,
      setApiKey: (k: string) => {
        localStorage.setItem("nvmApiKey", k);
        setApiKey(k);
      },
      planId,
      setPlanId: (p: string) => {
        localStorage.setItem("nvmPlanId", p);
        setPlanId(p);
      },
      credits,
      setCredits,
      refreshCredits,
      initialized,
    }),
    [apiKey, planId, credits, initialized]
  );

  return (
    <UserStateContext.Provider value={value}>
      {children}
    </UserStateContext.Provider>
  );
}

export { HttpPaymentsClient };
export { Button } from "./components/ui/button";
