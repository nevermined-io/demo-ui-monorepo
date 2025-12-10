import OpenAI from "openai";

/**
 * Calls the LLM to decide what to do with a user message before sending to the agent.
 */
export async function llmRouter(
  message: string,
  history: any[],
  credits: number,
  isAuthenticated: boolean,
  basePrompt: string
): Promise<{ action: string; message?: string }> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // Inject current date into the prompt
  const currentDate = new Date();
  const currentMonth = String(currentDate.getMonth() + 1).padStart(2, "0"); // getMonth() returns 0-11, so add 1 and pad with zero
  const currentYear = currentDate.getFullYear();

  // Replace placeholder with actual current month and year in code format
  basePrompt = basePrompt.replace(
    /{CURRENT_DATE}/g,
    `\`${currentMonth}/${currentYear}\``
  );

  const safeHistory = Array.isArray(history) ? history : [];
  const lastHistoryItem = safeHistory[safeHistory.length - 1];
  const priorHistory =
    lastHistoryItem &&
    typeof lastHistoryItem === "object" &&
    "content" in lastHistoryItem &&
    (lastHistoryItem as any).content === message
      ? safeHistory.slice(0, -1)
      : safeHistory;

  // Build system content with authentication status
  const authStatus = isAuthenticated ? "authenticated" : "not_authenticated";
  const systemContent = `${basePrompt}

User authentication: ${authStatus}
User credits: ${credits}

Conversation history (for context):
${JSON.stringify(priorHistory)}`;

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
  let text = completion.choices[0]?.message?.content?.trim() || "";

  // Replace placeholder with actual current month and year in code format just in case
  text = text.replace(
    /\*\*INSERT_CURRENT_DATE\*\*/g,
    `\`${currentMonth}/${currentYear}\``
  );
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
  const prompt = `You are generating a concise title for a conversation. Produce a short, clear title (3-8 words) that captures the main topic or subject of the conversation. Include key entities, locations, or concepts mentioned (e.g., "Weather in Madrid", "Python Tutorial", "Recipe for Pasta"). Use Title Case, no emojis, and no trailing period.\n\nConversation history:\n${history
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
          "You create short, professional titles for conversations on any topic. Capture the main subject, key entities, or central theme. Use Title Case, avoid emojis and terminal punctuation.",
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
