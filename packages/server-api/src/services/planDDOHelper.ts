/**
 * Helper class to extract and cache plan DDO data and provide utility methods.
 */
export class PlanDDOHelper {
  public payments: any;
  public planId: string;
  private ddo: any | undefined;
  private usdcAddress = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

  constructor(payments: any, planId: string) {
    this.payments = payments;
    this.planId = planId;
    this.ddo = undefined;
  }

  async loadDDO() {
    if (!this.ddo) {
      this.ddo = await this.payments.plans.getPlan(this.planId);
    }
    return this.ddo;
  }

  async getTokenAddress(): Promise<string | undefined> {
    const ddo = await this.loadDDO();
    return ddo?.registry?.price?.tokenAddress;
  }

  async getPlanPrice(): Promise<string> {
    const ddo = await this.loadDDO();
    const weiPrice = ddo?.registry?.price?.amounts
      ?.reduce((acc: number, curr: number) => Number(acc) + Number(curr), 0)
      .toString();
    if (ddo?.registry?.price?.tokenAddress === this.usdcAddress) {
      return (weiPrice / 10 ** 6).toString();
    }
    return weiPrice;
  }

  async getPlanCredits(): Promise<number> {
    const ddo = await this.loadDDO();
    return ddo?.registry?.credits?.amount || 0;
  }

  async getAgentWallet(): Promise<string | undefined> {
    const ddo = await this.loadDDO();
    return ddo?.publicKey?.[0]?.owner;
  }

  async getTokenId(): Promise<string> {
    return this.planId;
  }

  async get1155ContractAddress(): Promise<string | undefined> {
    const ddo = await this.loadDDO();
    return ddo?.registry?.credits?.nftAddress;
  }
}
