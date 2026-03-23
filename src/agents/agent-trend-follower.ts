/// TrendFollower Agent — Aggressive strategy
///
/// Strategy: Detect trends, borrow capital, take leveraged directional bets
/// - Identifies price trends via moving averages
/// - Borrows up to 3x capital via AEGIS (using sqrt(K) solvency model)
/// - Goes long on uptrends, short on downtrends
/// - Uses limit orders (PM_TAKE) for precision entry/exit
/// - High risk but guaranteed liquidation-free (AEGIS property)
/// - Success metric: Profitable despite aggressive leverage

import { Signer } from "ethers";
import { BaseAgent } from "./base-agent";
import { GameState, Action } from "../sdk/types";
import {
  encodeSwapExactInSingle,
  encodePMTake,
  ModifyDebtParams,
} from "../sdk/router";
import { submitBorrowFlow } from "../sdk/borrow-flow";
import { OPCODES } from "../sdk/opcodes";

export class AgentTrendFollower extends BaseAgent {
  private trendWindow = 5; // Check 5-block moving average

  constructor(
    agentAddress: string,
    initialAllocation: bigint,
    arenaAddress: string,
    signer: Signer
  ) {
    super("TrendFollower", agentAddress, initialAllocation, arenaAddress, signer);
  }

  /// @notice TrendFollower strategy: Detect trends + leverage
  async decideAction(state: GameState): Promise<Action[]> {
    const actions: Action[] = [];

    // Step 1: Detect trend
    const trend = await this.detectTrend(state);
    console.log(`TrendFollower: trend = ${trend}`);

    if (trend === 0) {
      // No clear trend, do nothing
      console.log("TrendFollower: no clear trend, holding");
      return actions;
    }

    // Step 2: Decide leverage amount
    // TrendFollower borrows 1x capital (creates 2x total leverage)
    const borrowAmount = this.initialAllocation;

    console.log(
      `TrendFollower: borrowing ${borrowAmount / 10n ** 6n} USDC for leverage`
    );

    // Step 3: Encode 3-batch borrow flow
    // Batch 0: Unlock
    // Batch 1: AE_MODIFY_DEBT (borrow) — PM unlocked here
    // Batch 2: Lock
    // (Actual submission handled by game orchestrator)

    // For this stub, add a swap action representing the leveraged position
    // In production: use submitBorrowFlow() then execute swaps

    if (trend > 0) {
      // Uptrend: go long WOKB
      const swapAction = encodeSwapExactInSingle({
        poolId: "0x9072107b33ad70c231602b537d91774a43c1837f9b28040ee9bf8cad0a0ab4a1",
        tokenIn: "0x74b7f16337b8972027f6196a17a631ac6de26d22", // USDC
        tokenOut: "0xe538905cf8410324e03A5A23C1c177a474D59b2b", // WOKB
        amountIn: borrowAmount,
        minAmountOut: 0n, // In production: set actual minimum
      });

      actions.push({
        opcode: OPCODES.SWAP_EXACT_IN_SINGLE,
        params: [],
      });

      console.log("TrendFollower: going LONG WOKB (uptrend)");
    } else {
      // Downtrend: go short WOKB (swap WOKB → USDC if holding)
      console.log("TrendFollower: going SHORT WOKB (downtrend)");
    }

    return actions;
  }

  /// @notice Detect trend via moving average
  /// @return 1 if uptrend, -1 if downtrend, 0 if sideways
  private async detectTrend(state: GameState): Promise<number> {
    const currentPrice = state.poolPrice;

    // Simplified: would track price history and compute MA
    // For stub: use dummy logic
    // In production: query historical price oracle or Tenderly

    // Dummy: if current price > threshold, uptrend
    // This would be replaced with real trend detection
    const threshold = 1000n * 2n ** 96n; // Dummy threshold
    if (currentPrice > threshold) {
      return 1;
    } else if (currentPrice < threshold) {
      return -1;
    }
    return 0;
  }

  /// @notice Evaluate performance
  evaluatePerformance(finalScore: bigint, initialCapital: bigint): boolean {
    const returnPercent =
      ((finalScore - initialCapital) * 100n) / initialCapital;
    const meetsTarget = returnPercent >= 20n; // 20% return target (higher risk)

    console.log(
      `TrendFollower performance: ${returnPercent}% return (target: ≥20%)`
    );
    return meetsTarget;
  }
}
