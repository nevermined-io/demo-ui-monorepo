import { useState, useEffect, useCallback } from "react";

export interface N8nEvent {
  sessionId: string;
  timestamp: string;
  step: string;
  data?: any;
}

export type N8nStatus = "idle" | "running" | "complete" | "error";

/**
 * Maps n8n step events to human-readable messages for the chat UI.
 */
export function n8nEventToMessage(event: N8nEvent): string {
  const d = event.data || {};
  switch (event.step) {
    case "started": {
      if (d.message) return d.message;
      const years = d.years;
      return years?.length
        ? `Starting analysis for years ${years.join(", ")}...`
        : "Starting analysis...";
    }
    case "payment_required":
      return d.message ||
        `Processing payment for year ${d.year ?? ""}${d.amount ? ` ($${d.amount} ${d.currency || "USD"})` : ""}...`;
    case "access_token_obtained":
      return d.message || `Access token obtained for year ${d.year ?? ""}`;
    case "article_fetched":
      return d.message ||
        (d.articleTitle || d.title
          ? `Article fetched: *${d.articleTitle || d.title}*`
          : `Article fetched for year ${d.year ?? ""}`);
    case "next_year":
      return d.message ||
        (d.progress
          ? `Progress: ${d.progress} — Continuing with year ${d.year ?? ""}...`
          : `Continuing with next year${d.year ? ` (${d.year})` : ""}...`);
    case "summarizing":
      return d.message ||
        (d.articleCount || d.count
          ? `Generating summary of ${d.articleCount ?? d.count} articles...`
          : `Generating summary for year ${d.year ?? ""}...`);
    case "complete":
      return d.summary || d.message || "Analysis complete.";
    case "error":
      return d.message || "An error occurred during processing.";
    default:
      return d.message || `Step: ${event.step}${d.year ? ` (year ${d.year})` : ""}`;
  }
}

/**
 * Hook to consume SSE events from an n8n agent session.
 * Opens an EventSource to /api/n8n/events/:sessionId and tracks events + status.
 */
export function useN8nEvents(sessionId: string | null) {
  const [events, setEvents] = useState<N8nEvent[]>([]);
  const [status, setStatus] = useState<N8nStatus>("idle");

  const reset = useCallback(() => {
    setEvents([]);
    setStatus("idle");
  }, []);

  useEffect(() => {
    if (!sessionId) return;

    const source = new EventSource(`/api/n8n/events/${sessionId}`);
    setStatus("running");

    source.onmessage = (e) => {
      try {
        const event: N8nEvent = JSON.parse(e.data);
        setEvents((prev) => [...prev, event]);
        if (event.step === "complete") {
          setStatus("complete");
          source.close();
        } else if (event.step === "error") {
          setStatus("error");
          source.close();
        }
      } catch {
        // Ignore malformed events
      }
    };

    source.onerror = () => {
      setStatus("error");
      source.close();
    };

    return () => {
      source.close();
    };
  }, [sessionId]);

  return { events, status, reset };
}
