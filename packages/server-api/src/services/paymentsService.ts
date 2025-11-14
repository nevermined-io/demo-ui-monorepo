import { Payments, type EnvironmentName } from "@nevermined-io/payments";
import { PlanDDOHelper } from "./planDDOHelper.js";
import {
  hasSufficientERC20Balance,
  findMintEvent,
  getCurrentBlockNumber,
  findBurnEvent,
} from "./blockchainService.js";
import { Client as McpClient } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

/**
 * Calls the agent over HTTP using the direct agent endpoint and an access token.
 * Only valid when the transport is "http".
 * @param inputQuery Synthesized intent to send to the agent.
 * @param nvmApiKey Nevermined API key.
 * @param planId Plan DID.
 * @returns Agent response payload.
 */
/**
 * Calls the agent over HTTP using the direct agent endpoint and an access token.
 * Only valid for the Simple Agent app context.
 * @param inputQuery Synthesized intent to send to the HTTP agent.
 * @param nvmApiKey Nevermined API key.
 * @param planId Plan DID.
 * @returns Agent response payload.
 */
export async function createTaskHttp(
  inputQuery: string,
  nvmApiKey: string,
  planId: string,
  agentEndpoint: string,
  agentId: string,
  environment: string
): Promise<any> {
  const { accessToken } = await getAgentAccessToken(
    nvmApiKey,
    planId,
    agentId,
    environment
  );
  const response = await fetch(agentEndpoint, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ input_query: inputQuery }),
  });
  if (!response.ok) {
    throw new Error(
      `Agent request failed: ${response.status} ${response.statusText}`
    );
  }
  return await response.json();
}

/**
 * Calls the agent using MCP with either a plain text query mapped to a tool call
 * or an explicit tool call. Only valid for the MCP Agent app context.
 * @param input Plain string (mapped to default tool) or explicit { tool, args }.
 * @param nvmApiKey Nevermined API key.
 * @param planId Plan DID.
 * @returns Agent response simplified to { output }.
 */
