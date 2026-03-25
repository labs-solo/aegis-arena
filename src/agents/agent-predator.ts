// src/agents/agent-predator.ts
// CP-020: rebalanceDelta() wired into decideActions (SRC-HIGH-06)
// CP-020: Provider injection
//
// Strategy: Delta-neutral positioning + volatility arbitrage.

import { ethers } from "ethers";
import { BaseAgent } from "./base-agent.js";
import { GameState } from "../orchestrator/types.js";
import { encodeModifyLiquidity } from "../sdk/router.js";

export class AgentPredator extends BaseAgent {
  private provider: ethers.Provider;
  private readonly DELTA_THRESHOLD_PCT = 5n; // 5% delta drift triggers rebalance

  constructor(agentAddress: string, provider: ethers.Provider) {
    super("Predator", agentAddress);
    this.provider = provider;
  }

  async decideActions(state: GameState): Promise<string[]> {
    const actions: string[] = [];

    // Provide concentrated liquidity around current price
    const centerTick = 0;
    const rangeTicks = 100;
    const deployAmount = BigInt("150000000"); // 150 USDC equivalent

    const liquidityAction = encodeModifyLiquidity({
      vaultId: state.agentVaultId.toString(),
      deltaLiquidity: deployAmount as unknown as bigint,
      recipient: this.agentAddress,
      minDeltaShares: 0n,
      lowerTick: centerTick - rangeTicks,
      upperTick: centerTick + rangeTicks,
    });
    actions.push(liquidityAction);

    // Rebalance if delta has drifted (SRC-HIGH-06 — wired into decision flow)
    const rebalanceActions = await this.rebalanceDelta(state);
    actions.push(...rebalanceActions);

    console.log(`[Predator] ${actions.length} action(s): liquidity + ${rebalanceActions.length} rebalance`);
    return actions;
  }

  /**
   * Calculate and encode delta rebalance actions if drift exceeds threshold.
   * Returns encoded actions; empty array if no rebalance needed.
   */
  private async rebalanceDelta(state: GameState): Promise<string[]> {
    const delta = this.calculateDelta(state);
    const portfolioValue = state.agentBalances.wokb + state.agentBalances.usdt0 + state.agentBalances.idle;

    if (portfolioValue === 0n) return [];

    const thresholdDelta = (portfolioValue * this.DELTA_THRESHOLD_PCT) / 100n;

    if (delta > thresholdDelta) {
      console.log("[Predator] Delta positive — encoding long reduction");
      return [this.encodeSmallSell()];
    } else if (delta < -thresholdDelta) {
      console.log("[Predator] Delta negative — encoding short reduction");
      return [this.encodeSmallBuy()];
    }

    return []; // delta within tolerance
  }

  private calculateDelta(state: GameState): bigint {
    // Stub: Phase 2 computes real delta from vault positions
    return 0n;
  }

  private encodeSmallSell(): string {
    return ethers.AbiCoder.defaultAbiCoder().encode(
      ["bytes4", "string"],
      ["0x11223344", "small_sell_stub"]
    );
  }

  private encodeSmallBuy(): string {
    return ethers.AbiCoder.defaultAbiCoder().encode(
      ["bytes4", "string"],
      ["0x55667788", "small_buy_stub"]
    );
  }
}
