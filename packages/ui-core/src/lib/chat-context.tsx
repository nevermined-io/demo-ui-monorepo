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
import {
  buildNeverminedCheckoutUrl,
  extractPlanIdFromUrl,
  extractApiKeyFromUrl,
} from "./utils";
import { useUserState } from "./user-state-context";
import { useAppConfig } from "./config";

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const {
    apiKey,
    credits,
    refreshCredits,
    initialized,
    mcpOAuthClient,
    mcpAccessToken,
    isMcpAuthenticated,
    startMcpAuth,
    prepareAuthUrl,
  } = useUserState();
  const appConfig = useAppConfig();
  const [messages, setMessages] = useState<FullMessage[]>([]);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<
    number | null
  >(null);
  const [isStoredConversation, setIsStoredConversation] = useState(false);
  const hydratedRef = useRef(false);
  const loadingRef = useRef(false);
  const processingPendingActionRef = useRef(false);
  const initialLoadRef = useRef(true);
  const waitingForCreditsRef = useRef(false);

  useEffect(() => {
    // Use the centralized configuration system
    const { transport, agentId, agentEndpoint, environment } = appConfig;

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
  }, [appConfig]);

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
  const { transport } = appConfig;
  const LS_PREFIX = transport ? `chat_${transport}` : "chat";
  const LS_MESSAGES_KEY = `${LS_PREFIX}_messages`;
  const LS_CONVERSATIONS_KEY = `${LS_PREFIX}_conversations`;
  const LS_CURRENT_CONV_ID_KEY = `${LS_PREFIX}_current_conversation_id`;

  useEffect(() => {
    if (
      messages.length === 0 &&
      hydratedRef.current &&
      !initialLoadRef.current
    ) {
      console.warn("[ChatProvider] ⚠️ Messages became empty after hydration!", {
        stackTrace: new Error().stack,
      });
    }
    if (hydratedRef.current) {
      initialLoadRef.current = false;
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
        setMessages(parsedMsgs);
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
    } catch (error) {
      console.error("[ChatProvider] Error loading from localStorage:", error);
      setMessages([]);
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
    setMessages([]);
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

  /**
   * Waits for credits to be available after checkout return.
   * Uses polling with a timeout to handle cases where the user canceled the purchase.
   * @param {() => number | null} getCredits - Function to get current credits value
   * @param {() => boolean} getInitialized - Function to get current initialized state
   * @param {number} timeoutMs - Maximum time to wait in milliseconds (default: 8000ms)
   * @param {number} pollIntervalMs - Interval between credit checks in milliseconds (default: 500ms)
   * @returns {Promise<number | null>} The credits value if available (> 0), null if timeout or no credits
   */
  const waitForCreditsAfterCheckout = async (
    getCredits: () => number | null,
    getInitialized: () => boolean,
    timeoutMs: number = 8000,
    pollIntervalMs: number = 500
  ): Promise<number | null> => {
    const startTime = Date.now();

    // First, wait for initialization to complete
    while (!getInitialized() && Date.now() - startTime < timeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    if (!getInitialized()) {
      console.warn("[ChatProvider] Timeout waiting for initialization");
      return null;
    }

    // Then poll for credits to be available
    while (Date.now() - startTime < timeoutMs) {
      // Refresh credits and get the latest value directly (not from state)
      const refreshedCredits = await refreshCredits();

      if (refreshedCredits !== null && refreshedCredits > 0) {
        return refreshedCredits;
      }

      // If credits are still null or 0, wait before next poll
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    // Timeout reached - user likely canceled the purchase
    console.warn(
      "[ChatProvider] Timeout waiting for credits after checkout return"
    );
    return null;
  };

  // Resume pending action after returning from checkout
  useEffect(() => {
    const resumeHandler = (e: Event) => {
      const detail: any = (e as CustomEvent).detail;
      if (
        detail?.type === "sendMessage" &&
        typeof detail.content === "string"
      ) {
        // Clear any existing pending action to prevent duplicates
        localStorage.removeItem("pendingChatAction");
        // Re-send the original message content
        sendMessage(detail.content);
      }
    };

    const checkoutReturnHandler = () => {
      console.log("🔑 Checkout return event received");
      // The actual processing will happen in the useEffect when apiKey changes
    };

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

    // Add the user message to the chat only if we're not processing a pending action
    // (to avoid duplicating the message when resuming from checkout)
    let userMessage: FullMessage | null = null;
    if (!processingPendingActionRef.current) {
      userMessage = {
        id: messages.length,
        content,
        type: "answer",
        isUser: true,
        conversationId: currentConversationId?.toString() || "new",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMessage!]);
    }

    // Build LLM history including the latest user message
    const completeMessages = userMessage
      ? [...messages, userMessage]
      : [...messages];
    const llmHistory = completeMessages.map((m) => ({
      role: m.isUser ? "user" : "assistant",
      content: m.content,
    }));

    // Call the LLM router before sending to the agent
    let llmAction:
      | "forward"
      | "no_credit"
      | "order_plan"
      | "no_action"
      | "authorize" = "forward";
    let llmReason = "";
    try {
      // Determine which authentication token to use based on transport
      const { transport } = appConfig;
      const authToken =
        transport === "mcp" ? mcpAccessToken || "" : apiKey || "";

      console.log("[ChatProvider] Calling LLM router with:", {
        transport,
        hasToken: !!authToken,
        tokenPreview: authToken ? `${authToken.slice(0, 10)}...` : "none",
      });

      const { action, message, reason } = await llmRouterRequest(
        content,
        llmHistory,
        authToken
      );
      llmAction = action;
      llmReason = message || reason || "";
    } catch (e) {
      // If router fails (e.g., network), do not force agent usage
      llmAction = "no_action";
      llmReason =
        "We're having trouble processing your request. Please try again.";
    }

    // Handle authorize action for MCP OAuth
    if (llmAction === "authorize") {
      const { transport } = appConfig;

      if (transport === "mcp") {
        try {
          console.log("🔐 MCP OAuth authorization required");

          // Persist pending action
          localStorage.setItem(
            "pendingChatAction",
            JSON.stringify({ type: "sendMessage", content })
          );

          // Prepare authorization URL
          const authUrl = await prepareAuthUrl();

          // Message with Connect button
          const message =
            llmReason ||
            "You need to authorize this application to access the Weather Agent.";

          setMessages((prev) => [
            ...prev,
            {
              id: prev.length + 1,
              content: message,
              type: "authorize" as any,
              metadata: { authUrl },
              isUser: false,
              conversationId: currentConversationId?.toString() || "new",
              timestamp: new Date(),
            },
          ]);
          return;
        } catch (error) {
          console.error("[ChatProvider] Failed to prepare auth URL:", error);
          setMessages((prev) => [
            ...prev,
            {
              id: prev.length + 1,
              content: "Failed to prepare authorization. Please try again.",
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

    // Checkout redirects for explicit router outcomes
    if (llmAction === "no_credit" || llmAction === "order_plan") {
      const { transport } = appConfig;

      if (transport === "http") {
        // HTTP Agent: Use Nevermined checkout
        try {
          const { agentId } = appConfig;
          const hasApiKey = Boolean(apiKey);
          const checkoutUrl = buildNeverminedCheckoutUrl(agentId, {
            returnApiKey: !hasApiKey,
          });

          // Persist pending intent to resume after returning
          localStorage.setItem(
            "pendingChatAction",
            JSON.stringify({ type: "sendMessage", content })
          );
          // Mark that we're going to checkout (for detection on return)
          localStorage.setItem("checkoutPending", "true");

          // Show a message with a clickable checkout link instead of redirecting
          setMessages((prev) => [
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
          setMessages((prev) => [
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
      } else if (transport === "mcp") {
        // MCP Agent: Use OAuth flow with Connect button
        if (!isMcpAuthenticated || !mcpAccessToken) {
          try {
            console.log(
              "🔐 MCP OAuth authorization required (no_credit/order_plan)"
            );

            // Persist pending action
            localStorage.setItem(
              "pendingChatAction",
              JSON.stringify({ type: "sendMessage", content })
            );

            // Prepare authorization URL
            const authUrl = await prepareAuthUrl();

            const message =
              llmReason ||
              "You need to authorize this application to access the Weather Agent.";

            setMessages((prev) => [
              ...prev,
              {
                id: prev.length + 1,
                content: message,
                type: "authorize" as any,
                metadata: { authUrl },
                isUser: false,
                conversationId: currentConversationId?.toString() || "new",
                timestamp: new Date(),
              },
            ]);
            return;
          } catch (error) {
            console.error(
              "[ChatProvider] Failed to prepare auth URL (no_credit):",
              error
            );
            setMessages((prev) => [
              ...prev,
              {
                id: prev.length + 1,
                content: "Failed to prepare authorization. Please try again.",
                type: "error",
                isUser: false,
                conversationId: currentConversationId?.toString() || "new",
                timestamp: new Date(),
              },
            ]);
            return;
          }
        } else {
          // Already authenticated with OAuth, the issue is server-side credits
          setMessages((prev) => [
            ...prev,
            {
              id: prev.length + 1,
              content:
                llmReason ||
                "You don't have enough credits. Please contact support or add credits to your account.",
              type: "notice",
              isUser: false,
              conversationId: currentConversationId?.toString() || "new",
              timestamp: new Date(),
            },
          ]);
          return;
        }
      }
    }

    // If router says forward but we have no API key or credits are zero, go to checkout
    if (llmAction === "forward") {
      const { transport } = appConfig;

      if (transport === "http") {
        // HTTP Agent: Use Nevermined flow
        const needsApiKey = !apiKey;
        const insufficientCredits = credits !== null && credits <= 0;

        // Skip credit checks if we're processing a pending action (user just returned from checkout)
        if (
          !processingPendingActionRef.current &&
          (needsApiKey || insufficientCredits)
        ) {
          try {
            const { agentId } = appConfig;
            const checkoutUrl = buildNeverminedCheckoutUrl(agentId, {
              returnApiKey: needsApiKey,
            });
            console.log("🔑 needsApiKey:", needsApiKey);
            console.log("💰 insufficientCredits:", insufficientCredits);
            console.log("🔗 checkoutUrl:", checkoutUrl);
            setMessages((prev) => [
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
            // Mark that we're going to checkout (for detection on return)
            localStorage.setItem("checkoutPending", "true");
            return;
          } catch {
            setMessages((prev) => [
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
      } else if (transport === "mcp") {
        // MCP Agent: Use OAuth flow
        if (!isMcpAuthenticated || !mcpAccessToken) {
          // Not authenticated with OAuth, initiate authorization flow
          try {
            console.log("🔐 MCP OAuth authorization required");

            // Persist pending action
            localStorage.setItem(
              "pendingChatAction",
              JSON.stringify({ type: "sendMessage", content })
            );

            setMessages((prev) => [
              ...prev,
              {
                id: prev.length + 1,
                content: "Redirecting to authorization server...",
                type: "notice",
                isUser: false,
                conversationId: currentConversationId?.toString() || "new",
                timestamp: new Date(),
              },
            ]);

            await startMcpAuth();
            return;
          } catch (error) {
            setMessages((prev) => [
              ...prev,
              {
                id: prev.length + 1,
                content:
                  "Failed to start OAuth authorization. Please try again.",
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
    }

    if (llmAction === "no_action") {
      // Add the LLM's message as an 'answer' type in the chat
      setMessages((prev) => [
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
    const { transport } = appConfig;
    let toolsCatalog: any | undefined = undefined;

    if (transport === "mcp" && mcpAccessToken) {
      try {
        toolsCatalog = await listMcpToolsClient(mcpAccessToken);
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
        setMessages((prev) => [
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
      setMessages((prev) => [
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
      const thinkingId = Date.now();
      setMessages((prev) => [
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
        // MCP tool call requires OAuth access token
        if (!mcpAccessToken) {
          throw new Error("MCP access token required for tool call");
        }
        agentResponse = await callMcpToolClient(
          mcpToolCall.tool,
          mcpToolCall.args || {},
          mcpAccessToken
        );
      } else {
        // Send message to agent (HTTP or MCP)
        agentResponse = await sendMessageToAgent(agentPrompt, mcpAccessToken);
      }

      // Remove thinking message and add the agent's response
      setMessages((prev) => [
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
        setMessages((prev) => [
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
          setMessages((prev) => [
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
      setMessages((prev) => [
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

  // Process pending action when API key becomes available after checkout return
  useEffect(() => {
    // Only process if we have an API key and we're not already waiting for credits
    if (!apiKey || waitingForCreditsRef.current) {
      return;
    }

    const pendingAction = localStorage.getItem("pendingChatAction");
    if (!pendingAction) {
      return;
    }

    // Check if we just returned from checkout
    // Check for URL parameters first, then fallback to localStorage flag
    const hasPlanIdInUrl = Boolean(extractPlanIdFromUrl(false));
    const hasApiKeyInUrl = Boolean(extractApiKeyFromUrl(false));
    const checkoutPendingFlag =
      localStorage.getItem("checkoutPending") === "true";
    const hasReturnedFromCheckout =
      hasPlanIdInUrl || hasApiKeyInUrl || checkoutPendingFlag;

    // Clear the checkout pending flag if we're processing
    if (checkoutPendingFlag) {
      localStorage.removeItem("checkoutPending");
    }

    if (!hasReturnedFromCheckout) {
      // Not returning from checkout, process immediately
      try {
        const action = JSON.parse(pendingAction);
        if (
          action.type === "sendMessage" &&
          typeof action.content === "string"
        ) {
          processingPendingActionRef.current = true;
          localStorage.removeItem("pendingChatAction");
          sendMessage(action.content);
          setTimeout(() => {
            processingPendingActionRef.current = false;
          }, 1000);
        }
      } catch (error) {
        console.error("[ChatProvider] Error processing pending action:", error);
        localStorage.removeItem("pendingChatAction");
      }
      return;
    }

    // We're returning from checkout - wait for credits with timeout
    console.log("🔑 Processing pending action after checkout return");
    waitingForCreditsRef.current = true;

    const processAfterCheckout = async () => {
      try {
        // Wait for credits to be available (with timeout for cancellation case)
        // Pass functions to get current credits and initialized state
        const finalCredits = await waitForCreditsAfterCheckout(
          () => credits,
          () => initialized
        );

        const action = JSON.parse(pendingAction);
        if (
          action.type === "sendMessage" &&
          typeof action.content === "string"
        ) {
          // Use the credits returned from waitForCreditsAfterCheckout
          // which gets them directly from refreshCredits() return value
          if (finalCredits !== null && finalCredits > 0) {
            // Credits are available - execute the pending action
            console.log(
              `✅ Credits available (${finalCredits}), executing pending action`
            );
            processingPendingActionRef.current = true;
            localStorage.removeItem("pendingChatAction");
            sendMessage(action.content);
            setTimeout(() => {
              processingPendingActionRef.current = false;
            }, 1000);
          } else {
            // No credits available - user likely canceled the purchase
            console.log(
              "⚠️ No credits available after checkout return - purchase may have been canceled"
            );
            localStorage.removeItem("pendingChatAction");
            setMessages((prev) => [
              ...prev,
              {
                id: prev.length + 1,
                content:
                  "Purchase was not completed. Please complete the checkout to continue.",
                type: "notice",
                isUser: false,
                conversationId: currentConversationId?.toString() || "new",
                timestamp: new Date(),
              },
            ]);
          }
        }
      } catch (error) {
        console.error(
          "[ChatProvider] Error processing pending action after checkout:",
          error
        );
        localStorage.removeItem("pendingChatAction");
      } finally {
        waitingForCreditsRef.current = false;
      }
    };

    processAfterCheckout();
  }, [
    apiKey,
    initialized,
    credits,
    refreshCredits,
    sendMessage,
    currentConversationId,
  ]);

  // Process pending action when MCP OAuth is completed
  useEffect(() => {
    const { transport } = appConfig;

    // Only for MCP transport
    if (transport !== "mcp") {
      return;
    }

    // Only process if we're authenticated and not already processing
    if (
      !isMcpAuthenticated ||
      !mcpAccessToken ||
      processingPendingActionRef.current
    ) {
      return;
    }

    const pendingAction = localStorage.getItem("pendingChatAction");
    if (!pendingAction) {
      return;
    }

    console.log(
      "🔐 MCP OAuth completed, processing pending action:",
      pendingAction
    );

    try {
      const action = JSON.parse(pendingAction);
      if (action.type === "sendMessage" && typeof action.content === "string") {
        processingPendingActionRef.current = true;
        localStorage.removeItem("pendingChatAction");

        // Execute the pending message
        console.log("📤 Sending pending message:", action.content);
        sendMessage(action.content);

        setTimeout(() => {
          processingPendingActionRef.current = false;
        }, 1000);
      }
    } catch (error) {
      console.error(
        "[ChatProvider] Error processing pending action after OAuth:",
        error
      );
      localStorage.removeItem("pendingChatAction");
    }
  }, [
    isMcpAuthenticated,
    mcpAccessToken,
    sendMessage,
    currentConversationId,
    appConfig,
  ]);

  const loadStoredMessages = (conversationId: number) => {
    const storedConversationMessages = storedMessages[conversationId];
    if (storedConversationMessages) {
      setMessages(storedConversationMessages as FullMessage[]);
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
