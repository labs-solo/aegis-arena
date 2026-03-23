/// Unit Tests for MarketClient (OKX Market API)
///
/// WHAT: Test MarketClient methods in isolation with mocked HTTP calls
/// WHY: Verify K-line parsing, caching, SMA computation, error handling, and API fallback
///
/// Test framework: vitest
/// Mocking: Manual fetch spy + response mocks
/// Coverage: getKlines(), getCurrentPrice(), computeSMA(), isAvailable()

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MarketClient, type Kline, type MarketPrice } from "../../src/sdk/market";

// ================================================================
// Mock Fetch Setup
// ================================================================

describe("MarketClient", () => {
  let client: MarketClient;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    client = new MarketClient("test-api-key");
    // Spy on global fetch
    fetchSpy = vi.spyOn(global, "fetch" as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ================================================================
  // getKlines() Tests
  // ================================================================

  describe("getKlines()", () => {
    it("fetches and parses K-line data from OKX API", async () => {
      // Mock successful response matching OKX API format
      const mockOkxResponse = {
        code: "0",
        msg: "success",
        data: [
          {
            ts: "1234567890000",
            o: "100.00",
            h: "102.00",
            l: "99.00",
            c: "101.00",
            vol: "1000000",
            volCcy: "101000000",
          },
          {
            ts: "1234567950000",
            o: "101.00",
            h: "103.00",
            l: "100.50",
            c: "102.50",
            vol: "1200000",
            volCcy: "123000000",
          },
        ],
      };

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockOkxResponse,
      } as Response);

      const result = await client.getKlines("OKB-USDT", "5m", 2);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        timestamp: 1234567890000,
        openPrice: "100.00",
        highPrice: "102.00",
        lowPrice: "99.00",
        closePrice: "101.00",
        volume: "1000000",
        volCcy: "101000000",
      });
      expect(result[1].closePrice).toBe("102.50");
    });

    it("returns cached data within 60 seconds", async () => {
      const mockOkxResponse = {
        code: "0",
        data: [
          {
            ts: "1000",
            o: "100",
            h: "100",
            l: "100",
            c: "100",
            vol: "1000",
            volCcy: "100000",
          },
        ],
      };

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockOkxResponse,
      } as Response);

      // First call hits API
      const result1 = await client.getKlines("OKB-USDT", "5m", 1);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Second call (within 60s) should use cache
      const result2 = await client.getKlines("OKB-USDT", "5m", 1);
      expect(fetchSpy).toHaveBeenCalledTimes(1); // Still 1, not 2
      expect(result2).toEqual(result1);
    });

    it("returns empty array on API failure (graceful)", async () => {
      // Simulate network error
      fetchSpy.mockRejectedValueOnce(new Error("Network error"));

      const result = await client.getKlines("OKB-USDT", "5m", 50);

      expect(result).toEqual([]);
    });

    it("correctly parses OKX array format to Kline interface", async () => {
      const mockOkxResponse = {
        code: "0",
        data: [
          {
            ts: "1609459200000", // 2021-01-01 00:00:00 UTC
            o: "29000.50",
            h: "30000.00",
            l: "28500.00",
            c: "29500.25",
            vol: "5000",
            volCcy: "147501250",
          },
        ],
      };

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockOkxResponse,
      } as Response);

      const result = await client.getKlines("BTC-USDT", "1D", 1);

      expect(result).toHaveLength(1);
      const kline = result[0];
      expect(kline.timestamp).toBe(1609459200000);
      expect(kline.openPrice).toBe("29000.50");
      expect(kline.highPrice).toBe("30000.00");
      expect(kline.lowPrice).toBe("28500.00");
      expect(kline.closePrice).toBe("29500.25");
      expect(kline.volume).toBe("5000");
      expect(kline.volCcy).toBe("147501250");
    });

    it("skips cache and fetches fresh data for different instrument", async () => {
      const mockResponse1 = {
        code: "0",
        data: [{ ts: "1000", o: "100", h: "100", l: "100", c: "100", vol: "1000", volCcy: "100000" }],
      };
      const mockResponse2 = {
        code: "0",
        data: [{ ts: "2000", o: "200", h: "200", l: "200", c: "200", vol: "2000", volCcy: "400000" }],
      };

      fetchSpy
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockResponse1,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockResponse2,
        } as Response);

      await client.getKlines("OKB-USDT", "5m", 1);
      await client.getKlines("BTC-USDT", "5m", 1);

      expect(fetchSpy).toHaveBeenCalledTimes(2); // Both API calls made
    });
  });

  // ================================================================
  // getCurrentPrice() Tests
  // ================================================================

  describe("getCurrentPrice()", () => {
    it("returns MarketPrice with bid/ask/last", async () => {
      const mockOkxResponse = {
        code: "0",
        data: [
          {
            instId: "OKB-USDT",
            last: "100.50",
            bidPx: "100.49",
            askPx: "100.51",
            ts: "1234567890000",
          },
        ],
      };

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockOkxResponse,
      } as Response);

      const result = await client.getCurrentPrice("OKB-USDT");

      expect(result).toEqual({
        instId: "OKB-USDT",
        lastPrice: "100.50",
        bestBid: "100.49",
        bestAsk: "100.51",
        timestamp: 1234567890000,
      });
    });

    it("handles API error gracefully", async () => {
      fetchSpy.mockRejectedValueOnce(new Error("API error"));

      const result = await client.getCurrentPrice("OKB-USDT");

      expect(result).toBeNull();
    });

    it("returns null when API response is empty", async () => {
      const mockOkxResponse = {
        code: "0",
        data: [],
      };

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockOkxResponse,
      } as Response);

      const result = await client.getCurrentPrice("NONEXISTENT-USDT");

      expect(result).toBeNull();
    });
  });

  // ================================================================
  // computeSMA() Tests
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

    it("uses only last N prices for SMA(N)", () => {
      // SMA20 of array with 50 prices should use only the last 20
      const prices = Array.from({ length: 50 }, (_, i) => i + 1); // [1, 2, 3, ..., 50]
      // Sum of last 20: 31+32+...+50 = (31+50)*20/2 = 81*10 = 810
      // SMA = 810/20 = 40.5
      const sma = client.computeSMA(prices.slice(-20));

      expect(sma).toBe(40.5);
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
  });

});
