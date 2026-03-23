/// OKX Onchain Gateway Client
/// Manages transaction simulation, gas estimation, broadcasting, and order tracking
/// Spec: CP-014 (OKX Onchain Gateway Integration for Autonomous Agent Transaction Safety)

import { createHmac } from "crypto";
import type {
  SimulateParams,
  SimulationResult,
  BroadcastParams,
  BroadcastResult,
  GasEstimateParams,
} from "./types";

// ================================================================
// Type Definitions
// ================================================================

export interface GatewayConfig {
  apiKey: string;
  apiSecret: string;
  passphrase: string;
  baseUrl?: string;
  chainId?: number;
  timeoutMs?: number;
}

// ================================================================
// Custom Error Classes
// ================================================================

export class GatewayTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GatewayTimeoutError";
  }
}

export class GatewayAPIError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "GatewayAPIError";
  }
}

export class GatewayParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GatewayParseError";
  }
}

// ================================================================
// GatewayClient Class
// ================================================================

export class GatewayClient {
  private apiKey: string;
  private apiSecret: string;
  private passphrase: string;
  private baseUrl: string;
  private chainId: number;
  private timeoutMs: number;

  constructor(config: GatewayConfig) {
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.passphrase = config.passphrase;
    this.baseUrl = config.baseUrl || "https://www.okx.com";
    this.chainId = config.chainId || 196;
    this.timeoutMs = config.timeoutMs || 30000;

    if (!this.apiKey || !this.apiSecret || !this.passphrase) {
      throw new Error(
        "GatewayClient requires apiKey, apiSecret, and passphrase"
      );
    }
  }

  // ================================================================
  // Signature Generation (OKX Auth)
  // ================================================================

  /// @notice Generate OKX API signature
  /// Signature: HMAC-SHA256(timestamp + 'POST' + path + body), base64 encoded
  private generateSignature(
    timestamp: string,
    method: string,
    path: string,
    body: string
  ): string {
    const message = timestamp + method + path + body;
    const signature = createHmac("sha256", this.apiSecret)
      .update(message)
      .digest("base64");
    return signature;
  }

  /// @notice Generate OKX request headers
  private generateHeaders(method: string, path: string, body: string): Record<string, string> {
    const timestamp = new Date().toISOString();
    const signature = this.generateSignature(timestamp, method, path, body);

    return {
      "Content-Type": "application/json",
      "OK-ACCESS-KEY": this.apiKey,
      "OK-ACCESS-SIGN": signature,
      "OK-ACCESS-TIMESTAMP": timestamp,
      "OK-ACCESS-PASSPHRASE": this.passphrase,
    };
  }

  // ================================================================
  // Simulation
  // ================================================================

  /// @notice Simulate a transaction without broadcasting
  /// POST /api/v5/wallet/pre-transaction/validate-transaction
  /// @param params SimulateParams with transaction details
  /// @returns SimulationResult with gas estimate and revert reason (if failed)
  async simulate(params: SimulateParams): Promise<SimulationResult> {
    const path = "/api/v5/wallet/pre-transaction/validate-transaction";
    const method = "POST";
    const body = JSON.stringify({
      chainId: params.chainId.toString(),
      from: params.from,
      to: params.to,
      data: params.data,
      value: params.value || "0",
    });

    const headers = this.generateHeaders(method, path, body);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
        body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new GatewayAPIError(
          response.status.toString(),
          `Simulation request failed: ${response.statusText}`
        );
      }

      let data: unknown;
      try {
        data = await response.json();
      } catch (err) {
        throw new GatewayParseError(`Failed to parse simulation response: ${String(err)}`);
      }

      // Validate response structure
      if (
        typeof data !== "object" ||
        data === null ||
        !("code" in data) ||
        !("data" in data)
      ) {
        throw new GatewayParseError("Invalid simulation response structure");
      }

      const typedData = data as {
        code: string;
        msg?: string;
        data: unknown[];
      };

      // Check API error code
      if (typedData.code !== "0") {
        throw new GatewayAPIError(
          typedData.code,
          typedData.msg || "Simulation failed with API error"
        );
      }

      // Parse simulation result
      if (!Array.isArray(typedData.data) || typedData.data.length === 0) {
        throw new GatewayParseError("Simulation response data is empty");
      }

      const result = typedData.data[0];
      if (typeof result !== "object" || result === null) {
        throw new GatewayParseError("Invalid simulation result format");
      }

      const typedResult = result as {
        success?: boolean;
        gasUsed?: string;
        revertReason?: string;
        logs?: unknown[];
      };

      // Success case
      if (typedResult.success === true) {
        const gasUsed = typedResult.gasUsed
          ? BigInt(typedResult.gasUsed)
          : undefined;
        return {
          success: true,
          gasUsed,
          logs: typedResult.logs || [],
        };
      }

