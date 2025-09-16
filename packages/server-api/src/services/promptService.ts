import { readFileSync, statSync } from "fs";
import { join, resolve } from "path";
import type { Request } from "express";

/**
 * Represents a cached prompt entry.
 */
interface CachedPrompt {
  content: string;
  lastModified: number;
}

/**
 * Cache prompts by absolute file path to avoid re-reading unchanged files.
 */
const promptCache: Map<string, CachedPrompt> = new Map();

/**
 * Attempts to find the monorepo root by walking up until an `apps` directory is found.
 * @param startDir - Directory to start the search from
 * @returns Absolute path to repo root or the provided startDir if not found
 */
function findRepoRoot(startDir: string): string {
  let current: string | undefined = startDir;
  for (let i = 0; i < 8 && current; i++) {
    try {
      const appsDir = resolve(current, "apps");
      const packagesDir = resolve(current, "packages");
      // Using statSync to check existence without importing fs-extra
      statSync(appsDir);
      statSync(packagesDir);
      return current;
    } catch {
      const parent = resolve(current, "..");
      if (parent === current) break;
      current = parent;
    }
  }
  return startDir;
}

/**
 * Determines which app directory to use for prompt loading based on the request context
 * or environment variables.
 * - If MONOREPO_UI_DIR is set (e.g., apps/agent-http-app), that takes precedence
 * - Else, it inspects the Referer path for `/mcp-agent` or `/simple-agent`
 * - Defaults to HTTP app when unclear
 * @param req - Optional Express request from which to infer the app
 * @returns Absolute path to the app directory
 */
function resolveAppDirectory(req?: Request): string {
  const repoRoot = findRepoRoot(process.cwd());

  const envDir = process.env.MONOREPO_UI_DIR;
  if (envDir) {
    return resolve(repoRoot, envDir);
  }

  const referer = (req?.headers?.referer as string | undefined) || "";
  let pathPart = "";
  try {
    const url = new URL(referer);
    pathPart = url.pathname || "";
  } catch {
    // referer may be relative or missing; use raw value for startsWith checks
    pathPart = referer || "";
  }

  if (pathPart.startsWith("/mcp-agent")) {
    return resolve(repoRoot, "apps/agent-mcp-app");
  }
  if (pathPart.startsWith("/simple-agent")) {
    return resolve(repoRoot, "apps/agent-http-app");
  }
  // Default to HTTP app
  return resolve(repoRoot, "apps/agent-http-app");
}

/**
 * Loads a prompt from the active app folder with caching.
 * @param filename - The prompt filename, e.g., `agent.prompt` or `llm-router.prompt`
 * @param req - Optional Express request to infer which app is active
 * @returns The prompt content as string
 */
export function loadPrompt(filename: string, req?: Request): string {
  try {
    const appDir = resolveAppDirectory(req);
    const promptPath = join(appDir, filename);
    const stats = statSync(promptPath);
    const cached = promptCache.get(promptPath);
    if (cached && stats.mtime.getTime() <= cached.lastModified) {
      return cached.content;
    }
    const prompt = readFileSync(promptPath, "utf-8");
    promptCache.set(promptPath, {
      content: prompt,
      lastModified: stats.mtime.getTime(),
    });
    return prompt;
  } catch (error) {
    console.error(`Error loading prompt ${filename}:`, error);
    if (filename === "agent.prompt") {
      return `You are a helpful AI assistant. Please provide accurate and helpful responses to user queries.`;
    } else if (filename === "llm-router.prompt") {
      return `You are an assistant that routes user messages. If in doubt, respond with 'no_action'.`;
    }
    return `Default prompt for ${filename}.`;
  }
}

/**
 * Loads the agent context prompt for the active app.
 * @param req - Optional request to infer the app
 */
export function loadAgentPrompt(req?: Request): string {
  return loadPrompt("agent.prompt", req);
}

/**
 * Loads the LLM router prompt for the active app.
 * @param req - Optional request to infer the app
 */
export function loadLLMRouterPrompt(req?: Request): string {
  return loadPrompt("llm-router.prompt", req);
}

/**
 * Invalidates and reloads a prompt for the active app.
 * @param filename - Prompt filename
 * @param req - Optional request to infer the app
 */
export function reloadPrompt(filename: string, req?: Request): string {
  try {
    const appDir = resolveAppDirectory(req);
    const promptPath = join(appDir, filename);
    promptCache.delete(promptPath);
  } catch {}
  return loadPrompt(filename, req);
}

/**
 * Invalidates and reloads the agent prompt for the active app.
 * @param req - Optional request to infer the app
 */
export function reloadAgentPrompt(req?: Request): string {
  return reloadPrompt("agent.prompt", req);
}

/**
 * Invalidates and reloads the LLM router prompt for the active app.
 * @param req - Optional request to infer the app
 */
export function reloadLLMRouterPrompt(req?: Request): string {
  return reloadPrompt("llm-router.prompt", req);
}

/**
 * Returns the cached prompt if present for the active app.
 * @param filename - Prompt filename
 * @param req - Optional request to infer the app
 */
export function getCachedPrompt(
  filename: string,
  req?: Request
): string | null {
  try {
    const appDir = resolveAppDirectory(req);
    const promptPath = join(appDir, filename);
    const cached = promptCache.get(promptPath);
    return cached ? cached.content : null;
  } catch {
    return null;
  }
}

/**
 * Returns the cached agent prompt for the active app.
 * @param req - Optional request to infer the app
 */
export function getCachedAgentPrompt(req?: Request): string | null {
  return getCachedPrompt("agent.prompt", req);
}

/**
 * Returns the cached LLM router prompt for the active app.
 * @param req - Optional request to infer the app
 */
export function getCachedLLMRouterPrompt(req?: Request): string | null {
  return getCachedPrompt("llm-router.prompt", req);
}
