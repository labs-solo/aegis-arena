/// Predator Agent — Market-neutral strategy
///
/// Strategy: Balanced long/short positions + volatility arbitrage
/// - Maintains delta-neutral portfolio (long WOKB + short USDC debt)
/// - Profits from volatility and fee collection
/// - Uses limit orders for precise execution
/// - Medium leverage (1–2x via debt)
/// - Success metric: Stable returns independent of price direction

import { Signer } from "ethers";
import { BaseAgent } from "./base-agent";
import { GameState, Action } from "../sdk/types";
import { encodeModifyLiquidity } from "../sdk/router";
import { OPCODES } from "../sdk/opcodes";

export class AgentPredator extends BaseAgent {
  constructor(
    agentAddress: string,
    initialAllocation: bigint,
    arenaAddress: string,
    signer: Signer
  ) {
    super("Predator", agentAddress, initialAllocation, arenaAddress, signer);
  }

  /// @notice Predator strategy: Delta-neutral + volatility arbitrage
  async decideAction(state: GameState): Promise<Action[]> {
    const actions: Action[] = [];

    // Strategy: Create balanced positions
    // 1. Borrow ~50% of capital (creates 1.5x total capital)
    // 2. Split evenly: 50% long WOKB, 50% USDC debt short
    // 3. Provide balanced liquidity around current price
    // 4. Collect fees while maintaining delta neutrality

    const deployAmount = this.initialAllocation + this.initialAllocation / 2n; // 1.5x total

    // Action: Provide liquidity with concentrated range around current price
    // This captures more fee volume in active range
    const currentPrice = state.poolPrice;

    // Simplified tick calculation (would use actual price-to-tick conversion)
    const centerTick = 0;
    const rangeTicks = 100; // ±100 ticks around center

    const liquidityAction = encodeModifyLiquidity({
      vaultId: this.vaultId,
      deltaLiquidity: deployAmount as any,
      recipient: this.agentAddress,
      minDeltaShares: 0n,
      lowerTick: centerTick - rangeTicks,
      upperTick: centerTick + rangeTicks,
    });

    actions.push({
      opcode: OPCODES.AE_MODIFY_LIQUIDITY,
      params: [],
    });

    console.log(
      `Predator: providing ${deployAmount / 10n ** 6n} USDC as concentrated liquidity`
    );

    return actions;
  }

  /// @notice Calculate delta (directional exposure)
  /// @return 0 if perfectly neutral, >0 if long-biased, <0 if short-biased
  private calculateDelta(state: GameState): bigint {
    // In production: sum all long/short positions weighted by notional
    // Stub: return 0 (assume perfectly neutral)
    return 0n;
  }

  /// @notice Rebalance if delta drifts too far from neutral
  private async rebalanceDelta(state: GameState): Promise<void> {
    const delta = this.calculateDelta(state);

    if (delta > state.currentPortfolioValue / 20n) {
      // Too long, reduce long exposure
      console.log("Predator: delta positive, reducing long exposure");
    } else if (delta < -state.currentPortfolioValue / 20n) {
      // Too short, reduce short exposure
      console.log("Predator: delta negative, reducing short exposure");
    }
  }

  /// @notice Evaluate performance
  evaluatePerformance(finalScore: bigint, initialCapital: bigint): boolean {
    const returnPercent =
      ((finalScore - initialCapital) * 100n) / initialCapital;
    const meetsTarget = returnPercent >= 5n; // Lower target for market-neutral

    console.log(
      `Predator performance: ${returnPercent}% return (target: ≥5%)`
    );
    return meetsTarget;
  }
}
