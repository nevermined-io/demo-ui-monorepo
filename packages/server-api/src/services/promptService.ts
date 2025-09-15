import { readFileSync, statSync } from "fs";
import { join } from "path";

interface CachedPrompt {
  content: string;
  lastModified: number;
}

const promptCache: Map<string, CachedPrompt> = new Map();

/** Loads a prompt from an external file with caching. */
export function loadPrompt(filename: string): string {
  try {
    const promptPath = join(process.cwd(), filename);
    const stats = statSync(promptPath);
    const cached = promptCache.get(filename);
    if (cached && stats.mtime.getTime() <= cached.lastModified) {
      return cached.content;
    }
    const prompt = readFileSync(promptPath, "utf-8");
    promptCache.set(filename, {
      content: prompt,
      lastModified: stats.mtime.getTime(),
    });
    return prompt;
  } catch (error) {
    if (filename === "agent.prompt") {
      return `You are a helpful AI assistant. Please provide accurate and helpful responses to user queries.`;
    } else if (filename === "llm-router.prompt") {
      return `You are an assistant that routes user messages. If in doubt, respond with 'no_action'.`;
    }
    return `Default prompt for ${filename}.`;
  }
}

export function loadAgentPrompt(): string {
  return loadPrompt("agent.prompt");
}

export function loadLLMRouterPrompt(): string {
  return loadPrompt("llm-router.prompt");
}

export function reloadPrompt(filename: string): string {
  promptCache.delete(filename);
  return loadPrompt(filename);
}

export function reloadAgentPrompt(): string {
  return reloadPrompt("agent.prompt");
}

export function reloadLLMRouterPrompt(): string {
  return reloadPrompt("llm-router.prompt");
}

export function getCachedPrompt(filename: string): string | null {
  const cached = promptCache.get(filename);
  return cached ? cached.content : null;
}

export function getCachedAgentPrompt(): string | null {
  return getCachedPrompt("agent.prompt");
}

export function getCachedLLMRouterPrompt(): string | null {
  return getCachedPrompt("llm-router.prompt");
}
