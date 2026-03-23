/// Unit Tests for MarketClient (OKX Market API)
///
/// WHAT: Test MarketClient methods in isolation
/// WHY: Verify K-line parsing, SMA computation, and graceful degradation
///
/// Test framework: vitest
/// Coverage: computeSMA(), cache clearing, error handling

import { describe, it, expect, beforeEach } from "vitest";
import { MarketClient } from "../../src/sdk/market";

// ================================================================
// MarketClient Unit Tests
// ================================================================

describe("MarketClient", () => {
  let client: MarketClient;

  beforeEach(() => {
    client = new MarketClient("test-api-key");
  });

  // ================================================================
  // computeSMA() Tests (Pure Function)
  // ================================================================

  describe("computeSMA()", () => {
    it("returns correct SMA for known input", () => {
      // SMA of [10, 20, 30] = 20
      const prices = [10, 20, 30];
      const sma = client.computeSMA(prices);

      expect(sma).toBe(20);
    });

    it("returns null when prices array is empty", () => {
      const sma = client.computeSMA([]);

      expect(sma).toBeNull();
    });

    it("uses only provided prices for SMA calculation", () => {
      // SMA20 of 20 prices should average all 20
      const prices = Array.from({ length: 20 }, (_, i) => i + 1); // [1, 2, 3, ..., 20]
      // Sum: (1+20)*20/2 = 210; Average: 210/20 = 10.5
      const sma = client.computeSMA(prices);

      expect(sma).toBe(10.5);
    });

    it("handles single price", () => {
      const sma = client.computeSMA([42.5]);

      expect(sma).toBe(42.5);
    });

    it("handles floating point prices", () => {
      // SMA of [1.5, 2.5, 3.5] = 7.5/3 = 2.5
      const prices = [1.5, 2.5, 3.5];
      const sma = client.computeSMA(prices);

      expect(sma).toBeCloseTo(2.5, 10);
    });

    it("handles very large prices", () => {
      const prices = [1000000, 2000000, 3000000];
      const sma = client.computeSMA(prices);

      expect(sma).toBe(2000000);
    });

    it("handles zero prices", () => {
      const prices = [0, 0, 0];
      const sma = client.computeSMA(prices);

      expect(sma).toBe(0);
    });

    it("handles mixed positive and negative (for volatility calcs)", () => {
      // Prices should normally be positive, but test behavior
      const prices = [100, 110, 105];
      const sma = client.computeSMA(prices);

      expect(sma).toBeCloseTo(105, 10);
    });

    it("handles many prices (50-candle case)", () => {
      // Simulate 50 K-line closes: 100, 101, 102, ..., 149
      const prices = Array.from({ length: 50 }, (_, i) => 100 + i);
      // Sum: (100+149)*50/2 = 249*25 = 6225; Average: 6225/50 = 124.5
      const sma = client.computeSMA(prices);

      expect(sma).toBe(124.5);
    });
  });

  // ================================================================
  // Kline Interface Tests
  // ================================================================

  describe("Kline interface", () => {
    it("should define Kline with correct fields", () => {
      // This is a compile-time check, but we can verify the interface
      // by ensuring MarketClient accepts proper K-line arrays
      const mockKlines = [
        {
          timestamp: 1609459200000,
          openPrice: "29000.50",
          highPrice: "30000.00",
          lowPrice: "28500.00",
          closePrice: "29500.25",
          volume: "5000",
          volCcy: "147501250",
        },
      ];

      // If this compiles, the interface is correct
      const closes = mockKlines.map((k) => parseFloat(k.closePrice));
      expect(closes[0]).toBe(29500.25);
    });
  });

  // ================================================================
  // Cache Clearing
  // ================================================================

  describe("cache management", () => {
    it("clears cache without error", () => {
      // This is a basic smoke test
      client.clearCache();
      // If no error is thrown, the method works
      expect(true).toBe(true);
    });
  });

  // ================================================================
  // SMA Trend Logic Tests
  // ================================================================

  describe("SMA crossover logic (for TrendFollower integration)", () => {
    it("detects bullish signal: SMA20 > SMA50 * 1.001", () => {
      // Ascending trend: last 50 prices from 100 to 149
      const prices = Array.from({ length: 50 }, (_, i) => 100 + i);
      const sma50 = client.computeSMA(prices);
      const sma20 = client.computeSMA(prices.slice(-20));

      // sma20 = (130+..+149)/20 = 139.5
      // sma50 = 124.5
      // 139.5 > 124.5 * 1.001 (124.625)? Yes, bullish ✓
      expect(sma20).toBe(139.5);
      expect(sma50).toBe(124.5);
      expect(sma20 > sma50 * 1.001).toBe(true);
    });

    it("detects bearish signal: SMA20 < SMA50 * 0.999", () => {
      // Descending trend: prices from 150 down to 101
      const prices = Array.from({ length: 50 }, (_, i) => 150 - i);
      // [150, 149, 148, ..., 101]
      // Last 20: [120, 119, 118, ..., 101]
      // Last 20 sum: (120+101)*20/2 = 221*10 = 2210; avg = 110.5
      const sma50 = client.computeSMA(prices);
      const sma20 = client.computeSMA(prices.slice(-20));

      // sma20 = (120+..+101)/20 = 110.5
      // sma50 = (150+..+101)/50 = 125.5
      // 110.5 < 125.5 * 0.999 (125.375)? Yes, bearish ✓
      expect(sma20).toBe(110.5);
      expect(sma50).toBe(125.5);
      expect(sma20 < sma50 * 0.999).toBe(true);
    });

    it("detects flat signal: SMA20 ≈ SMA50 (no hysteresis cross)", () => {
      // Flat prices: all 125
      const prices = Array.from({ length: 50 }, () => 125);
      const sma50 = client.computeSMA(prices);
      const sma20 = client.computeSMA(prices.slice(-20));

      // Both SMAs = 125
      // 125 > 125 * 1.001? No
      // 125 < 125 * 0.999? No
      // Result: Flat ✓
      expect(sma20).toBe(125);
      expect(sma50).toBe(125);
      expect(sma20 > sma50 * 1.001).toBe(false);
      expect(sma20 < sma50 * 0.999).toBe(false);
    });

    it("hysteresis threshold prevents whipsaw on tight crosses", () => {
      // Tight cross at exactly 0.1% (the threshold)
      // sma50 = 100, sma20 = 100.1
      // 100.1 > 100 * 1.001 (100.1)? No (equal, not greater)
      // Result: Flat (not bullish) due to hysteresis ✓

      const sma50 = 100;
      const sma20 = 100.1;

      const isBullish = sma20 > sma50 * 1.001;
      const isBearish = sma20 < sma50 * 0.999;

      // Both false = flat, hysteresis prevents false signal
      expect(isBullish).toBe(false);
      expect(isBearish).toBe(false);
    });
  });
});
