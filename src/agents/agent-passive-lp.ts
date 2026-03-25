// src/agents/agent-passive-lp.ts
// CP-020: CRIT-01 fix — getNativeBalance() uses real provider.getBalance()
// CP-020: Provider injection — no more hardcoded JsonRpcProvider()
//
// PassiveLP strategy: Full-range liquidity provision, earn trading fees + borrow interest.
// No leverage, no liquidation risk.

import { ethers } from "ethers";
import { BaseAgent } from "./base-agent.js";
import { GameState } from "../orchestrator/types.js";
import { encodeModifyLiquidity } from "../sdk/router.js";

export class AgentPassiveLP extends BaseAgent {
  private provider: ethers.Provider;  // INJECTED — never new JsonRpcProvider()
  private readonly MIN_OKB_REQUIRED = ethers.parseEther("5");
  private readonly MIN_TICK = -887272;
  private readonly MAX_TICK = 887272;

  constructor(agentAddress: string, provider: ethers.Provider) {
    super("PassiveLP", agentAddress);
    this.provider = provider;
  }

  async decideActions(state: GameState): Promise<string[]> {
    // CRIT-01 FIX: check real balance (not hardcoded 0n)
    const isReady = await this.checkFundingReady();
    if (!isReady) {
      console.log(`[PassiveLP] Balance below threshold; waiting for funding`);
      return [];
    }

    const vaultId = state.agentVaultId.toString();
    const liquidityAmount = BigInt("100000000000000000000"); // 100 units

    const encoded = encodeModifyLiquidity({
      vaultId,
      deltaLiquidity: liquidityAmount as unknown as bigint,
      recipient: this.agentAddress,
      minDeltaShares: 0n,
      lowerTick: this.MIN_TICK,
      upperTick: this.MAX_TICK,
    });

    console.log(`[PassiveLP] Deploying full-range liquidity [${this.MIN_TICK}, ${this.MAX_TICK}]`);
    return [encoded];
  }

  /**
   * CRIT-01 FIX: Real provider.getBalance() — not hardcoded 0n.
   * The old code returned 0n unconditionally, causing PassiveLP to
   * always skip its funding check and never deploy liquidity.
   */
  private async checkFundingReady(): Promise<boolean> {
    try {
      const balance = await this.provider.getBalance(this.agentAddress);
      const hasEnough = balance >= this.MIN_OKB_REQUIRED;
      console.log(
        `[PassiveLP] OKB balance: ${ethers.formatEther(balance)} (required ≥ ${ethers.formatEther(this.MIN_OKB_REQUIRED)}) — ${hasEnough ? "READY" : "WAITING"}`
      );
      return hasEnough;
    } catch (e) {
      console.error("[PassiveLP] Balance check failed:", e);
      return false;
    }
  }
}
