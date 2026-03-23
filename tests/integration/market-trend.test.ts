/// Integration Tests: TrendFollower + MarketClient
///
/// WHAT: Test TrendFollower's trend detection using real SMA crossover with mocked Market API
/// WHY: Verify end-to-end trend logic, caching, safety valves, and trading signals
///
/// Test framework: vitest
/// Mocking: MarketClient responses
/// Coverage: SMA crossover logic, cache behavior, LTV safety valve, graceful degradation

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { TrendFollower } from "../../src/agents/agent-trend-follower";
import { MarketClient, type Kline } from "../../src/sdk/market";
import type { GameState, Agent } from "../../src/types";

// ================================================================
// Mock GameState Factory
// ================================================================

function createMockGameState(overrides?: Partial<GameState>): GameState {
  return {
    round: 1,
    timestamp: Date.now(),
    agents: [] as Agent[],
    vaults: [],
    markets: [],
    activeBounties: [],
    completedBounties: [],
    ...overrides,
  };
}

// ================================================================
// Mock Kline Data for SMA Calculation
// ================================================================

function createMockKlines(
  basePrice: number,
  count: number,
  priceVariance: number = 0
): Kline[] {
  return Array.from({ length: count }, (_, i) => ({
    timestamp: 1000 + i * 300, // 5m intervals
    openPrice: String(basePrice - priceVariance / 2),
    highPrice: String(basePrice + priceVariance),
    lowPrice: String(basePrice - priceVariance),
    closePrice: String(basePrice + (i % 3) * (priceVariance / 3)), // Vary slightly
    volume: "1000000",
    volCcy: String(1000000 * basePrice),
  }));
}

// ================================================================
// TrendFollower Integration Tests
// ================================================================

