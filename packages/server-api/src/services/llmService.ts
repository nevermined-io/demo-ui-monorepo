import OpenAI from "openai";
import { loadPrompt } from "./promptService";

/**
 * Calls the LLM to decide what to do with a user message before sending to the agent.
 */
export async function llmRouter(
  message: string,
  history: any[],
  credits: number,
  basePromptOverride?: string
): Promise<{ action: string; message?: string }> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const basePrompt = basePromptOverride || loadPrompt("llm-router.prompt");
  const safeHistory = Array.isArray(history) ? history : [];
  const lastHistoryItem = safeHistory[safeHistory.length - 1];
  const priorHistory =
    lastHistoryItem &&
    typeof lastHistoryItem === "object" &&
    "content" in lastHistoryItem &&
    (lastHistoryItem as any).content === message
      ? safeHistory.slice(0, -1)
      : safeHistory;
  const systemContent = `${basePrompt}\n\nConversation history (for context):\n${JSON.stringify(priorHistory)}\n\nUser credits: ${credits}`;
  const completion = await openai.chat.completions.create({
    model: "gpt-4.1",
    messages: [
      {
        role: "system",
        content: systemContent,
      },
      { role: "user", content: message },
    ],
    max_tokens: 512,
    temperature: 0.2,
  });
  const text = completion.choices[0]?.message?.content?.trim() || "";
  let json: any;
  try {
    json = JSON.parse(text);
  } catch (e) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      json = JSON.parse(match[0]);
    } else {
      throw new Error("LLM did not return valid JSON");
    }
  }
  return json;
}

/**
 * Summarizes the user's request into a short, catchy title using the conversation history.
 */
export async function llmTitleSummarizer(
  history: { role: string; content: string }[]
): Promise<string> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const prompt = `You are generating a concise title for a financial advice/analysis conversation. Produce a short, clear title (6-10 words) that captures the user's financial goal or topic. Prefer including concrete assets/tickers (e.g., BTC, ETH, AAPL), markets (crypto, stocks), timeframe (short/long term) or action (analyze, compare, portfolio). Use Title Case, no emojis, and no trailing period.\n\nConversation history:\n${history
    .map(
      (msg) => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`
    )
    .join("\n")}\n\nTitle:`;
  const completion = await openai.chat.completions.create({
    model: "gpt-4.1",
    messages: [
      {
        role: "system",
        content:
          "You create short, professional titles for financial advice and market analysis chats. Favor assets, markets, timeframes, or actions. Use Title Case, avoid emojis and terminal punctuation.",
      },
      { role: "user", content: prompt },
    ],
    max_tokens: 16,
    temperature: 0.7,
  });
  return completion.choices[0]?.message?.content?.trim() || "Untitled";
}

/**
 * Synthesizes the user's intent from the conversation history using OpenAI.
 */
export async function llmIntentSynthesizer(
  history: { role: string; content: string }[],
  agentContext: string,
  toolsCatalog?: any
): Promise<string | { tool: string; args: Record<string, any> }> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const toolsSection = toolsCatalog
    ? `\n\nAvailable MCP tools (with input schemas):\n${JSON.stringify(
        toolsCatalog
      )}\n\nTask: Choose the most appropriate tool and produce ONLY a JSON object with this shape:\n{ "tool": "<tool_name>", "args": { /* keys and values matching the tool's inputSchema */ } }\n- Ensure args strictly follow the inputSchema types and required fields.\n- Do NOT add fields that are not in the schema.\n- If multiple tools apply, pick the most specific.\n- Do not include any explanations, only the JSON.`
    : `\n\nTask: Synthesize ONE clear English sentence that captures the user's intent suitable as an instruction for the agent above. Do not include system text, disclaimers, or extra commentary. Return only the sentence.`;

  const prompt = `Agent Context (domain and behavior):\n${agentContext}\n\nConversation history:\n${history
    .map(
      (msg) => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`
    )
    .join("\n")}${toolsSection}\n\nResponse:`;
  const completion = await openai.chat.completions.create({
    model: "gpt-4.1",
    messages: [
      {
        role: "system",
        content: toolsCatalog
          ? "You convert conversation intent into a strict JSON tool call that adheres to the provided MCP tools' input schemas. Return ONLY valid JSON with tool and args."
          : "You synthesize the user's intent from a conversation into a single, clear English sentence suitable as an instruction for the given agent context. Be concise and specific.",
      },
      { role: "user", content: prompt },
    ],
    max_tokens: 64,
    temperature: 0.3,
  });
  const text = completion.choices[0]?.message?.content?.trim() || "";
  if (toolsCatalog) {
    try {
      const obj = JSON.parse(text);
      if (obj && typeof obj.tool === "string" && typeof obj.args === "object") {
        return obj as { tool: string; args: Record<string, any> };
      }
    } catch {}
  }
  return text;
}
