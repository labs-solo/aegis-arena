// src/agents/agent-trend-follower.ts
// CP-020: Borrow flow wired before swaps (SRC-HIGH-05)
// CP-020: Correct pool tokens from CONFIG (not hardcoded USDC/WOKB)
// CP-020: Provider injection
//
// Strategy: Detect trends, borrow capital, take leveraged directional bets.

import { ethers } from "ethers";
import { BaseAgent } from "./base-agent.js";
import { GameState } from "../orchestrator/types.js";
import { encodeSwapExactInSingle } from "../sdk/router.js";
import { CONFIG } from "../config/index.js";
import { MarketClient } from "../sdk/market.js";

export class AgentTrendFollower extends BaseAgent {
  private provider: ethers.Provider;
  private marketClient: MarketClient;
  private cachedTrend: 1 | -1 | 0 = 0;
  private lastTrendCheck = 0;
  private readonly TREND_CACHE_MS = 60_000;
  private readonly INST_ID = process.env.OKX_MARKET_INSTRUMENT_ID ?? "OKB-USDT";

  constructor(agentAddress: string, provider: ethers.Provider) {
    super("TrendFollower", agentAddress);
    this.provider = provider;
    this.marketClient = new MarketClient(process.env.OKX_MARKET_API_KEY);
  }

  async decideActions(state: GameState): Promise<string[]> {
    const trend = await this.detectTrend(state);

    if (trend === 0) {
      console.log("[TrendFollower] Flat trend; holding");
      return [];
    }

    const actions: string[] = [];
    const borrowAmount = ethers.parseUnits("1000", 6); // 1000 USD₮0

    if (trend > 0) {
      // Uptrend: encode borrow FIRST (SRC-HIGH-05 fix), then swap
      // borrow USD₮0 → buy WOKB
      const borrowEncoded = this.encodeBorrow(state.agentVaultId.toString(), borrowAmount, CONFIG.pool.token1);
      actions.push(borrowEncoded);

      const swapEncoded = encodeSwapExactInSingle({
        poolId: CONFIG.pool.address,
        tokenIn: CONFIG.pool.token1,   // USD₮0 (correct token — not old USDC)
        tokenOut: CONFIG.pool.token0,  // WOKB (correct token)
        amountIn: borrowAmount,
        minAmountOut: 0n,
      });
      actions.push(swapEncoded);

      console.log("[TrendFollower] BULLISH: borrow USD₮0 + buy WOKB");
    } else {
      // Downtrend: swap WOKB → USD₮0
      const swapEncoded = encodeSwapExactInSingle({
        poolId: CONFIG.pool.address,
        tokenIn: CONFIG.pool.token0,   // WOKB
        tokenOut: CONFIG.pool.token1,  // USD₮0
        amountIn: ethers.parseEther("10"),
        minAmountOut: 0n,
      });
      actions.push(swapEncoded);

      console.log("[TrendFollower] BEARISH: sell WOKB for USD₮0");
    }

    return actions;
  }

  /**
   * Encode a borrow action (stub — Phase 2 uses full encodeBorrowFlow)
   */
  private encodeBorrow(vaultId: string, amount: bigint, asset: string): string {
    return ethers.AbiCoder.defaultAbiCoder().encode(
      ["bytes4", "string", "uint256", "address"],
      ["0xaabbccdd", vaultId, amount, asset]
    );
  }

  private async detectTrend(state: GameState): Promise<1 | -1 | 0> {
    const now = Date.now();
    if (now - this.lastTrendCheck < this.TREND_CACHE_MS) {
      return this.cachedTrend;
    }

    try {
      const klines = await this.marketClient.getKlines(this.INST_ID, "5m", 50);
      if (klines.length < 50) return 0;

      const closes = klines.map((k) => parseFloat(k.closePrice));
      const sma20 = this.marketClient.computeSMA(closes.slice(-20));
      const sma50 = this.marketClient.computeSMA(closes);

      if (sma20 === null || sma50 === null) return 0;

      let trend: 1 | -1 | 0;
      if (sma20 > sma50 * 1.001) trend = 1;
      else if (sma20 < sma50 * 0.999) trend = -1;
      else trend = 0;

      this.cachedTrend = trend;
      this.lastTrendCheck = now;
      return trend;
    } catch (e) {
      console.warn("[TrendFollower] Market API error; flat:", String(e).slice(0, 80));
      return 0;
    }
  }
}
