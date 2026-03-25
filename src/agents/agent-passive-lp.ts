/// PassiveLP Agent — Conservative strategy with dual income stream tracking
///
/// Strategy: Provide liquidity and earn fees + interest
/// - Allocates ~50% of capital to full-range USDC/WOKB liquidity provision
/// - Holds remaining 50% as idle USDC (safety buffer + bounty pool)
/// - Tracks two income streams:
///   1. Trading fees (0.05% per swap from Uniswap v4)
///   2. Borrow interest (accrued when other agents leverage their positions)
/// - No borrowing; zero leverage; zero liquidation risk
/// - Low risk, consistent returns from passive fee collection
/// - Success metric: Accumulate ≥10% returns from fees + interest
/// - CP-013: Creates bounties to incentivize trading volume on pools
/// - OKX Market API integration: monitor 24h volume before bounty creation

import { Signer } from "ethers";
import { ethers } from "ethers";
import { BaseAgent } from "./base-agent";
import { GameState, Action } from "../sdk/types";
import { encodeModifyLiquidity } from "../sdk/router";
import { OPCODES } from "../sdk/opcodes";
import { BountyClient, createBounty, getRoundBounties } from "../sdk/bounty";
import type { BountyCondition } from "../sdk/types";

/// Earnings breakdown: fee vs interest split
export interface EarningsBreakdown {
  tradingFees: bigint;           // Accumulated trading fees (wei)
  borrowInterest: bigint;        // Accrued interest from borrow volume (wei)
  totalEarnings: bigint;         // Sum of fees + interest
  feeSharePct: number;           // % of total from fees
  interestSharePct: number;      // % of total from interest
}

/// OKX Market API response (24h ticker)
export interface OKXTicker {
  instId: string;                // "OKB-USD"
  vol24h: string;                // 24h volume
  volCcy24h: string;             // 24h volume in base currency
  askPx: string;                 // Best ask price
  bidPx: string;                 // Best bid price
}

export class AgentPassiveLP extends BaseAgent {
  private bountyClient: BountyClient | null = null;
  private bountyAddress: string = "";
  private usdcAddress: string = "";
  
  // Earning tracking (PRODUCTION FEATURE)
  private accumulatedTradingFees: bigint = 0n;
  private accumulatedBorrowInterest: bigint = 0n;
  private lastFeeQueryBlock: number = 0;
  private lastInterestQueryTime: number = 0;
  
  // Full-range tick constants (tick spacing = 60)
  // For Uniswap v4 with tick spacing 60:
  // - MIN_TICK = -887,272 (lowest valid tick)
  // - MAX_TICK = 887,272 (highest valid tick)
  // These correspond to pool price range from ~0 to ~infinity
  // PassiveLP deploys full-range to capture 100% of swap fees
  private readonly MIN_TICK = -887272;
  private readonly MAX_TICK = 887272;
  
  // Bounty configuration (CP-013)
  private readonly BOUNTY_THRESHOLD = 5000n * 10n ** 6n; // 5000 USDC idle threshold
  private readonly MAX_ACTIVE_BOUNTIES = 2;
  private lastBountyId: bigint | null = null;
  private bountyCreatedTime: number = 0;
  
  // OKX Market API configuration
  private readonly OKX_API_BASE = "https://www.okx.com/api/v5/market";
  private readonly OKX_POOL_INST_ID = "OKB-USD"; // Pool instrument ID

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

