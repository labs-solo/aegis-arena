/// OKX DEX API Integration
/// Quote aggregation for X Layer (chain 196)
///
/// Implements quote-first open-path workflow per CP-022:
/// - Fetches aggregated DEX quotes from OKX aggregator
/// - Returns route with swap input/output for canonical SDK integration
/// - No hardcoded paths; all routes come from OKX aggregator
///
/// Public API is open (no auth required for quotes on web3.okx.com endpoint)

import axios from 'axios';

export interface OKXDEXQuoteRequest {
  chainId: string; // "196" for X Layer
  fromTokenAddress: string; // Token to sell
  toTokenAddress: string; // Token to buy
  amount: string; // Amount in wei
  slippage: string; // Slippage tolerance as decimal string (e.g., "0.5" for 0.5%)
}

export interface OKXDEXQuoteResponse {
  code: string; // "0" for success
  msg: string;
  data: {
    chainId: string;
    fromToken: {
      chainId: string;
      address: string;
      symbol: string;
      name: string;
      decimals: number;
      logoUrl: string;
      level: number;
      priceUsd: string;
    };
    toToken: {
      chainId: string;
      address: string;
      symbol: string;
      name: string;
      decimals: number;
      logoUrl: string;
      level: number;
      priceUsd: string;
    };
    inAmount: string; // Input amount
    outAmount: string; // Output amount
    quoteCompareRes: Array<{
      name: string;
      inAmount: string;
      outAmount: string;
    }>;
    routerResult: {
      swapActionStructs: Array<{
        protocol: string;
        tokenIn: string;
        tokenOut: string;
        tokenInAmount: string;
        tokenOutAmount: string;
        details: {
          swapRouter: string;
          swapData: string;
          tokenApproveTarget: string;
        };
      }>;
    };
    gasUsd: string;
    priceImpactPercentage: string;
    slippage: string;
  };
}

export interface OKXDEXSwapRequest {
  chainId: string;
  fromTokenAddress: string;
  toTokenAddress: string;
  amount: string;
  slippage: string;
  userWalletAddress: string; // Address executing the swap
}

export interface OKXDEXSwapResponse {
  code: string;
  msg: string;
  data: {
    routerResult: {
      swapActionStructs: Array<{
        protocol: string;
        tokenIn: string;
        tokenOut: string;
        tokenInAmount: string;
        tokenOutAmount: string;
        details: {
          swapRouter: string;
          swapData: string;
          tokenApproveTarget: string;
        };
      }>;
      tx: {
        from: string;
        to: string;
        data: string;
        value: string;
        gasPrice?: string;
        gas?: string;
      };
    };
  };
}

export class OKXDEXClient {
  private readonly baseUrl = 'https://web3.okx.com/api/v5/dex/aggregator';
  private readonly chainId = '196'; // X Layer
  private readonly slippageDefault = '1'; // 1% default slippage tolerance

  /// @notice Fetch a quote from OKX DEX aggregator
  /// @param fromToken Token address to sell
  /// @param toToken Token address to buy
  /// @param amount Amount in wei
  /// @param slippage Optional slippage tolerance as string percent (e.g., "0.5" for 0.5%)
  /// @returns Quote response with aggregated best route
  async getQuote(
    fromToken: string,
    toToken: string,
    amount: string,
    slippage: string = this.slippageDefault
  ): Promise<OKXDEXQuoteResponse> {
    const params: OKXDEXQuoteRequest = {
      chainId: this.chainId,
      fromTokenAddress: fromToken,
      toTokenAddress: toToken,
      amount,
      slippage,
    };

    try {
      const response = await axios.get<OKXDEXQuoteResponse>(
        `${this.baseUrl}/quote`,
        { params }
      );

      if (response.data.code !== '0') {
        throw new Error(
          `OKX DEX quote failed: ${response.data.msg} (code: ${response.data.code})`
        );
      }

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          `OKX DEX API error: ${error.response?.status} ${error.response?.data?.msg || error.message}`
        );
      }
      throw error;
    }
  }

  /// @notice Get swap calldata from OKX DEX aggregator
  /// @param fromToken Token address to sell
  /// @param toToken Token address to buy
  /// @param amount Amount in wei
  /// @param slippage Slippage tolerance as string percent
  /// @param walletAddress Address that will execute the swap
  /// @returns Swap response with encoded transaction calldata
  async getSwapCalldata(
    fromToken: string,
    toToken: string,
    amount: string,
    slippage: string = this.slippageDefault,
    walletAddress: string
  ): Promise<OKXDEXSwapResponse> {
    const params: OKXDEXSwapRequest = {
      chainId: this.chainId,
      fromTokenAddress: fromToken,
      toTokenAddress: toToken,
      amount,
      slippage,
      userWalletAddress: walletAddress,
    };

    try {
      const response = await axios.get<OKXDEXSwapResponse>(
        `${this.baseUrl}/swap`,
        { params }
      );

      if (response.data.code !== '0') {
        throw new Error(
          `OKX DEX swap failed: ${response.data.msg} (code: ${response.data.code})`
        );
      }

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          `OKX DEX API error: ${error.response?.status} ${error.response?.data?.msg || error.message}`
        );
      }
      throw error;
    }
  }

  /// @notice Extract swap action structs from a quote response for canonical SDK integration
  /// @param quote Quote response from getQuote
  /// @returns Array of swap action structures suitable for SDK tap builder input
  extractSwapActions(quote: OKXDEXQuoteResponse) {
    return quote.data.routerResult.swapActionStructs;
  }

  /// @notice Extract key metrics from quote for open-path construction
  /// @param quote Quote response from getQuote
  /// @returns Object with input/output amounts and slippage info
  extractQuoteMetrics(quote: OKXDEXQuoteResponse) {
    return {
      inAmount: quote.data.inAmount,
      outAmount: quote.data.outAmount,
      priceImpactPercentage: quote.data.priceImpactPercentage,
      slippage: quote.data.slippage,
    };
  }
}

/// Export singleton instance
export const okxDexClient = new OKXDEXClient();
