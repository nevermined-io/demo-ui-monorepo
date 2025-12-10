/**
 * Funciones de acceso a la API para el chat.
 * @module chat-api
 */

/**
 * Get the current block number from the backend.
 * @returns Promise resolving to the current block number.
 */
import { getStoredPlanId } from "./utils";
import { getWithTTL } from "./storage-utils";
import { getTransport } from "./config";

/**
 * Builds the Plan ID header map using the namespaced storage key.
 * Includes backward compatibility by reading the legacy key if scoped is empty.
 * @returns {Record<string, string>} Header object (possibly empty).
 */
function getPlanIdHeader(): Record<string, string> {
  const planId: string = getStoredPlanId();
  return planId ? { "X-Plan-Id": planId } : {};
}

export async function getCurrentBlockNumber(): Promise<number> {
  const transport = getTransport();
  const response = await fetch("/api/latest-block", {
    method: "GET",
    headers: {
      ...getPlanIdHeader(),
      "X-Agent-Mode": transport,
    },
  });
  if (!response.ok) throw new Error("Failed to get current block number");
  const data = await response.json();
  return data.blockNumber;
}

/**
 * Send a message to the agent via backend proxy and return the response.
 * @param content The user message to send.
 * @param mcpAccessToken Optional OAuth access token for MCP agent
 * @returns Promise resolving to the agent response.
 */
export async function sendMessageToAgent(
  content: string,
  mcpAccessToken?: string | null
): Promise<{
  response: string;
  txHash?: string;
  credits?: number;
}> {
  const transport = getTransport();

  // Determine which credential to use based on transport
  let authToken = "";
  let planIdValue = "";

  if (transport === "http") {
    // HTTP Agent uses Nevermined API Key
    authToken = getWithTTL("nvmApiKey") || "";
    planIdValue = getStoredPlanId() || "";
  } else if (transport === "mcp") {
    // MCP Agent uses OAuth access token
    if (!mcpAccessToken) {
      throw new Error("MCP access token required for MCP agent");
    }
    authToken = mcpAccessToken;
    // No se necesita planId para MCP OAuth
    planIdValue = "";
  }

  const response = await fetch("/api/agent", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(planIdValue ? { "X-Plan-Id": planIdValue } : {}),
      "X-Agent-Mode": transport,
    },
    body: JSON.stringify({ input_query: content }),
  });
  if (!response.ok) throw new Error("Failed to send message to the agent");
  const data = await response.json();
  return {
    response: data.output,
    txHash: data.redemptionResult?.txHash,
    credits: data.redemptionResult?.creditsRedeemed,
  };
}

/**
 * Retrieve the task for a given task ID.
 * @param task_id The task ID to retrieve the task for.
 * @returns Promise resolving to the task.
 */
export async function getTask(task_id: string): Promise<any> {
  const apiKey = getWithTTL("nvmApiKey");
  const planId = getStoredPlanId() || "";
  const transport = getTransport();
  const response = await fetch(`/api/task?task_id=${task_id}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      ...(planId ? { "X-Plan-Id": planId } : {}),
      "X-Agent-Mode": transport,
    },
  });

  if (!response.ok) throw new Error("Failed to retrieve credits burned");
  const data = await response.json();
  return data;
}

/**
 * Retrieves the burn transaction for a given block number.
 * @param blockNumber The block number to start searching from.
 * @returns Promise resolving to burn transaction data (or null if not found).
 */
export async function getBurnTransaction(
  blockNumber: number
): Promise<any | null> {
  const apiKey = getWithTTL("nvmApiKey");
  const planId = getStoredPlanId() || "";
  const transport = getTransport();
  const burnTxResp = await fetch(`/api/find-burn-tx?fromBlock=${blockNumber}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      ...(planId ? { "X-Plan-Id": planId } : {}),
      "X-Agent-Mode": transport,
    },
  });
  if (!burnTxResp.ok) return null;
  return await burnTxResp.json();
}

/**
 * Updates the credits and gets the burn transaction for a given task ID.
 * @param taskId The task ID to update the credits for.
 * @returns Promise resolving to burn transaction data (or null if not found).
 */
export async function updateCreditsAndGetBurnTx(
  taskId: string
): Promise<any | null> {
  const blockNumber = await getCurrentBlockNumber();
  await getTask(taskId);
  const burnTxResp = await getBurnTransaction(blockNumber);
  if (!burnTxResp) return null;
  return burnTxResp;
}

/**
 * Lists available MCP tools via backend proxy.
 * @param mcpAccessToken OAuth access token for MCP agent
 * @returns Tools catalog including input schemas.
 */
export async function listMcpToolsClient(mcpAccessToken: string): Promise<any> {
  const transport = getTransport();
  const resp = await fetch("/api/mcp/tools", {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${mcpAccessToken}`,
      "X-Agent-Mode": transport,
    },
  });
  if (!resp.ok) throw new Error("Failed to list MCP tools");
  return await resp.json();
}

/**
 * Calls a specific MCP tool via backend proxy.
 * @param tool MCP tool name (e.g. "weather.today")
 * @param args Arguments object matching the tool's input schema
 * @param mcpAccessToken OAuth access token for MCP agent
 * @returns Normalized response with text output
 */
export async function callMcpToolClient(
  tool: string,
  args: Record<string, any>,
  mcpAccessToken: string
): Promise<{ response: string; content?: any }> {
  const transport = getTransport();
  const resp = await fetch("/api/mcp/tool", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${mcpAccessToken}`,
      "X-Agent-Mode": transport,
    },
    body: JSON.stringify({ tool, args }),
  });
  if (!resp.ok) throw new Error("Failed to call MCP tool");
  const data = await resp.json();
  return { response: data.output, content: data.content };
}