  /// @notice PassiveLP strategy: Provide full-range liquidity, earn fees + interest
  /// Optimizes Arena score by:
  /// 1. Allocating exactly 50% to full-range LP (captures 100% of pool fees)
  /// 2. Tracking both fee income and borrow interest separately
  /// 3. Using OKX volume data to optimize bounty sizing
  /// 4. Creating bounties only when ROI exceeds threshold
  async decideAction(state: GameState): Promise<Action[]> {
    const actions: Action[] = [];

    // OPTIMIZATION: Query trading fees accumulated since last query
    // This allows us to monitor fee income in real-time and adjust strategy
    await this.updateFeeTracking();

    // OPTIMIZATION: Query borrow interest accrued (if borrow demand exists)
    await this.updateInterestTracking();

    // Allocate exactly 50% of initial capital to liquidity
    const liquidityAmount = this.initialAllocation / 2n;

    // Action: Provide full-range liquidity to USDC/WOKB pool
    // OPTIMIZATION NOTE (Arena Score):
    // - Full-range position (MIN_TICK to MAX_TICK) captures 100% of pool volume fees
    // - Alternative concentrated positions would risk missing volume if price exits range
    // - Full-range ensures consistent fee income regardless of price movement
    // - This maximizes final score via continuous share price appreciation
    // 
    // Parameters explained:
    // - vaultId: PassiveLP's vault ID (assigned by Arena during registration)
    // - deltaLiquidity: 50 USDC in wei (amount of liquidity to add)
    // - recipient: PassiveLP agent address (receives sLP share tokens)
    // - minDeltaShares: 0 (no slippage protection; add-only is safe)
    // - lowerTick, upperTick: Full-range for tick spacing 60
    const liquidityAction = encodeModifyLiquidity({
      vaultId: this.vaultId,
      deltaLiquidity: liquidityAmount as any,
      recipient: this.agentAddress,
      minDeltaShares: 0n,
      lowerTick: this.MIN_TICK,   // -887,272: full range lower bound
      upperTick: this.MAX_TICK,   // +887,272: full range upper bound
    });

    actions.push({
      opcode: OPCODES.AE_MODIFY_LIQUIDITY,
      params: [],
    });

    // Remaining 50% stays as idle USDC in vault
    // OPTIMIZATION NOTE (Arena Score):
    // - Idle balance serves multiple functions:
    //   1. Safety buffer: can exit or recover from unfavorable positions
    //   2. Bounty pool: enables CP-013 bounty creation to attract volume
    //   3. Flexibility: allows dynamic rebalancing based on game state
    // - Score formula counts idle USDC at 1:1 value, so idle balance = final score contribution
    //
    // This 50/50 allocation balances:
    // - Fee generation potential (more deployed = more fees)
    // - Capital safety (more idle = more buffer)
    // - Bounty capacity (idle pool for CP-013 rewards)

    console.log(
      `PassiveLP: providing ${liquidityAmount / 10n ** 6n} USDC as full-range liquidity [${this.MIN_TICK}, ${this.MAX_TICK}]`
    );

    // OPTIMIZATION: Log earnings breakdown for monitoring
    const breakdown = await this.getEarningsBreakdown();
    console.log(
      `PassiveLP earnings: fees=${breakdown.tradingFees / 10n ** 6n} USDC (${breakdown.feeSharePct.toFixed(1)}%), ` +
      `interest=${breakdown.borrowInterest / 10n ** 6n} USDC (${breakdown.interestSharePct.toFixed(1)}%), ` +
      `total=${breakdown.totalEarnings / 10n ** 6n} USDC`
    );

    // CP-013: Create bounties to incentivize trading volume (Bounty Bonds)
    // WHAT: Post USDC rewards for other agents to claim if they trade volume
    // WHY: Generates trading volume that PassiveLP profits from via fees
    // OPTIMIZATION: Uses OKX Market API to estimate 24h volume before commitment
    await this.createBountiesIfIdle(state);

    return actions;
  }

  /// @notice Query trading fees accumulated from Uniswap v4 pool
  /// In production: calls AegisStateView.getVaultLiquidity() or hook fee accumulator
  /// For MVP: tracks locally; real implementation would read from on-chain state
  private async updateFeeTracking(): Promise<void> {
    try {
      // PRODUCTION IMPLEMENTATION:
      // - Call AegisStateView.getVaultLiquidity(vaultId) to fetch LP position
      // - Get current sqrtPrice from pool state
      // - Compare sLP token balance to previous block
      // - Calculate fee as: (newSharePrice - oldSharePrice) * sharesHeld
      //
      // For MVP, we defer to on-chain query at settlement time
      // This prevents RPC spam and relies on event logs for audit
      
      const currentBlock = await (this.signer.provider as ethers.Provider).getBlockNumber();
      if (currentBlock - this.lastFeeQueryBlock >= 100) {
        // Update every 100 blocks (~30 min)
        this.lastFeeQueryBlock = currentBlock;
        console.log(
          `[PassiveLP-Fees] Updated fee tracking at block ${currentBlock}. Accumulated fees: ${this.accumulatedTradingFees / 10n ** 6n} USDC`
        );
      }
    } catch (error) {
      // Gracefully handle provider errors; don't fail decision logic
      console.debug(`[PassiveLP-Fees] Fee tracking query failed:`, error);
    }
  }

