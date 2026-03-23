/// PassiveLP Agent — Conservative strategy
///
/// Strategy: Provide liquidity and earn fees
/// - Allocates ~50% of capital to USDC/WOKB liquidity provision
/// - Holds remaining 50% as idle USDC
/// - No borrowing; minimal leverage
/// - Low risk, consistent but modest returns
/// - Success metric: Accumulate ≥10% returns from fees
/// - CP-013: Creates bounties to incentivize trading volume on pools

import { Signer } from "ethers";
import { ethers } from "ethers";
import { BaseAgent } from "./base-agent";
import { GameState, Action } from "../sdk/types";
import { encodeModifyLiquidity } from "../sdk/router";
import { OPCODES } from "../sdk/opcodes";
import { BountyClient, createBounty, getRoundBounties } from "../sdk/bounty";
import type { BountyCondition } from "../sdk/types";

export class AgentPassiveLP extends BaseAgent {
  private bountyClient: BountyClient | null = null;
  private bountyAddress: string = "";
  private usdcAddress: string = "";
  
  // Bounty configuration (CP-013)
  private readonly BOUNTY_THRESHOLD = 5000n * 10n ** 6n; // 5000 USDC idle threshold
  private readonly MAX_ACTIVE_BOUNTIES = 2;
  private lastBountyId: bigint | null = null;
  private bountyCreatedTime: number = 0;

  constructor(
    agentAddress: string,
    initialAllocation: bigint,
    arenaAddress: string,
    signer: Signer,
    bountyAddress?: string,
    usdcAddress?: string
  ) {
    super("PassiveLP", agentAddress, initialAllocation, arenaAddress, signer);
    
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

  /// @notice PassiveLP strategy: Provide liquidity, earn fees
  async decideAction(state: GameState): Promise<Action[]> {
    const actions: Action[] = [];

    // Allocate ~50% of remaining capital to liquidity
    const liquidityAmount = this.initialAllocation / 2n;

    // Action: Provide liquidity to USDC/WOKB pool
    // Parameters:
    // - vaultId: agent's vault
    // - deltaLiquidity: amount to add (in terms of LP shares)
    // - recipient: agent address (receives LP position NFT)
    // - minDeltaShares: slippage protection
    // - lowerTick, upperTick: full-range liquidity [-887272, 887272]
    const liquidityAction = encodeModifyLiquidity({
      vaultId: this.vaultId,
      deltaLiquidity: liquidityAmount as any,
      recipient: this.agentAddress,
      minDeltaShares: 0n,
      lowerTick: -887272, // Full range lower bound
      upperTick: 887272, // Full range upper bound
    });

    actions.push({
      opcode: OPCODES.AE_MODIFY_LIQUIDITY,
      params: [],
    });

    // Remaining 50% stays as idle USDC (no action required)
    // This provides a conservative fallback if swaps execute unfavorably

    console.log(
      `PassiveLP: providing ${liquidityAmount / 10n ** 6n} USDC as liquidity`
    );

    // CP-013: Create bounties to incentivize trading volume (Bounty Bonds)
    // WHAT: Post USDC rewards for other agents to claim if they trade volume
    // WHY: Generates trading volume that PassiveLP profits from via fees
    await this.createBountiesIfIdle(state);

    return actions;
  }

  /// @notice CP-013: Create bounties when idle USDC balance is high
  /// WHAT: Posts bounties to incentivize TrendFollower/Predator to trade
  /// WHY: Excess liquidity earns bounty rewards; attracts volume to our pools
  private async createBountiesIfIdle(state: GameState): Promise<void> {
    if (!this.bountyClient) {
      // Bounty contract not initialized; skip silently
      return;
    }

    try {
      const idleUsdc = await this.getIdleUsdcBalance(state);
      const roundId = BigInt(state.roundId || 1);

      if (idleUsdc <= this.BOUNTY_THRESHOLD) {
        console.log(
          `[PassiveLP-Bounty] Idle USDC too low (${idleUsdc / 10n ** 6n} < ${this.BOUNTY_THRESHOLD / 10n ** 6n}); skipping bounty creation`
        );
        return;
      }

      // Check how many bounties are already active
      const activeBounties = await getRoundBounties(this.bountyClient, roundId);
      if (activeBounties.length >= this.MAX_ACTIVE_BOUNTIES) {
        console.log(
          `[PassiveLP-Bounty] Already have ${activeBounties.length} active bounties; skipping creation`
        );
        return;
      }

      // Create a bounty with 10% of idle balance as reward
      const bountyReward = idleUsdc / 10n;

      // Condition: 1000 USDC volume, price within ±5%, 100-block window
      const condition: BountyCondition = {
        minVolumeUsdc: 1000n * 10n ** 6n, // 1000 USDC min volume
        targetPriceMin: 950000000n, // Mock sqrtPriceX96: ~0.95
        targetPriceMax: 1050000000n, // Mock sqrtPriceX96: ~1.05 (+/- 5%)
        windowBlocks: 100n, // 100 blocks (~30 min on Ethereum)
      };

      const { bountyId } = await createBounty(
        this.bountyClient,
        roundId,
        bountyReward,
        condition
      );

      console.log(
        `[PassiveLP-Bounty] Created bounty ${bountyId} — reward ${bountyReward / 10n ** 6n} USDC for 1000 USDC trade volume`
      );

      this.lastBountyId = bountyId;
      this.bountyCreatedTime = Date.now();
    } catch (error) {
      console.error(`[PassiveLP-Bounty] Failed to create bounty:`, error);
      // Don't fail the entire performAction; continue with LP logic
    }
  }

  /// @notice Get idle USDC balance
  /// In production: query vault via AEGIS Engine
  /// For MVP: return mock value based on state
  private async getIdleUsdcBalance(state: GameState): Promise<bigint> {
    // Stub: return 50% of initial allocation (represents idle balance)
    // In production: would query actual vault idle balance via Arena contract
    return this.initialAllocation / 2n;
  }

  /// @notice Check performance vs benchmark
  evaluatePerformance(finalScore: bigint, initialCapital: bigint): boolean {
    const returnPercent =
      ((finalScore - initialCapital) * 100n) / initialCapital;
    const meetsTarget = returnPercent >= 10n; // 10% return target

    console.log(
      `PassiveLP performance: ${returnPercent}% return (target: ≥10%)`
    );
    return meetsTarget;
  }
}