describe("TrendFollower Market Integration", () => {
  let agent: TrendFollower;
  let marketClientSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Create agent (constructor will initialize MarketClient)
    agent = new TrendFollower({
      id: "trend-follower-1",
      name: "TrendFollower",
      vaultId: "vault-1",
    });

    // Spy on MarketClient.getKlines
    marketClientSpy = vi.spyOn(MarketClient.prototype, "getKlines" as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ================================================================
  // Bullish Trend Tests (SMA20 > SMA50 * 1.001)
  // ================================================================

  describe("bullish trend detection (SMA20 > SMA50 * 1.001)", () => {
    it("returns bullish trend (1) when SMA20 > SMA50 * 1.001", async () => {
      // Create K-lines where SMA20 > SMA50 (ascending trend)
      // Last 50 prices: start at 100, end at 150
      const klines = Array.from({ length: 50 }, (_, i) => ({
        timestamp: 1000 + i * 300,
        openPrice: String(100 + i * 1),
        highPrice: String(101 + i * 1),
        lowPrice: String(99 + i * 1),
        closePrice: String(100 + i * 1), // Ascending: 100, 101, 102, ..., 149
        volume: "1000000",
        volCcy: "100000000",
      }));

      marketClientSpy.mockResolvedValueOnce(klines);
      vi.spyOn(MarketClient.prototype, "computeSMA" as any).mockImplementation(
        (prices: number[]) => {
          // SMA of last 20: (130+131+...+149)/20 = 139.5
          // SMA of all 50: (100+101+...+149)/50 = 124.5
          // Ratio: 139.5 / 124.5 = 1.1206 > 1.001 ✓
          if (prices.length === 20) return 139.5;
          if (prices.length === 50) return 124.5;
          return null;
        }
      );

      const state = createMockGameState();
      const trend = await (agent as any).detectTrend(state);

      expect(trend).toBe(1); // Bullish
    });
  });

  // ================================================================
  // Bearish Trend Tests (SMA20 < SMA50 * 0.999)
  // ================================================================

  describe("bearish trend detection (SMA20 < SMA50 * 0.999)", () => {
    it("returns bearish trend (-1) when SMA20 < SMA50 * 0.999", async () => {
      // Create K-lines where SMA20 < SMA50 (descending trend)
      const klines = Array.from({ length: 50 }, (_, i) => ({
        timestamp: 1000 + i * 300,
        openPrice: String(150 - i * 1),
        highPrice: String(151 - i * 1),
        lowPrice: String(149 - i * 1),
        closePrice: String(150 - i * 1), // Descending: 150, 149, 148, ..., 101
        volume: "1000000",
        volCcy: "100000000",
      }));

      marketClientSpy.mockResolvedValueOnce(klines);
      vi.spyOn(MarketClient.prototype, "computeSMA" as any).mockImplementation(
        (prices: number[]) => {
          // SMA of last 20: (110+109+...+101)/20 = 105.5
          // SMA of all 50: (150+149+...+101)/50 = 125.5
          // Ratio: 105.5 / 125.5 = 0.8407 < 0.999 ✓
          if (prices.length === 20) return 105.5;
          if (prices.length === 50) return 125.5;
          return null;
        }
      );

      const state = createMockGameState();
      const trend = await (agent as any).detectTrend(state);

      expect(trend).toBe(-1); // Bearish
    });
  });

  // ================================================================
  // Flat Trend Tests (SMA20 ≈ SMA50)
  // ================================================================

  describe("flat trend detection", () => {
    it("returns flat (0) when SMA20 ≈ SMA50", async () => {
      // Create K-lines where prices are stable
      const klines = Array.from({ length: 50 }, (_, i) => ({
        timestamp: 1000 + i * 300,
        openPrice: "125",
        highPrice: "125.5",
        lowPrice: "124.5",
        closePrice: "125", // Stable price
        volume: "1000000",
        volCcy: "125000000",
      }));

      marketClientSpy.mockResolvedValueOnce(klines);
      vi.spyOn(MarketClient.prototype, "computeSMA" as any).mockImplementation(
        (prices: number[]) => 125 // Both SMA20 and SMA50 = 125
      );

      const state = createMockGameState();
      const trend = await (agent as any).detectTrend(state);

      expect(trend).toBe(0); // Flat (no cross)
    });

    it("returns flat (0) when Market API is unavailable", async () => {
      marketClientSpy.mockRejectedValueOnce(new Error("API timeout"));

      const state = createMockGameState();
      const trend = await (agent as any).detectTrend(state);

      expect(trend).toBe(0); // Safe default: flat on error
    });

    it("returns flat (0) when insufficient K-line data", async () => {
      // Only 10 candles instead of 50
      const klines = Array.from({ length: 10 }, (_, i) => ({
        timestamp: 1000 + i * 300,
        openPrice: "100",
        highPrice: "101",
        lowPrice: "99",
        closePrice: "100",
        volume: "1000000",
        volCcy: "100000000",
      }));

      marketClientSpy.mockResolvedValueOnce(klines);

      const state = createMockGameState();
      const trend = await (agent as any).detectTrend(state);

      expect(trend).toBe(0); // Insufficient data = flat
    });
  });

  // ================================================================
  // Caching Tests
  // ================================================================

  describe("trend caching (60-second TTL)", () => {
    it("uses cached trend within 60 seconds (no second API call)", async () => {
      const klines = createMockKlines(125, 50, 1);

      marketClientSpy.mockResolvedValueOnce(klines);
      vi.spyOn(MarketClient.prototype, "computeSMA" as any).mockImplementation(
        () => 125
      );

      const state = createMockGameState();

      // First call: cache miss
      const trend1 = await (agent as any).detectTrend(state);
      expect(marketClientSpy).toHaveBeenCalledTimes(1);

      // Second call (immediately after): should use cache
      const trend2 = await (agent as any).detectTrend(state);
      expect(marketClientSpy).toHaveBeenCalledTimes(1); // Still 1, not 2
      expect(trend2).toBe(trend1);
    });

    it("fetches fresh data after 60 seconds", async () => {
      vi.useFakeTimers();

      const klines = createMockKlines(125, 50, 1);

      marketClientSpy.mockResolvedValue(klines);
      vi.spyOn(MarketClient.prototype, "computeSMA" as any).mockImplementation(
        () => 125
      );

      const state = createMockGameState();

      // First call
      await (agent as any).detectTrend(state);
      expect(marketClientSpy).toHaveBeenCalledTimes(1);

      // Advance time by 61 seconds
      vi.advanceTimersByTime(61 * 1000);

      // Second call should hit API again
      await (agent as any).detectTrend(state);
      expect(marketClientSpy).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });
  });

  // ================================================================
  // LTV Safety Valve Tests
  // ================================================================

  describe("LTV safety valve (no leverage when LTV > 85%)", () => {
    it("returns flat (0) when vault LTV > 85%", async () => {
      // Mock bullish trend (SMA20 > SMA50)
      const klines = Array.from({ length: 50 }, (_, i) => ({
        timestamp: 1000 + i * 300,
        openPrice: String(100 + i * 1),
        highPrice: String(101 + i * 1),
        lowPrice: String(99 + i * 1),
        closePrice: String(100 + i * 1),
        volume: "1000000",
        volCcy: "100000000",
      }));

      marketClientSpy.mockResolvedValueOnce(klines);
      vi.spyOn(MarketClient.prototype, "computeSMA" as any).mockImplementation(
        (prices: number[]) => {
          if (prices.length === 20) return 139.5; // bullish
          if (prices.length === 50) return 124.5;
          return null;
        }
      );

      // Mock LTV estimator to return > 85%
      vi.spyOn(agent as any, "estimateVaultLTV").mockReturnValue(90);

      const state = createMockGameState();
      const trend = await (agent as any).detectTrend(state);

      // Even though trend is bullish, LTV safety valve should force flat
      expect(trend).toBe(0);
    });

    it("allows leverage when LTV ≤ 85%", async () => {
      // Mock bullish trend
      const klines = Array.from({ length: 50 }, (_, i) => ({
        timestamp: 1000 + i * 300,
        openPrice: String(100 + i * 1),
        highPrice: String(101 + i * 1),
        lowPrice: String(99 + i * 1),
        closePrice: String(100 + i * 1),
        volume: "1000000",
        volCcy: "100000000",
      }));

      marketClientSpy.mockResolvedValueOnce(klines);
      vi.spyOn(MarketClient.prototype, "computeSMA" as any).mockImplementation(
        (prices: number[]) => {
          if (prices.length === 20) return 139.5; // bullish
          if (prices.length === 50) return 124.5;
          return null;
        }
      );

      // Mock LTV ≤ 85%
      vi.spyOn(agent as any, "estimateVaultLTV").mockReturnValue(75);

      const state = createMockGameState();
      const trend = await (agent as any).detectTrend(state);

      // LTV is safe, trend should be bullish
      expect(trend).toBe(1);
    });
  });

  // ================================================================
  // Logging & Observability
  // ================================================================

  describe("logging for audit trail", () => {
    it("logs SMA values on trend calculation", async () => {
      const consoleSpy = vi.spyOn(console, "log");

      const klines = Array.from({ length: 50 }, (_, i) => ({
        timestamp: 1000 + i * 300,
        openPrice: "100",
        highPrice: "102",
        lowPrice: "98",
        closePrice: "101",
        volume: "1000000",
        volCcy: "100000000",
      }));

      marketClientSpy.mockResolvedValueOnce(klines);
      vi.spyOn(MarketClient.prototype, "computeSMA" as any).mockImplementation(
        (prices: number[]) => {
          if (prices.length === 20) return 101.5;
          if (prices.length === 50) return 100.5;
          return 0;
        }
      );

      const state = createMockGameState();
      await (agent as any).detectTrend(state);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[TrendFollower]"),
        expect.stringContaining("SMA20")
      );

      consoleSpy.mockRestore();
    });

    it("logs trend signal on decision", async () => {
      const consoleSpy = vi.spyOn(console, "log");

      const klines = Array.from({ length: 50 }, (_, i) => ({
        timestamp: 1000 + i * 300,
        openPrice: String(100 + i * 1),
        highPrice: String(101 + i * 1),
        lowPrice: String(99 + i * 1),
        closePrice: String(100 + i * 1),
        volume: "1000000",
        volCcy: "100000000",
      }));

      marketClientSpy.mockResolvedValueOnce(klines);
      vi.spyOn(MarketClient.prototype, "computeSMA" as any).mockImplementation(
        (prices: number[]) => {
          if (prices.length === 20) return 139.5; // Bullish
          if (prices.length === 50) return 124.5;
          return 0;
        }
      );

      const state = createMockGameState();
      await (agent as any).detectTrend(state);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[TrendFollower]"),
        expect.stringContaining("BULLISH")
      );

      consoleSpy.mockRestore();
    });
  });
});