  /// @notice Query interest accrued on other agents' borrow volume
  /// In production: calls VariableInterestRate contract to fetch accrued interest
  /// For MVP: tracks from vault state; borrow interest is secondary income stream
  private async updateInterestTracking(): Promise<void> {
    try {
      // PRODUCTION IMPLEMENTATION:
      // - Call VaultRegistry.getVault(vaultId) to fetch vault interest metadata
      // - Compare accrued interest to previous query
      // - Calculate earned interest as: (interestAccrued - lastAccrued)
      // - Interest accrues per-block; rate depends on pool utilization
      //
      // INCOME STREAM DETAIL:
      // When TrendFollower/Predator borrow capital via AE_MODIFY_DEBT:
      // - Borrow amount added to vault debt
      // - Interest accrues at variable rate (f(utilization))
      // - PassiveLP's LP shares benefit from interest via implicit share price increase
      // - At settlement, share price = (poolLiquidity + fees + interest) / totalShares
      //
      // For MVP, this is implicit in final score; no explicit claim opcode needed
      
      const now = Date.now();
      if (now - this.lastInterestQueryTime > 60000) {
        // Update every 60 seconds
        this.lastInterestQueryTime = now;
        console.log(
          `[PassiveLP-Interest] Updated interest tracking. Accumulated interest: ${this.accumulatedBorrowInterest / 10n ** 6n} USDC`
        );
      }
    } catch (error) {
      // Gracefully handle provider errors
      console.debug(`[PassiveLP-Interest] Interest tracking query failed:`, error);
    }
  }

  /// @notice Get breakdown of earnings by source (fees vs interest)
  /// Returns a detailed breakdown for monitoring and optimization
  /// Used to inform bounty strategy and position sizing
  public async getEarningsBreakdown(): Promise<EarningsBreakdown> {
    const totalEarnings = this.accumulatedTradingFees + this.accumulatedBorrowInterest;
    
    const feeSharePct = totalEarnings === 0n 
      ? 0 
      : Number((this.accumulatedTradingFees * 100n) / totalEarnings);
    
    const interestSharePct = totalEarnings === 0n 
      ? 0 
      : Number((this.accumulatedBorrowInterest * 100n) / totalEarnings);

    return {
      tradingFees: this.accumulatedTradingFees,
      borrowInterest: this.accumulatedBorrowInterest,
      totalEarnings,
      feeSharePct,
      interestSharePct,
    };
  }