export async function createTaskMcp(
  input: string | { tool: string; args: Record<string, any> },
  nvmApiKey: string,
  planId: string,
  httpEndpoint: string,
  agentId: string,
  environment: string
): Promise<{ output: string } & Record<string, any>> {
  const { accessToken } = await getAgentAccessToken(
    nvmApiKey,
    planId,
    agentId,
    environment
  );
  const transport = new StreamableHTTPClientTransport(new URL(httpEndpoint), {
    requestInit: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const client = new McpClient({
    name: "weather-mcp-client",
    version: "0.1.0",
  });
  try {
    await client.connect(transport);
    let toolName: string;
    let toolArgs: Record<string, any> = {};
    if (
      typeof input === "object" &&
      input &&
      typeof (input as any).tool === "string"
    ) {
      toolName = (input as any).tool;
      toolArgs = (input as any).args || {};
    } else {
      toolName =
        process.env.MCP_TOOL ||
        (process.env.RAW ? "weather.today.raw" : "weather.today");
      const inputQuery = String(input || "");
      toolArgs = inputQuery ? { city: inputQuery } : {};
    }
    const result: any = await client.callTool({
      name: toolName,
      arguments: toolArgs,
    });
    let outputText = "";
    if (Array.isArray(result?.content)) {
      const textItem = result.content.find(
        (c: any) => c && typeof c === "object" && c.type === "text"
      );
      if (textItem && typeof textItem.text !== "undefined") {
        outputText =
          typeof textItem.text === "string"
            ? textItem.text
            : JSON.stringify(textItem.text);
      }
    }
    if (!outputText)
      outputText = typeof result === "string" ? result : JSON.stringify(result);
    const metadata =
      result && typeof result === "object"
        ? (result as any).metadata
        : undefined;
    if (metadata && typeof metadata === "object") {
      return { output: outputText, redemptionResult: metadata };
    }
    return { output: outputText, redemptionResult: {} };
  } catch (error) {
    console.error("Error calling MCP tool:", error);
    throw error;
  } finally {
    try {
      await client.close();
    } catch {}
  }
}

/** Initializes the Nevermined Payments library. */
export function initializePayments(
  nvmApiKey: string,
  environment: string
): Payments {
  const payments = Payments.getInstance({
    nvmApiKey,
    environment: environment as EnvironmentName,
  });
  if (!payments.isLoggedIn) {
    throw new Error("Failed to log in to the Nevermined Payments Library");
  }
  return payments;
}

/** Gets the available credits for a plan. */
export async function getUserCredits(
  nvmApiKey: string,
  planId: string
): Promise<number> {
  const environment = process.env.NVM_ENVIRONMENT || "sandbox";
  if (!nvmApiKey || !planId) {
    throw new Error("Missing Nevermined API key or plan DID");
  }
  const payments = initializePayments(nvmApiKey, environment);
  const balanceResult = await payments.plans.getPlanBalance(planId);
  const credit = parseInt(balanceResult.balance.toString());
  return credit;
}

/** Gets the agent access token for direct calls. */
export async function getAgentAccessToken(
  nvmApiKey: string,
  planId: string,
  agentId: string,
  environment: string
): Promise<{ accessToken: string; agentId: string }> {
  if (!nvmApiKey || !planId || !agentId || !environment) {
    throw new Error(
      "Missing config: nvmApiKey, planId, agentId, or environment"
    );
  }
  const payments = initializePayments(nvmApiKey, environment);
  const agentAccessParams = await payments.agents.getAgentAccessToken(
    planId,
    agentId
  );
  return { accessToken: agentAccessParams.accessToken, agentId };
}

/**
 * Calls the agent using the selected transport strictly without fallbacks.
 * @param input String (HTTP: synthesized intent) or tool call (MCP).
 * @param nvmApiKey Nevermined API key.
 * @param planId Plan DID.
 * @param mode Transport mode: "http" for Simple Agent, "mcp" for MCP Agent.
 */
export async function createTask(
  input: string | { tool: string; args: Record<string, any> },
  nvmApiKey: string,
  planId: string,
  mode: "http" | "mcp",
  httpEndpoint: string,
  agentId: string,
  environment: string
): Promise<any> {
  if (mode === "http") {
    if (typeof input !== "string") {
      throw new Error(
        "HTTP agent expects a string input_query. Provide synthesized intent as string."
      );
    }
    return await createTaskHttp(
      input,
      nvmApiKey,
      planId,
      httpEndpoint,
      agentId,
      environment
    );
  }
  return await createTaskMcp(
    input,
    nvmApiKey,
    planId,
    httpEndpoint,
    agentId,
    environment
  );
}

/** Lists available MCP tools. */
export async function listMcpTools(
  nvmApiKey: string,
  planId: string,
  agentId: string,
  environment: string,
  mcpEndpoint?: string
): Promise<any> {
  const endpoint =
    mcpEndpoint || process.env.MCP_ENDPOINT || "http://localhost:3001/mcp";
  const { accessToken } = await getAgentAccessToken(
    nvmApiKey,
    planId,
    agentId,
    environment
  );
  const transport = new StreamableHTTPClientTransport(new URL(endpoint), {
    requestInit: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const client = new McpClient({
    name: "weather-mcp-client",
    version: "0.1.0",
  });
  try {
    await client.connect(transport);
    const tools = await client.listTools();
    return tools;
  } catch (error) {
    console.error("Error listing MCP tools:", error);
    return [];
  } finally {
    try {
      await client.close();
    } catch {}
  }
}

/** Calls a specific MCP tool with arbitrary arguments. */
export async function callMcpTool(
  toolName: string,
  args: Record<string, any>,
  nvmApiKey: string,
  planId: string,
  agentId: string,
  environment: string,
  mcpEndpoint?: string
): Promise<{ output: string; content?: any }> {
  const endpoint =
    mcpEndpoint || process.env.MCP_ENDPOINT || "http://localhost:3001/mcp";
  const { accessToken } = await getAgentAccessToken(
    nvmApiKey,
    planId,
    agentId,
    environment
  );
  const transport = new StreamableHTTPClientTransport(new URL(endpoint), {
    requestInit: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const client = new McpClient({
    name: "weather-mcp-client",
    version: "0.1.0",
  });
  try {
    await client.connect(transport);
    const result: any = await client.callTool({
      name: toolName,
      arguments: args,
    });
    let outputText = "";
    if (Array.isArray(result?.content)) {
      const textItem = result.content.find(
        (c: any) => c && typeof c === "object" && c.type === "text"
      );
      if (textItem && typeof textItem.text !== "undefined") {
        outputText =
          typeof textItem.text === "string"
            ? textItem.text
            : JSON.stringify(textItem.text);
      }
    }
    if (!outputText)
      outputText = typeof result === "string" ? result : JSON.stringify(result);
    return { output: outputText, content: result?.content };
  } finally {
    try {
      await client.close();
    } catch {}
  }
}

/** Orders credits for a plan and returns mint transaction details. */
export async function orderPlanCredits(
  planId: string,
  nvmApiKey: string
): Promise<{
  success: boolean;
  txHash?: string | undefined;
  credits?: string | undefined;
  message: string;
}> {
  const environment = process.env.NVM_ENVIRONMENT;
  if (!nvmApiKey || !environment) {
    throw new Error("Missing Nevermined API key or environment");
  }
  const payments = initializePayments(nvmApiKey, environment);
  const planHelper = new PlanDDOHelper(payments, planId);
  await planHelper.loadDDO();
  const planPrice = await planHelper.getPlanPrice();
  const tokenAddress = await planHelper.getTokenAddress();
  if (!tokenAddress)
    return { success: false, message: "Token address not found in plan DDO" };
  const ourWallet = payments.getAccountAddress() || "";
  if (!ourWallet)
    return { success: false, message: "Wallet address not found" };
  const hasBalance = await hasSufficientERC20Balance(
    tokenAddress,
    ourWallet,
    planPrice
  );
  if (!hasBalance) {
    return {
      success: false,
      message: "Insufficient USDC balance to purchase credits",
    };
  }
  const fromBlock = await getCurrentBlockNumber();
  try {
    const orderResult = await payments.plans.orderPlan(planId);
    if (!orderResult.success) {
      return { success: false, message: "Failed to order credits for plan" };
    }
  } catch (error: any) {
    console.error("Error ordering plan credits:", error);
    return {
      success: false,
      message: error.message || "Failed to order credits for plan",
    };
  }
  const contractAddress = await planHelper.get1155ContractAddress();
  const tokenId = await planHelper.getTokenId();
  const mintEvent = contractAddress
    ? await findMintEvent(contractAddress, ourWallet, tokenId, fromBlock)
    : null;
  if (mintEvent) {
    return {
      success: true,
      txHash: mintEvent.txHash,
      credits: mintEvent.value,
      message: `Credits purchased and added to your balance. (tx: ${mintEvent.txHash})`,
    };
  }
  return {
    success: true,
    txHash: undefined,
    credits: undefined,
    message: "Credits purchased and added to your balance.",
  };
}

/** Gets burn tx info from a given block. */
export async function getBurnTransactionInfo(
  fromBlock: number,
  nvmApiKey: string,
  planId: string
): Promise<{ txHash: string; credits: string; planId: string } | null> {
  const environment = process.env.NVM_ENVIRONMENT || "staging_sandbox";
  if (!nvmApiKey || !planId) throw new Error("Missing config");
  const payments = initializePayments(nvmApiKey, environment);
  const planHelper = new PlanDDOHelper(payments, planId);
  await planHelper.loadDDO();
  const contractAddress = await planHelper.get1155ContractAddress();
  const tokenId = await planHelper.getTokenId();
  const ourWallet = payments.getAccountAddress() || "";
  if (!contractAddress || !tokenId || !ourWallet) {
    throw new Error("Missing contract, tokenId or wallet");
  }
  let burnEvent = null;
  let attempts = 0;
  while (attempts < 10 && !burnEvent) {
    burnEvent = await findBurnEvent(
      contractAddress,
      ourWallet,
      tokenId,
      fromBlock
    );
    if (!burnEvent) {
      attempts++;
      if (attempts < 10)
        await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
  if (burnEvent) {
    return { txHash: burnEvent.txHash, credits: burnEvent.value, planId };
  }
  return null;
}

/** Gets task details - MCP flow is synchronous, return passthrough. */
export async function getTask(
  task_id: string,
  _nvmApiKey: string,
  _planId: string
): Promise<any> {
  return { ok: true, task_id };
}

/** Gets the plan price and credits. */
export async function getPlanCost(
  nvmApiKey: string,
  planId: string
): Promise<{ planPrice: string; planCredits: number }> {
  const environment = process.env.NVM_ENVIRONMENT || "staging_sandbox";
  if (!nvmApiKey || !planId) throw new Error("Missing config");
  const payments = initializePayments(nvmApiKey, environment);
  const planHelper = new PlanDDOHelper(payments, planId);
  await planHelper.loadDDO();
  const planPrice = await planHelper.getPlanPrice();
  const planCredits = await planHelper.getPlanCredits();
  return { planPrice, planCredits };
}

/** Redeems a given amount of credits. */
export async function redeemCredits(
  planId: string,
  creditsAmount: string,
  nvmApiKey: string
): Promise<{ success: boolean; txHash?: string | undefined; message: string }> {
  const environment = process.env.NVM_ENVIRONMENT || "staging_sandbox";
  const agentId = process.env.AGENT_DID;
  if (!nvmApiKey || !planId || !agentId) {
    throw new Error("Missing Nevermined API key or plan DID");
  }
  const payments = initializePayments(nvmApiKey, environment);
  const redeemFrom = payments.getAccountAddress();
  if (!redeemFrom) throw new Error("Wallet address not found");
  try {
    const result = await payments.plans.redeemCredits(
      agentId,
      planId,
      redeemFrom as `0x${string}`,
      creditsAmount
    );
    if (result && result.success) {
      return {
        success: true,
        txHash: result.txHash,
        message: result.message || "Credits redeemed successfully.",
      };
    } else {
      return {
        success: false,
        message: result?.message || "Failed to redeem credits.",
      };
    }
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || "Error redeeming credits.",
    };
  }
}
