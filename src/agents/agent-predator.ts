/// Predator Agent — Market-neutral strategy
///
/// Strategy: Balanced long/short positions + volatility arbitrage
/// - Maintains delta-neutral portfolio (long WOKB + short USDC debt)
/// - Profits from volatility and fee collection
/// - Uses limit orders for precise execution
/// - Medium leverage (1–2x via debt)
/// - Success metric: Stable returns independent of price direction
/// - CP-013: Claims bounties conservatively (tight price ranges)

import { Signer } from "ethers";
import { ethers } from "ethers";
import { BaseAgent } from "./base-agent";
import { GameState, Action } from "../sdk/types";
import { encodeModifyLiquidity } from "../sdk/router";
import { OPCODES } from "../sdk/opcodes";
import {
  BountyClient,
  getRoundBounties,
  getBounty,
  claimBounty,
} from "../sdk/bounty";
import type { BountyCondition, BountyRecord } from "../sdk/types";

export class AgentPredator extends BaseAgent {
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
    super("Predator", agentAddress, initialAllocation, arenaAddress, signer);
    
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

    // CP-013: Check for claimable bounties with conservative filters
    // WHAT: Evaluate available bounties and claim only tight price-range bounties
    // WHY: Bounty rewards supplement volatility harvesting; Predator is risk-averse
    await this.claimBountiesConservatively(state);

    return actions;
  }

  /// @notice CP-013: Evaluate and claim bounties (conservative version)
  /// WHAT: Check active bounties and claim only if price range is tight
  /// WHY: Predator's delta-neutral strategy needs strict price constraints
  private async claimBountiesConservatively(state: GameState): Promise<void> {
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
            `[Predator-Bounty] Bounty ${bountyId} already claimed by ${bounty.claimedBy}`
          );
          continue;
        }

        // Evaluate if Predator can satisfy (conservative constraints)
        if (this.canSatisfyBountyConditionConservatively(bounty.condition)) {
          try {
            await claimBounty(this.bountyClient, bountyId);
            console.log(
              `[Predator-Bounty] Claimed bounty ${bountyId} (reward=${bounty.rewardAmount / 10n ** 6n} USDC, price range=[${bounty.condition.targetPriceMin}, ${bounty.condition.targetPriceMax}])`
            );
            this.lastClaimedBountyId = bountyId;
            this.bountyClaimTime = Date.now();
            break; // Claim one bounty per round
          } catch (error) {
            console.error(
              `[Predator-Bounty] Failed to claim bounty ${bountyId}:`,
              error
            );
            // Continue to next bounty
          }
        }
      }
    } catch (error) {
      console.error(
        `[Predator-Bounty] Error checking bounties:`,
        error
      );
      // Don't fail the entire round
    }
  }

  /// @notice CP-013: Evaluate if Predator can satisfy bounty condition (conservative)
  /// WHAT: Stricter feasibility check for delta-neutral positioning
  /// WHY: Predator only claims bounties with tight price constraints
  private canSatisfyBountyConditionConservatively(
    condition: BountyCondition
  ): boolean {
    // Predator strategy: delta-neutral, stable returns
    // More conservative than TrendFollower; prefers narrow price ranges

    const estimatedVolume = this.estimateTradeVolume();
    const priceRangeOk = this.isPriceRangeCompatible(condition);

    const canClaim =
      estimatedVolume >= condition.minVolumeUsdc && priceRangeOk;

    console.log(
      `[Predator-Bounty] Feasibility: volume=${estimatedVolume / 10n ** 6n} >= ${condition.minVolumeUsdc / 10n ** 6n}? ` +
      `${estimatedVolume >= condition.minVolumeUsdc}, priceOk? ${priceRangeOk}`
    );

    return canClaim;
  }

  /// @notice CP-013: Estimate trade volume Predator typically executes
  /// Predator trades smaller volumes (fee collection + hedges)
  private estimateTradeVolume(): bigint {
    // Predator typically executes 5k-10k USDC per round
    // Estimate: 8k USDC
    return 8000n * 10n ** 6n;
  }

  /// @notice CP-013: Check if price range is compatible (conservative)
  /// Predator requires tight price range (±2% tolerance)
  private isPriceRangeCompatible(condition: BountyCondition): boolean {
    // Predator requires tight price range: ±2% tolerance
    const tolerance = 200000000n; // 2% in mock sqrtPriceX96 units
    const rangeBreadth =
      condition.targetPriceMax - condition.targetPriceMin;
    return rangeBreadth <= tolerance;
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
