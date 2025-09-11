import type { PaymentsClient } from "@app/domain";

/**
 * HTTP-based PaymentsClient implementation calling existing /api endpoints.
 * Sends Authorization and X-Plan-Id headers (compatible with current apps).
 */
export class HttpPaymentsClient implements PaymentsClient {
  constructor(private baseUrl: string = "/") {}

  private headers(apiKey?: string, planId?: string): HeadersInit {
    return {
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      ...(planId ? { "X-Plan-Id": planId } : {}),
    } as HeadersInit;
  }

  async getUserCredits(apiKey: string, planId: string): Promise<number> {
    const resp = await fetch(new URL("/api/credit", this.baseUrl).toString(), {
      headers: this.headers(apiKey, planId),
    });
    if (!resp.ok) throw new Error("Failed to fetch credit");
    const data = await resp.json();
    return typeof data.credit === "number" ? data.credit : 0;
  }

  async getPlanCost(
    apiKey: string,
    planId: string
  ): Promise<{ planPrice: string; planCredits: number }> {
    const resp = await fetch(
      new URL("/api/plan/cost", this.baseUrl).toString(),
      {
        headers: this.headers(apiKey, planId),
      }
    );
    if (!resp.ok) throw new Error("Failed to get plan cost");
    return await resp.json();
  }

  async orderPlanCredits(
    planId: string,
    apiKey: string
  ): Promise<{
    success: boolean;
    txHash?: string;
    credits?: string;
    message: string;
  }> {
    const resp = await fetch(
      new URL("/api/order-plan", this.baseUrl).toString(),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...this.headers(apiKey, planId),
        },
      }
    );
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      return { success: false, message: data.error || "Failed to order plan" };
    }
    return await resp.json();
  }

  async redeemCredits(
    planId: string,
    amount: string,
    apiKey: string
  ): Promise<{ success: boolean; txHash?: string; message: string }> {
    const resp = await fetch(
      new URL("/api/burn-credits", this.baseUrl).toString(),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...this.headers(apiKey, planId),
        },
        body: JSON.stringify({ credits: Number(amount) }),
      }
    );
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      return {
        success: false,
        message: data.error || "Failed to burn credits",
      };
    }
    return await resp.json();
  }
}

export type { PaymentsClient };
