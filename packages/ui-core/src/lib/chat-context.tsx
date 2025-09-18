import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  ReactNode,
} from "react";
import { FullMessage, ChatContextType } from "./chat-types";
import {
  getCurrentBlockNumber,
  sendMessageToAgent,
  listMcpToolsClient,
  callMcpToolClient,
} from "./chat-api";
import { storedConversations, storedMessages } from "./chat-mocks";
import { Conversation } from "@shared/schema";
import {
  llmRouterRequest,
  titleSummarizeRequest,
  intentSynthesizeRequest,
  getPlanCostRequest,
} from "./chat-requests";
import { buildNeverminedCheckoutUrl } from "./utils";
import { useUserState } from "./user-state-context";

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { apiKey, credits, refreshCredits } = useUserState();
  const [messages, setMessages] = useState<FullMessage[]>([]);

  // Debug: Wrap setMessages to track when it's called
  const debugSetMessages = (
    newMessages: FullMessage[] | ((prev: FullMessage[]) => FullMessage[])
  ) => {
    console.log("[ChatProvider] setMessages called:", {
      isFunction: typeof newMessages === "function",
      newCount:
        typeof newMessages === "function" ? "unknown" : newMessages.length,
      currentCount: messages.length,
      stackTrace: new Error().stack,
    });
    setMessages(newMessages);
  };
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<
    number | null
  >(null);
  const [isStoredConversation, setIsStoredConversation] = useState(false);
  const hydratedRef = useRef(false);
  const loadingRef = useRef(false);
  const processingPendingActionRef = useRef(false);

  useEffect(() => {
    // Determine which agent configuration to use based on transport
    const transport = (import.meta as any).env?.VITE_TRANSPORT || "http";
    const agentId =
      transport === "http"
        ? (import.meta as any).env?.VITE_HTTP_AGENT_ID ||
          (import.meta as any).env?.VITE_AGENT_ID ||
          ""
        : (import.meta as any).env?.VITE_MCP_AGENT_ID ||
          (import.meta as any).env?.VITE_AGENT_ID ||
          "";

    const agentEndpoint =
      transport === "http"
        ? (import.meta as any).env?.VITE_HTTP_AGENT_ENDPOINT || ""
        : (import.meta as any).env?.VITE_MCP_AGENT_ENDPOINT || "";

    const environment = (import.meta as any).env?.VITE_NVM_ENVIRONMENT || "";

    console.log(`[${transport}-agent] agentId =`, agentId);
    console.log(`[${transport}-agent] agentEndpoint =`, agentEndpoint);
    console.log(`[${transport}-agent] environment =`, environment);

    if (!agentId) {
      console.warn(
        `[${transport}-agent] Missing agentId - checkout links will not include agent id`
      );
    }
    if (!agentEndpoint) {
      console.warn(
        `[${transport}-agent] Missing agentEndpoint - agent may not work properly`
      );
    }
    if (!environment) {
      console.warn(
        `[${transport}-agent] Missing environment - checkout links will not include environment`
      );
    }
  }, []);

  // Deduplicate helpers
  const dedupeMessages = (items: FullMessage[]): FullMessage[] => {
    const seen = new Set<string>();
    const result: FullMessage[] = [];
    for (const msg of items) {
      const key = JSON.stringify({
        c: msg.content,
        t: msg.type,
        u: msg.isUser,
        v: msg.conversationId,
        x: msg.txHash || "",
        cr: msg.credits ?? null,
        p: msg.planId || "",
      });
      if (!seen.has(key)) {
        seen.add(key);
        result.push(msg);
      }
    }
    return result;
  };

  const dedupeConversations = (items: Conversation[]): Conversation[] => {
    const seen = new Set<number>();
    const result: Conversation[] = [];
    for (const c of items) {
      if (!seen.has(c.id as number)) {
        seen.add(c.id as number);
        result.push(c);
      }
    }
    return result;
  };

  // Keys for localStorage (namespaced per app/transport). Includes migration from legacy keys.
  const transport = (import.meta as any).env?.VITE_TRANSPORT || "http";
  const LS_PREFIX = transport ? `chat_${transport}` : "chat";
  const LS_MESSAGES_KEY = `${LS_PREFIX}_messages`;
  const LS_CONVERSATIONS_KEY = `${LS_PREFIX}_conversations`;
  const LS_CURRENT_CONV_ID_KEY = `${LS_PREFIX}_current_conversation_id`;
  const LEGACY_MESSAGES_KEY = "chat_messages";

  useEffect(() => {
    // Special warning when messages become empty
    if (messages.length === 0 && hydratedRef.current) {
      console.warn("[ChatProvider] ⚠️ Messages became empty after hydration!", {
        stackTrace: new Error().stack,
      });
    }
  }, [messages]);

  // Persist messages and conversations on every change
  useEffect(() => {
    if (!hydratedRef.current) {
      return;
    }
    try {
      localStorage.setItem(LS_MESSAGES_KEY, JSON.stringify(messages));
    } catch (error) {
      console.error("[ChatProvider] Error persisting messages:", error);
    }
  }, [messages]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    try {
      localStorage.setItem(LS_CONVERSATIONS_KEY, JSON.stringify(conversations));
    } catch (error) {
      console.error("[ChatProvider] Error persisting conversations:", error);
    }
  }, [conversations]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    try {
      if (currentConversationId === null) {
        localStorage.removeItem(LS_CURRENT_CONV_ID_KEY);
      } else {
        localStorage.setItem(
          LS_CURRENT_CONV_ID_KEY,
          String(currentConversationId)
        );
      }
    } catch (error) {
      console.error(
        "[ChatProvider] Error persisting current conversation ID:",
        error
      );
    }
  }, [currentConversationId]);

  // Load from localStorage on first mount; migrate from legacy unscoped keys if present
  useEffect(() => {
    // Prevent multiple loads during the same session
    if (hydratedRef.current || loadingRef.current) {
      return;
    }

    loadingRef.current = true;

    try {
      // Prefer scoped keys; fallback to legacy keys for migration
      const rawMsgs = localStorage.getItem(LS_MESSAGES_KEY);
      const rawConvs = localStorage.getItem(LS_CONVERSATIONS_KEY);
      const rawCurrent = localStorage.getItem(LS_CURRENT_CONV_ID_KEY);

      const parsedMsgsRaw: FullMessage[] = rawMsgs ? JSON.parse(rawMsgs) : [];
      const parsedMsgs = dedupeMessages(parsedMsgsRaw);
      const parsedConvsRaw: Conversation[] = rawConvs
        ? JSON.parse(rawConvs)
        : [...storedConversations];
      const parsedConvs: Conversation[] = dedupeConversations(
        parsedConvsRaw.map((c) => ({
          ...c,
          timestamp: c.timestamp ? new Date(c.timestamp as any) : null,
        }))
      );

      // Only set messages if we have some, or if this is the first load
      if (parsedMsgs.length > 0 || messages.length === 0) {
        debugSetMessages(parsedMsgs);
      }

      // Only set conversations if we have some, or if this is the first load
      if (parsedConvs.length > 0 || conversations.length === 0) {
        setConversations(
          [...parsedConvs].sort(
            (a, b) =>
              (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0)
          )
        );
      }
      setCurrentConversationId(rawCurrent ? Number(rawCurrent) : null);
      setIsStoredConversation(
        Boolean(parsedMsgs.length === 0 && parsedConvs.length > 0)
      );

      // If we loaded from legacy keys, migrate to scoped keys now

      hydratedRef.current = true;
      console.log("[ChatProvider] Hydration completed successfully");
    } catch (error) {
      console.error("[ChatProvider] Error loading from localStorage:", error);
      debugSetMessages([]);
      setConversations(
        [...storedConversations].sort(
          (a, b) =>
            (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0)
        )
      );
      setCurrentConversationId(null);
      hydratedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Clears all persisted conversation data and pending chat actions from localStorage,
   * and resets in-memory chat state.
   * This removes:
   * - chat_messages
   * - chat_conversations
   * - chat_current_conversation_id
   * - pendingChatAction (unprocessed/pending message intent)
   * @returns {void}
   */
  const clearHistory = (): void => {
    debugSetMessages([]);
    setConversations([]);
    setCurrentConversationId(null);
    try {
      localStorage.removeItem(LS_MESSAGES_KEY);
      localStorage.removeItem(LS_CONVERSATIONS_KEY);
      localStorage.removeItem(LS_CURRENT_CONV_ID_KEY);
      localStorage.removeItem("pendingChatAction");
    } catch (error) {
      console.error("[ChatProvider] Error clearing localStorage:", error);
    }
  };

  const onMessageTypingComplete = (): void => {
    // This function is kept for compatibility but no longer needed
  };

  // Resume pending action after returning from checkout
  useEffect(() => {
    const processPendingAction = () => {
      try {
        const pendingAction = localStorage.getItem("pendingChatAction");
        if (pendingAction) {
          const action = JSON.parse(pendingAction);
          if (
            action.type === "sendMessage" &&
            typeof action.content === "string"
          ) {
            console.log("[ChatProvider] Processing pending action:", action);
            // Set flag to indicate we're processing a pending action
            processingPendingActionRef.current = true;
            // Clear the pending action first to prevent duplicates
            localStorage.removeItem("pendingChatAction");
            // Execute the pending action
            sendMessage(action.content);
            // Reset flag after a short delay
            setTimeout(() => {
              processingPendingActionRef.current = false;
            }, 1000);
          }
        }
      } catch (error) {
        console.error(
          "[ChatProvider] Error processing pending chat action:",
          error
        );
        processingPendingActionRef.current = false;
      }
    };

    const resumeHandler = (e: Event) => {
      const detail: any = (e as CustomEvent).detail;
      if (
        detail?.type === "sendMessage" &&
        typeof detail.content === "string"
      ) {
        console.log("[ChatProvider] Resume handler triggered:", detail);
        // Clear any existing pending action to prevent duplicates
        localStorage.removeItem("pendingChatAction");
        // Re-send the original message content
        sendMessage(detail.content);
      }
    };

    const checkoutReturnHandler = () => {
      console.log("[ChatProvider] Checkout return handler triggered");
      // Small delay to ensure the page is fully loaded
      setTimeout(processPendingAction, 100);
    };

    // Check for pending action immediately on mount (in case event was already fired)
    setTimeout(processPendingAction, 200);

    window.addEventListener(
      "resume-chat-action",
      resumeHandler as EventListener
    );
    window.addEventListener(
      "checkout-return",
      checkoutReturnHandler as EventListener
    );

    return () => {
      window.removeEventListener(
        "resume-chat-action",
        resumeHandler as EventListener
      );
      window.removeEventListener(
        "checkout-return",
        checkoutReturnHandler as EventListener
      );
    };
  }, []);

  const sendMessage = async (content: string) => {
    setIsStoredConversation(false);

    // Add the user message to the chat
    const userMessage: FullMessage = {
      id: messages.length,
      content,
      type: "answer",
      isUser: true,
      conversationId: currentConversationId?.toString() || "new",
      timestamp: new Date(),
    };
    debugSetMessages((prev) => [...prev, userMessage]);

    // If we're processing a pending action, skip credit checks and go directly to agent
    if (processingPendingActionRef.current) {
      console.log(
        "[ChatProvider] Processing pending action - skipping credit checks"
      );
      // Continue with the normal flow but skip credit checks
      // This will be handled in the agent processing section
    }

    // Build LLM history including the latest user message
    const completeMessages = [...messages, userMessage];
    const llmHistory = completeMessages.map((m) => ({
      role: m.isUser ? "user" : "assistant",
      content: m.content,
    }));

    // Call the LLM router before sending to the agent
    let llmAction: "forward" | "no_credit" | "order_plan" | "no_action" =
      "forward";
    let llmReason = "";
    try {
      const { action, message, reason } = await llmRouterRequest(
        content,
        llmHistory
      );
      llmAction = action;
      llmReason = message || reason || "";
    } catch (e) {
      // If router fails (e.g., network), do not force agent usage
      llmAction = "no_action";
      llmReason =
        "I can chat without using the agent. Ask me anything or try again.";
    }

    // Checkout redirects for explicit router outcomes
    if (llmAction === "no_credit" || llmAction === "order_plan") {
      try {
        const transport = (import.meta as any).env?.VITE_TRANSPORT || "http";
        const agentId =
          transport === "http"
            ? (import.meta as any).env?.VITE_HTTP_AGENT_ID ||
              (import.meta as any).env?.VITE_AGENT_ID ||
              ""
            : (import.meta as any).env?.VITE_MCP_AGENT_ID ||
              (import.meta as any).env?.VITE_AGENT_ID ||
              "";
        const hasApiKey = Boolean(apiKey);
        const checkoutUrl = buildNeverminedCheckoutUrl(agentId, {
          returnApiKey: !hasApiKey,
        });

        // Persist pending intent to resume after returning
        localStorage.setItem(
          "pendingChatAction",
          JSON.stringify({ type: "sendMessage", content })
        );

        // Show a message with a clickable checkout link instead of redirecting
        debugSetMessages((prev) => [
          ...prev,
          {
            id: prev.length + 1,
            content: `${
              llmReason && llmReason.trim()
                ? llmReason.trim()
                : llmAction === "no_credit"
                  ? "You have no credits."
                  : "Purchase is required to continue."
            } Please complete the agent checkout: ${checkoutUrl}`,
            type: "notice",
            isUser: false,
            conversationId: currentConversationId?.toString() || "new",
            timestamp: new Date(),
          },
        ]);
        return;
      } catch {
        debugSetMessages((prev) => [
          ...prev,
          {
            id: prev.length + 1,
            content: "Unable to redirect to checkout. Please try again.",
            type: "error",
            isUser: false,
            conversationId: currentConversationId?.toString() || "new",
            timestamp: new Date(),
          },
        ]);
        return;
      }
    }

    // If router says forward but we have no API key or credits are zero, go to checkout
    if (llmAction === "forward") {
      const needsApiKey = !apiKey;
      const insufficientCredits = credits !== null && credits <= 0;

      // Skip credit checks if we're processing a pending action (user just returned from checkout)
      if (processingPendingActionRef.current) {
        console.log(
          "[ChatProvider] Skipping credit checks - processing pending action"
        );
      } else if (needsApiKey || insufficientCredits) {
        try {
          const transport = (import.meta as any).env?.VITE_TRANSPORT || "http";
          const agentId =
            transport === "http"
              ? (import.meta as any).env?.VITE_HTTP_AGENT_ID ||
                (import.meta as any).env?.VITE_AGENT_ID ||
                ""
              : (import.meta as any).env?.VITE_MCP_AGENT_ID ||
                (import.meta as any).env?.VITE_AGENT_ID ||
                "";
          const checkoutUrl = buildNeverminedCheckoutUrl(agentId, {
            returnApiKey: needsApiKey,
          });
          debugSetMessages((prev) => [
            ...prev,
            {
              id: prev.length + 1,
              content: `${
                needsApiKey ? "No API Key found." : "Insufficient credits."
              } Please complete the agent checkout: ${checkoutUrl}`,
              type: "notice",
              isUser: false,
              conversationId: currentConversationId?.toString() || "new",
              timestamp: new Date(),
            },
          ]);
          localStorage.setItem(
            "pendingChatAction",
            JSON.stringify({ type: "sendMessage", content })
          );
          return;
        } catch {
          debugSetMessages((prev) => [
            ...prev,
            {
              id: prev.length + 1,
              content: "Unable to redirect to checkout. Please try again.",
              type: "error",
              isUser: false,
              conversationId: currentConversationId?.toString() || "new",
              timestamp: new Date(),
            },
          ]);
          return;
        }
      }
    }

    if (llmAction === "no_action") {
      // Add the LLM's message as an 'answer' type in the chat
      debugSetMessages((prev) => [
        ...prev,
        {
          id: prev.length + 1,
          content: llmReason || "",
          type: "answer",
          isUser: false,
          conversationId: currentConversationId?.toString() || "new",
          timestamp: new Date(),
        },
      ]);
      return;
    }

    // If the LLM says 'forward', follow the normal flow
    if (!currentConversationId) {
      // Get synthesized title from backend
      let title = content.slice(0, 30) + "...";
      try {
        const data = await titleSummarizeRequest(llmHistory);
        if (data.title) title = data.title;
      } catch (e) {
        console.error(e);
      }
      const newConversation: Conversation = {
        id: conversations.length + 1,
        title,
        timestamp: new Date(),
      };
      setConversations((prev) => [newConversation, ...prev]);
      setCurrentConversationId(newConversation.id);
    }

    // Use intent synthesis for agent prompt
    let agentPrompt = "";
    let mcpToolCall: { tool: string; args: Record<string, any> } | null = null;

    // For MCP transport, negotiate with MCP tools before intent synthesis
    const transport = (import.meta as any).env?.VITE_TRANSPORT || "http";
    let toolsCatalog: any | undefined = undefined;

    if (transport === "mcp") {
      try {
        toolsCatalog = await listMcpToolsClient();
      } catch (e) {
        console.warn("[ChatProvider] Failed to list MCP tools:", e);
      }
    }

    try {
      const data = await intentSynthesizeRequest(llmHistory, toolsCatalog);
      if (data.intent) {
        agentPrompt = data.intent;
      } else if (
        data.intent &&
        typeof data.intent === "object" &&
        data.intent.tool
      ) {
        mcpToolCall = data.intent as {
          tool: string;
          args: Record<string, any>;
        };
      } else if (data && typeof data === "object" && data.tool) {
        mcpToolCall = data as { tool: string; args: Record<string, any> };
      } else if (typeof data === "string") {
        agentPrompt = data;
      } else {
        // Do not fallback to raw content; require synthesized intent
        debugSetMessages((prev) => [
          ...prev,
          {
            id: prev.length + 1,
            content: "Unable to synthesize intent. Please try again.",
            type: "error",
            isUser: false,
            conversationId: currentConversationId?.toString() || "new",
            timestamp: new Date(),
          },
        ]);
        return;
      }
    } catch (e) {
      // Do not fallback to raw content; require synthesized intent
      debugSetMessages((prev) => [
        ...prev,
        {
          id: prev.length + 1,
          content: "Unable to synthesize intent. Please try again.",
          type: "error",
          isUser: false,
          conversationId: currentConversationId?.toString() || "new",
          timestamp: new Date(),
        },
      ]);
      return;
    }

    try {
      // Send message to the new agent
      const blockNumber = await getCurrentBlockNumber();
      // Add temporary thinking message
      const thinkingId = Date.now();
      debugSetMessages((prev) => [
        ...prev,
        {
          id: thinkingId,
          content: "...",
          type: "thinking",
          isUser: false,
          conversationId: currentConversationId?.toString() || "new",
          timestamp: new Date(),
        },
      ]);

      let agentResponse:
        | { response: string; content?: any }
        | { response: string; txHash?: string; credits?: number };

      if (mcpToolCall && mcpToolCall.tool) {
        agentResponse = await callMcpToolClient(
          mcpToolCall.tool,
          mcpToolCall.args || {}
        );
      } else {
        agentResponse = await sendMessageToAgent(agentPrompt);
      }

      // Remove thinking message and add the agent's response
      debugSetMessages((prev) => [
        ...prev.filter((m) => m.id !== thinkingId),
        {
          id: prev.length + 1,
          content: agentResponse.response,
          type: "answer",
          isUser: false,
          conversationId: currentConversationId?.toString() || "new",
          timestamp: new Date(),
        },
      ]);

      // Handle transaction if present (only for HTTP agent responses)
      if (
        "txHash" in agentResponse &&
        agentResponse.txHash &&
        "credits" in agentResponse
      ) {
        const httpResponse = agentResponse as {
          response: string;
          txHash: string;
          credits: number;
        };
        debugSetMessages((prev) => [
          ...prev,
          {
            id: prev.length + 1,
            content: `Task completed. ${httpResponse.credits} credit${
              httpResponse.credits === 1 ? "" : "s"
            } have been deducted from your balance.`,
            type: "nvm-transaction-user",
            isUser: false,
            conversationId: currentConversationId?.toString() || "new",
            timestamp: new Date(),
            txHash: httpResponse.txHash,
            credits: httpResponse.credits,
          },
        ]);

        // Calculate and show cost
        try {
          const data = await getPlanCostRequest();
          const planPrice = Number(data.planPrice);
          const planCredits = Number(data.planCredits);
          const creditsUsed = Number(httpResponse.credits);
          const cost =
            planCredits > 0 ? (planPrice / planCredits) * creditsUsed : 0;
          debugSetMessages((prev) => [
            ...prev,
            {
              id: prev.length + 1,
              content: `The final cost has been ${cost.toFixed(4)} USDC.`,
              type: "usd-info",
              isUser: false,
              conversationId: currentConversationId?.toString() || "new",
              timestamp: new Date(),
            },
          ]);
        } catch (e) {
          console.error(e);
        }
      }
      // Refresh the credits badge after agent interaction
      try {
        await refreshCredits();
      } catch {}
    } catch (error) {
      console.error(error);
      debugSetMessages((prev) => [
        ...prev.filter((m) => m.type !== "thinking"),
        {
          id: prev.length + 1,
          content: "Error communicating with the agent. Please try again.",
          type: "error",
          isUser: false,
          conversationId: currentConversationId?.toString() || "new",
          timestamp: new Date(),
        },
      ]);
    }
  };

  const loadStoredMessages = (conversationId: number) => {
    const storedConversationMessages = storedMessages[conversationId];
    if (storedConversationMessages) {
      debugSetMessages(storedConversationMessages as FullMessage[]);
      setIsStoredConversation(true);
    }
  };

  const handleSetCurrentConversationId = (id: number | null) => {
    setCurrentConversationId(id);
    if (id !== null) {
      loadStoredMessages(id);
    }
  };

  const startNewConversation = () => {
    handleSetCurrentConversationId(null);
  };

  return (
    <ChatContext.Provider
      value={{
        messages,
        conversations,
        currentConversationId,
        isStoredConversation,
        sendMessage,
        setCurrentConversationId: handleSetCurrentConversationId,
        startNewConversation,
        onMessageTypingComplete,
        clearHistory,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}
export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}
