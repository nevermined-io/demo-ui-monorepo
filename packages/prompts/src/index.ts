import type { PromptProvider } from "@app/domain";

/**
 * Minimal PromptProvider. In producción, puedes cargar desde /prompts o backend.
 */
export class DefaultPromptProvider implements PromptProvider {
  constructor(private opts: { agentType?: string; transport?: string } = {}) {}

  async getRouterPrompt(): Promise<string> {
    return (
      this.pickByContext(
        "You are a routing assistant. Decide whether to forward, require credits, or do nothing.",
        "router"
      ) || "Route the user message appropriately."
    );
  }

  async getAgentPrompt(): Promise<string> {
    return (
      this.pickByContext(
        "You are an agent that answers user intents concisely.",
        "agent"
      ) || "Answer the user's intent clearly and briefly."
    );
  }

  private pickByContext(defaultText: string, _kind: string): string {
    // Hook para seleccionar por agentType/transport si quieres matizar prompts
    return defaultText;
  }
}

/**
 * Tries to load prompts from public files with multiple fallbacks.
 * Examples:
 *  - /prompts/<agentType>/<transport>/agent.prompt
 *  - /prompts/<transport>/agent.prompt
 *  - /prompts/agent.prompt
 */
export class FilePromptProvider implements PromptProvider {
  constructor(private opts: { agentType?: string; transport?: string } = {}) {}

  async getRouterPrompt(): Promise<string> {
    const text = await this.tryFetch(
      ["router"],
      [".prompt" /* extension only */]
    );
    return text || "You are a routing assistant.";
  }

  async getAgentPrompt(): Promise<string> {
    const text = await this.tryFetch(["agent"], [".prompt"]);
    return text || "You are an agent that answers user intents concisely.";
  }

  private async tryFetch(
    basenames: string[],
    exts: string[]
  ): Promise<string | null> {
    const { agentType, transport } = this.opts || {};
    const bases: string[] = [];
    for (const base of basenames) {
      if (agentType && transport)
        bases.push(`/prompts/${agentType}/${transport}/${base}`);
      if (transport) bases.push(`/prompts/${transport}/${base}`);
      bases.push(`/prompts/${base}`);
    }
    for (const b of bases) {
      for (const ext of exts) {
        try {
          const url = `${b}${ext}`;
          const resp = await fetch(url);
          if (resp.ok) {
            const t = await resp.text();
            if (t && t.trim()) return t;
          }
        } catch {
          // continue
        }
      }
    }
    return null;
  }
}

export type { PromptProvider };
