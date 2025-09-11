import React, { createContext, useContext, useMemo } from "react";
import type { AgentClient } from "@app/domain";

const AgentContext = createContext<AgentClient | undefined>(undefined);

export function AgentProvider({
  client,
  children,
}: {
  client: AgentClient;
  children: React.ReactNode;
}) {
  const value = useMemo(() => client, [client]);
  return (
    <AgentContext.Provider value={value}>{children}</AgentContext.Provider>
  );
}

export function useAgent(): AgentClient {
  const ctx = useContext(AgentContext);
  if (!ctx) throw new Error("useAgent must be used within AgentProvider");
  return ctx;
}