      // Failure case (revert)
      return {
        success: false,
        revertReason: typedResult.revertReason || "Transaction reverted",
      };
    } catch (err) {
      if (err instanceof GatewayAPIError) {
        throw err;
      }
      if (err instanceof GatewayParseError) {
        throw err;
      }
      if (err instanceof Error && err.name === "AbortError") {
        throw new GatewayTimeoutError(
          `Simulation request timed out after ${this.timeoutMs}ms`
        );
      }
      throw new GatewayAPIError(
        "UNKNOWN",
        `Simulation error: ${String(err)}`
      );
    }
  }

  // ================================================================
  // Gas Estimation
  // ================================================================

  /// @notice Estimate gas for a transaction
  /// @param params GasEstimateParams
  /// @returns Estimated gas as bigint
  async estimateGas(params: GasEstimateParams): Promise<bigint> {
    try {
      // Use simulation to estimate gas
      const simResult = await this.simulate({
        chainId: params.chainId,
        from: params.from,
        to: params.to,
        data: params.data,
        value: params.value,
      });

      if (simResult.success && simResult.gasUsed) {
        return simResult.gasUsed;
      }

      // Fallback to safe default if simulation fails
      return BigInt(200000);
    } catch (err) {
      // Return safe default on error
      console.warn(`Gas estimation error, using default: ${String(err)}`);
      return BigInt(200000);
    }
  }

  // ================================================================
  // Broadcasting
  // ================================================================

  /// @notice Broadcast a signed transaction via OKX optimized multi-node
  /// POST /api/v5/wallet/pre-transaction/broadcast-transaction
  /// @param params BroadcastParams with signed transaction
  /// @returns BroadcastResult with tx hash and status
  async broadcast(params: BroadcastParams): Promise<BroadcastResult> {
    const path = "/api/v5/wallet/pre-transaction/broadcast-transaction";
    const method = "POST";
    const body = JSON.stringify({
      chainId: params.chainId.toString(),
      signedTx: params.signedTx,
    });

    const headers = this.generateHeaders(method, path, body);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
        body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new GatewayAPIError(
          response.status.toString(),
          `Broadcast request failed: ${response.statusText}`
        );
      }

      let data: unknown;
      try {
        data = await response.json();
      } catch (err) {
        throw new GatewayParseError(`Failed to parse broadcast response: ${String(err)}`);
      }

      // Validate response structure
      if (
        typeof data !== "object" ||
        data === null ||
        !("code" in data) ||
        !("data" in data)
      ) {
        throw new GatewayParseError("Invalid broadcast response structure");
      }

      const typedData = data as {
        code: string;
        msg?: string;
        data: unknown[];
      };

      // Check API error code
      if (typedData.code !== "0") {
        throw new GatewayAPIError(
          typedData.code,
          typedData.msg || "Broadcast failed with API error"
        );
      }

      // Parse broadcast result
      if (!Array.isArray(typedData.data) || typedData.data.length === 0) {
        throw new GatewayParseError("Broadcast response data is empty");
      }

      const result = typedData.data[0];
      if (typeof result !== "object" || result === null) {
        throw new GatewayParseError("Invalid broadcast result format");
      }

      const typedResult = result as {
        txHash?: string;
        status?: string;
      };

      const txHash = typedResult.txHash || "";
      if (!txHash) {
        throw new GatewayParseError("No transaction hash in broadcast response");
      }

      return {
        txHash,
        status: "pending", // Broadcast successful, awaiting confirmation
      };
    } catch (err) {
      if (err instanceof GatewayAPIError) {
        throw err;
      }
      if (err instanceof GatewayParseError) {
        throw err;
      }
      if (err instanceof Error && err.name === "AbortError") {
        throw new GatewayTimeoutError(
          `Broadcast request timed out after ${this.timeoutMs}ms`
        );
      }
      throw new GatewayAPIError(
        "UNKNOWN",
        `Broadcast error: ${String(err)}`
      );
    }
  }

  // ================================================================
  // Health Check
  // ================================================================

  /// @notice Check if OKX Gateway is available
  /// @returns true if gateway is available, false otherwise
  async isAvailable(): Promise<boolean> {
    try {
      const path = "/api/v5/wallet/pre-transaction/validate-transaction";
      const method = "POST";
      const body = JSON.stringify({
        chainId: this.chainId.toString(),
        from: "0x0000000000000000000000000000000000000000",
        to: "0x0000000000000000000000000000000000000000",
        data: "0x",
        value: "0",
      });

      const headers = this.generateHeaders(method, path, body);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout for health check

      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
        body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Consider 200-299 and 400-level responses as available (bad request is still a response)
      // 500+ means gateway is down
      return response.status < 500;
    } catch (err) {
      // If we can't reach it, it's not available
      return false;
    }
  }
}
