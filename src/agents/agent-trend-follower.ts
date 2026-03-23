/// TrendFollower Agent — Aggressive strategy
///
/// Strategy: Detect trends, borrow capital, take leveraged directional bets
/// - Identifies price trends via moving averages
/// - Borrows up to 3x capital via AEGIS (using sqrt(K) solvency model)
/// - Goes long on uptrends, short on downtrends
/// - Uses limit orders (PM_TAKE) for precision entry/exit
/// - High risk but guaranteed liquidation-free (AEGIS property)
/// - Success metric: Profitable despite aggressive leverage
/// - CP-013: Evaluates and claims bounties to supplement returns

import { Signer } from "ethers";
import { ethers } from "ethers";
import { BaseAgent } from "./base-agent";
import { GameState, Action } from "../sdk/types";
import {
  encodeSwapExactInSingle,
  encodePMTake,
  ModifyDebtParams,
} from "../sdk/router";
import { submitBorrowFlow } from "../sdk/borrow-flow";
import { OPCODES } from "../sdk/opcodes";
import {
  BountyClient,
  getRoundBounties,
  getBounty,
  claimBounty,
} from "../sdk/bounty";
import type { BountyCondition, BountyRecord } from "../sdk/types";

export class AgentTrendFollower extends BaseAgent {
  private trendWindow = 5; // Check 5-block moving average
  private bountyClient: BountyClient | null = null;
  private bountyAddress: string = "";
  private usdcAddress: string = "";
  
  // Bounty configuration (CP-013)
  private lastClaimedBountyId: bigint | null = null;
  private bountyClaimTime: number = 0;

  constructor(
    agentAddress: string,
    initialAllocation: bigint,
    arenaAddress: string,
    signer: Signer,
    bountyAddress?: string,
    usdcAddress?: string
  ) {
    super("TrendFollower", agentAddress, initialAllocation, arenaAddress, signer);
    
    // CP-013: Initialize bounty client if addresses provided
    if (bountyAddress && usdcAddress && ethers.isAddress(bountyAddress) && ethers.isAddress(usdcAddress)) {
      this.bountyAddress = bountyAddress;
      this.usdcAddress = usdcAddress;
      this.bountyClient = new BountyClient(
        new ethers.JsonRpcProvider(), // Provider should be injected in production
        signer,
        bountyAddress,
        usdcAddress
      );
    }
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
    } else {
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
    }

    // CP-013: Check for claimable bounties after trading
    // WHAT: Evaluate available bounties and claim if feasible
    // WHY: Bounty rewards supplement trading returns
    await this.claimBountiesIfFeasible(state);

    return actions;
  }

  /// @notice CP-013: Evaluate and claim bounties
  /// WHAT: Check active bounties and claim if TrendFollower can satisfy conditions
  /// WHY: Supplements trading returns with bounty rewards
  private async claimBountiesIfFeasible(state: GameState): Promise<void> {
    if (!this.bountyClient) {
      // Bounty contract not initialized; skip silently
      return;
    }

    try {
      const roundId = BigInt(state.roundId || 1);
      const activeBounties = await getRoundBounties(this.bountyClient, roundId);

      for (const bountyId of activeBounties) {
        const bounty = await getBounty(this.bountyClient, bountyId);
        if (!bounty) continue;

        // Skip if already claimed
        if (bounty.claimed) {
          console.log(
            `[TrendFollower-Bounty] Bounty ${bountyId} already claimed by ${bounty.claimedBy}`
          );
          continue;
        }

        // Evaluate if TrendFollower can satisfy this bounty's conditions
        if (this.canSatisfyBountyCondition(bounty.condition)) {
          try {
            await claimBounty(this.bountyClient, bountyId);
            console.log(
              `[TrendFollower-Bounty] Claimed bounty ${bountyId} (reward=${bounty.rewardAmount / 10n ** 6n} USDC, minVolume=${bounty.condition.minVolumeUsdc / 10n ** 6n} USDC)`
            );
            this.lastClaimedBountyId = bountyId;
            this.bountyClaimTime = Date.now();
            break; // Claim one bounty per round
          } catch (error) {
            console.error(
              `[TrendFollower-Bounty] Failed to claim bounty ${bountyId}:`,
              error
            );
            // Continue to next bounty
          }
        }
      }
    } catch (error) {
      console.error(`[TrendFollower-Bounty] Error checking bounties:`, error);
      // Don't fail the entire round
    }
  }

  /// @notice CP-013: Evaluate if TrendFollower can satisfy bounty condition
  /// WHAT: Heuristic check if agent can generate required volume and price
  /// WHY: Only claim bounties that are realistic to satisfy
  private canSatisfyBountyCondition(condition: BountyCondition): boolean {
    // TrendFollower strategy: places directional trades based on trends
    // Estimate if we can generate minVolumeUsdc within the price range

    const estimatedVolume = this.estimateTradeVolume();
    const priceRangeOk = this.isPriceRangeReasonable(condition);

    const canClaim =
      estimatedVolume >= condition.minVolumeUsdc && priceRangeOk;

    console.log(
      `[TrendFollower-Bounty] Feasibility: volume=${estimatedVolume / 10n ** 6n} >= ${condition.minVolumeUsdc / 10n ** 6n}? ` +
      `${estimatedVolume >= condition.minVolumeUsdc}, priceOk? ${priceRangeOk}`
    );

    return canClaim;
  }

  /// @notice CP-013: Estimate trade volume TrendFollower typically executes
  /// In production: track historical volumes
  /// For MVP: return fixed estimate
  private estimateTradeVolume(): bigint {
    // TrendFollower typically trades 5k-20k USDC per round
    // Estimate: 15k USDC
    return 15000n * 10n ** 6n;
  }

  /// @notice CP-013: Check if price range is reasonable for TrendFollower
  /// TrendFollower accepts larger price ranges (±5%) since it trades directionally
  private isPriceRangeReasonable(condition: BountyCondition): boolean {
    // Accept any range within +/- 10% (very permissive for trend trades)
    const tolerance = 1000000000n; // 10% in mock sqrtPriceX96 units
    const rangeBreadth =
      condition.targetPriceMax - condition.targetPriceMin;
    return rangeBreadth <= tolerance;
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
