/// AEGIS Arena Market Data SDK
/// Wrapper around OKX Market API for real price discovery and trend detection

import axios, { AxiosInstance, AxiosError } from "axios";

export interface Kline {
  timestamp: number; // Unix timestamp (ms)
  openPrice: string; // Price as string (from OKX JSON)
  highPrice: string;
  lowPrice: string;
  closePrice: string;
  volume: string; // Base asset volume
  volCcy: string; // Quote asset volume
}

export interface MarketPrice {
  instId: string;
  lastPrice: string;
  bestBid: string;
  bestAsk: string;
  timestamp: number;
}

export interface IndexPrice {
  instId: string;
  idxPx: string;
  timestamp: number;
}

interface CacheEntry {
  data: Kline[];
  timestamp: number;
}

export class MarketClient {
  private apiClient: AxiosInstance;
  private baseUrl = "https://www.okx.com/api/v5/market";

  // K-line cache: "${instId}-${bar}-${limit}" => { data: Kline[], timestamp }
  private klineCache: Map<string, CacheEntry> = new Map();
  private readonly cacheTTLMs = 60 * 1000; // 60 second cache

  constructor(apiKey?: string) {
    // Market API is public; apiKey is optional for higher rate limits
    this.apiClient = axios.create({
      baseURL: this.baseUrl,
      timeout: 5000,
      headers: apiKey ? { "OK-ACCESS-KEY": apiKey } : {},
    });
  }

  /// @notice Fetch K-line data for instrument
  /// @param instId Instrument ID (e.g., "OKB-USDT", "OKB-USDC")
  /// @param bar Timeframe ("1m", "5m", "15m", "1H", "4H", "1D")
  /// @param limit Number of candles to fetch (1–300)
  /// @return Array of Kline objects, sorted ascending by timestamp
  async getKlines(
    instId: string,
    bar: string = "5m",
    limit: number = 50
  ): Promise<Kline[]> {
    const cacheKey = `${instId}-${bar}-${limit}`;
    const cached = this.klineCache.get(cacheKey);

    // Return cached data if fresh (within TTL)
    if (cached && Date.now() - cached.timestamp < this.cacheTTLMs) {
      console.log(
        `[MarketClient] Using cached K-lines for ${instId} (${bar}, limit=${limit})`
      );
      return cached.data;
    }

    try {
      console.log(
        `[MarketClient] Fetching K-lines for ${instId} (${bar}, limit=${limit})`
      );

      const response = await this.apiClient.get("/candles", {
        params: {
          instId,
          bar,
          limit,
        },
      });

      if (response.status !== 200) {
        console.warn(
          `[MarketClient] OKX Market API returned status ${response.status}`
        );
        return [];
      }

      // OKX response format: { code: "0", msg: "", data: [[ts, o, h, l, c, vol, volCcy, volCcyQuote, confirm], ...] }
      const data = response.data?.data || [];

      if (!Array.isArray(data) || data.length === 0) {
        console.warn(`[MarketClient] Empty K-line data for ${instId}`);
        return [];
      }

      const klines: Kline[] = data.map((candle: any[]) => ({
        timestamp: parseInt(candle[0], 10),
        openPrice: candle[1] as string,
        highPrice: candle[2] as string,
        lowPrice: candle[3] as string,
        closePrice: candle[4] as string,
        volume: candle[5] as string,
        volCcy: candle[6] as string,
      }));

      // Sort by timestamp ascending (OKX returns descending)
      klines.sort((a, b) => a.timestamp - b.timestamp);

      // Cache the result
      this.klineCache.set(cacheKey, { data: klines, timestamp: Date.now() });

      console.log(
        `[MarketClient] Successfully fetched ${klines.length} K-lines for ${instId}`
      );
      return klines;
    } catch (error: unknown) {
      const errMsg =
        error instanceof AxiosError
          ? `${error.code || "UNKNOWN"} ${error.message}`
          : String(error);
      console.error(
        `[MarketClient] Error fetching K-lines for ${instId}: ${errMsg}`
      );
      // Graceful degradation: return empty array
      // Caller (TrendFollower) will degrade to flat trend
      return [];
    }
  }

  /// @notice Get current market price
  /// @param instId Instrument ID (e.g., "OKB-USDT")
  /// @return MarketPrice with last trade price and bid/ask, or null if error
  async getCurrentPrice(instId: string): Promise<MarketPrice | null> {
    try {
      console.log(`[MarketClient] Fetching current price for ${instId}`);

      const response = await this.apiClient.get("/ticker", {
        params: { instId },
      });

      if (response.status !== 200 || !response.data?.data) {
        console.warn(`[MarketClient] Failed to fetch price for ${instId}`);
        return null;
      }

      const data = response.data.data[0]; // OKX returns array; take first element

      return {
        instId: data.instId as string,
        lastPrice: data.last as string,
        bestBid: data.bidPx as string,
        bestAsk: data.askPx as string,
        timestamp: parseInt(data.ts, 10),
      };
    } catch (error: unknown) {
      const errMsg =
        error instanceof AxiosError
          ? `${error.code || "UNKNOWN"} ${error.message}`
          : String(error);
      console.error(
        `[MarketClient] Error fetching price for ${instId}: ${errMsg}`
      );
      return null;
    }
  }

  /// @notice Get index price (for oracle comparisons)
  /// @param instId Index ID (e.g., "OKB-USDT-INDEX")
  /// @return IndexPrice if available, null if error
  async getIndexPrice(instId: string): Promise<IndexPrice | null> {
    try {
      console.log(`[MarketClient] Fetching index price for ${instId}`);

      const response = await this.apiClient.get("/index-tickers", {
        params: { instId },
      });

      if (response.status !== 200 || !response.data?.data) {
        console.warn(
          `[MarketClient] Failed to fetch index price for ${instId}`
        );
        return null;
      }

      const data = response.data.data[0];

      return {
        instId: data.instId as string,
        idxPx: data.idxPx as string,
        timestamp: parseInt(data.ts, 10),
      };
    } catch (error: unknown) {
      const errMsg =
        error instanceof AxiosError
          ? `${error.code || "UNKNOWN"} ${error.message}`
          : String(error);
      console.error(
        `[MarketClient] Error fetching index price for ${instId}: ${errMsg}`
      );
      return null;
    }
  }

  /// @notice Compute simple moving average
  /// @param prices Array of prices as numbers
  /// @return SMA value, or null if invalid input
  computeSMA(prices: number[]): number | null {
    if (!prices || prices.length === 0) {
      return null;
    }

    const sum = prices.reduce((a, b) => a + b, 0);
    return sum / prices.length;
  }

  /// @notice Clear K-line cache (for testing or reset)
  clearCache(): void {
    this.klineCache.clear();
    console.log("[MarketClient] K-line cache cleared");
  }
}
