export type AgentCapabilities = {
  tools?: boolean;
  tasks?: boolean;
};

export interface AgentClient {
  createTask(input: string | { tool: string; args: Record<string, any> }): Promise<{ output: string }>;
  getTask?(taskId: string): Promise<any>;
  listTools?(): Promise<any[]>;
  callTool?(tool: string, args: Record<string, any>): Promise<{ output: string; content?: any }>;
  getCapabilities(): AgentCapabilities;
}

export interface PaymentsClient {
  getUserCredits(apiKey: string, planId: string): Promise<number>;
  getPlanCost(apiKey: string, planId: string): Promise<{ planPrice: string; planCredits: number }>;
  orderPlanCredits(planId: string, apiKey: string): Promise<{ success: boolean; txHash?: string; credits?: string; message: string }>;
  redeemCredits(planId: string, amount: string, apiKey: string): Promise<{ success: boolean; txHash?: string; message: string }>;
}

export interface PromptProvider {
  getRouterPrompt(context?: Record<string, string>): Promise<string>;
  getAgentPrompt(context?: Record<string, string>): Promise<string>;
}
