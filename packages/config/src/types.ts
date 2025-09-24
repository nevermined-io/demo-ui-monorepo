/**
 * Agent configuration interface
 */
export interface AgentConfig {
  id: string;
  name: string;
  transport: "http" | "mcp";
  endpoint: string;
  environment: string;
}

/**
 * Runtime configuration interface
 */
export interface RuntimeConfig {
  transport: "http" | "mcp";
  agent: AgentConfig;
  environment: string;
}

/**
 * Environment variables interface
 */
export interface EnvConfig {
  // HTTP Agent
  HTTP_AGENT_ID?: string;
  HTTP_AGENT_NAME?: string;
  HTTP_AGENT_ENDPOINT?: string;

  // MCP Agent
  MCP_AGENT_ID?: string;
  MCP_AGENT_NAME?: string;
  MCP_AGENT_ENDPOINT?: string;

  // Common
  NVM_ENVIRONMENT?: string;
  TRANSPORT?: "http" | "mcp";
}