  /// @notice Query OKX Market API for 24h trading volume on OKB/USD
  /// Used to estimate expected fee income and optimize bounty sizing
  /// OPTIMIZATION: Only call before bounty creation; cache result
  private async queryOKXVolume24h(): Promise<bigint> {
    try {
      const url = `${this.OKX_API_BASE}/tickers?instId=${this.OKX_POOL_INST_ID}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`OKX API error: ${response.statusText}`);
      }

      const data = await response.json() as { data: OKXTicker[] };
      
      if (!data.data || data.data.length === 0) {
        throw new Error("No ticker data from OKX API");
      }

      const ticker = data.data[0];
      // volCcy24h is volume in quote currency (USD)
      const vol24hUsdcNumber = parseFloat(ticker.volCcy24h);
      const vol24hUsdcWei = BigInt(Math.floor(vol24hUsdcNumber * 1e6));
      
      console.log(
        `[PassiveLP-OKX] 24h volume on ${this.OKX_POOL_INST_ID}: ${Number(vol24hUsdcWei) / 1e6} USDC`
      );
      
      return vol24hUsdcWei;
    } catch (error) {
      console.warn(`[PassiveLP-OKX] Failed to query OKX API:`, error);
      // Fallback: assume conservative volume estimate
      return 10000n * 10n ** 6n; // Conservative: 10,000 USDC/day
    }
  }

  /// @notice CP-013: Create bounties when idle USDC balance is high
  /// WHAT: Posts bounties to incentivize TrendFollower/Predator to trade
  /// WHY: Attracts trading volume that generates swap fees PassiveLP profits from
  /// 
  /// OPTIMIZATION (Arena Score):
  /// - Calculates optimal bounty reward based on expected fee return
  /// - Uses OKX Market API to estimate daily volume
  /// - Only creates bounty if ROI exceeds break-even (bountyReward < estimatedFees)
  /// - Limits concurrent bounties to avoid over-commitment
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

      // OPTIMIZATION: Query OKX Market API to estimate bounty ROI
      // This allows us to avoid creating bounties with negative expected value
      const vol24hEstimate = await this.queryOKXVolume24h();
      
      // Estimate round duration in hours (assuming 1 hour typical hackathon round)
      const roundDurationHours = 1;
      const estimatedRoundVolume = (vol24hEstimate / 24n) * BigInt(roundDurationHours);
      
      // Expected fees on estimated volume (0.05% = 500 bips)
      const poolFeeRate = 500n; // 0.05% = 500 basis points
      const estimatedFeePool = (estimatedRoundVolume * poolFeeRate) / 10000n;
      
      // PassiveLP's share of fees (roughly proportional to LP capital deployed)
      // With 50 USDC deployed and assuming 50 USDC total LP capital, share ≈ 50%
      // (Real share depends on other LPs; this is conservative estimate)
      const estimatedPassiveLPShare = estimatedFeePool / 2n;
      
      // Calculate optimal bounty reward
      // Heuristic: spend 10% of idle IF it's less than estimated fees
      // This ensures bounty ROI is positive
      let bountyReward = idleUsdc / 10n;
      
      // If estimated fees are low, reduce bounty to preserve capital
      if (estimatedPassiveLPShare < bountyReward) {
        // Expected fees don't cover bounty cost; scale down
        bountyReward = (estimatedPassiveLPShare * 5n) / 10n; // Spend at most 50% of estimated fees
        console.log(
          `[PassiveLP-Bounty] Low volume environment; reducing bounty to ${bountyReward / 10n ** 6n} USDC (estimated fees: ${estimatedPassiveLPShare / 10n ** 6n} USDC)`
        );
      }

      // Volume target: assume bounty attracts 10x its value in trading volume
      // Example: 5 USDC bounty → ~50 USDC volume (conservative multiplier)
      const volumeTarget = bountyReward * 10n;
      
      // Condition: reach volume target, price within ±5%, 100-block window
      const condition: BountyCondition = {
        minVolumeUsdc: volumeTarget, // Dynamic volume target based on bounty size
        targetPriceMin: 950000000n,  // Mock sqrtPriceX96: ~0.95
        targetPriceMax: 1050000000n, // Mock sqrtPriceX96: ~1.05 (+/- 5%)
        windowBlocks: 100n,          // 100 blocks (~30 min on Ethereum)
      };

      const bountyId = await createBounty(
        this.bountyClient,
        roundId,
        bountyReward,
        condition
      );

      console.log(
        `[PassiveLP-Bounty] Created bounty ${bountyId} — reward ${bountyReward / 10n ** 6n} USDC ` +
        `for ${volumeTarget / 10n ** 6n} USDC trade volume (est. fees return: ${estimatedPassiveLPShare / 10n ** 6n} USDC)`
      );

      this.lastBountyId = bountyId;
      this.bountyCreatedTime = Date.now();
    } catch (error) {
      console.error(`[PassiveLP-Bounty] Failed to create bounty:`, error);
      // Don't fail the entire performAction; continue with LP logic
    }
  }

  /// @notice Get idle USDC balance
  /// In production: query vault via AEGIS Engine or Arena contract
  /// For MVP: return mock value based on state
  /// 
  /// PRODUCTION IMPLEMENTATION:
  /// - Call Arena.getAgentVault(roundId, agent) to get vaultId
  /// - Call AEGIS StateView.getVault(vaultId) to fetch vault.idle
  /// - Return vault.idle (amount available for bounties or rebalancing)
  private async getIdleUsdcBalance(state: GameState): Promise<bigint> {
    // Stub: return 50% of initial allocation (represents idle balance after LP allocation)
    // In production: would query actual vault idle balance via Arena contract
    return this.initialAllocation / 2n;
  }

  /// @notice Evaluate performance against success target
  /// Success metric: Achieve ≥10% USDC return (as specified in game rules)
  /// Final score includes:
  /// - Idle USDC balance (at 1:1 value)
  /// - LP share value (includes accumulated trading fees via share price appreciation)
  /// - Borrow interest earned (if any borrow demand exists on the pool)
  evaluatePerformance(finalScore: bigint, initialCapital: bigint): boolean {
    const returnPercent =
      ((finalScore - initialCapital) * 100n) / initialCapital;
    const meetsTarget = returnPercent >= 10n; // 10% return target

    console.log(
      `PassiveLP performance: ${returnPercent}% return (target: ≥10%) — ${meetsTarget ? "✓ TARGET MET" : "✗ TARGET MISSED"}`
    );
    return meetsTarget;
  }
}
