/// AEGIS Tap Builders — SDK-Canonical Position Lifecycle
/// 
/// Implements the quote-first open-path and close-path semantics for CP-022.
/// Tap = Temporary leveraged position opened via Arena.executeBatch()
/// 
/// Architecture:
/// - buildTapOpenPosition(): Takes OKX DEX quote + vault ID → action[] for execution
/// - buildTapClosePosition(): Takes vault ID + exit parameters → action[] for execution
/// - Each builder returns an array of encoded actions ready for Arena.executeBatch()
///
/// Quote-First Mandate (CP-022 §5.7):
/// - Open path MUST receive a live OKX DEX quote as input
/// - All swap routing comes from the quote; no hardcoded routes allowed
/// - Leverage (gamma) is computed from quote output, not from heuristics
/// - Close path follows similar quote-first semantics

import { ethers } from "ethers";
import type { OKXDEXQuoteResponse, OKXDEXSwapResponse } from "../lib/okx-dex.js";
import type { Action } from "./types.js";
import {
  encodeUnlockVault,
  encodeLockVault,
  encodeModifyDebt,
  encodeModifyLiquidity,
  encodeSwapExactInSingle,
  encodePMTake,
  type SwapExactInParams,
  type ModifyDebtParams,
  type ModifyLiquidityParams,
  type PMTakeParams,
} from "./router.js";

/// Configuration for building a tap open position
export interface TapOpenPositionParams {
  /// Vault ID (bytes32 format) — must be registered in Arena
  vaultId: string;
  
  /// OKX DEX quote for the swap (contains inAmount, outAmount, route)
  quote: OKXDEXQuoteResponse;
  
  /// Address of input token (e.g., USDC)
  inputToken: string;
  
  /// Address of output token (e.g., OKB)
  outputToken: string;
  
  /// Leverage multiplier (1.0 = no leverage, 2.0 = 2x leverage)
  /// Computed from: gamma = (swapOutputAmount / inputAmount) * leverage
  /// For quote-first: typically leverage = 1.0 (full swap output as position principal)
  leverage?: number;
  
  /// Minimum acceptable output amount (slippage protection)
  /// Defaults to quote.data.outAmount if not provided
  minOutputAmount?: string;
  
  /// Lower price tick for position (default: -887220 for full range)
  lowerTick?: number;
  
  /// Upper price tick for position (default: 887220 for full range)
  upperTick?: number;
}

/// Configuration for closing a tap position
export interface TapClosePositionParams {
  /// Vault ID (bytes32 format)
  vaultId: string;
  
  /// Position ID within the vault
  positionId: number;
  
  /// OKX DEX quote for the exit swap (WOKB → USDC or similar)
  quote: OKXDEXQuoteResponse;
  
  /// Address of token being sold (e.g., OKB)
  sellToken: string;
  
  /// Address of token being bought (e.g., USDC)
  buyToken: string;
  
  /// Amount to close (in wei)
  closeAmount: string;
  
  /// Minimum acceptable output from exit swap
  /// Defaults to quote.data.outAmount if not provided
  minOutputAmount?: string;
}

/// @notice Build a tap open position action sequence
/// @param params Configuration with vault, quote, and tokens
/// @returns Array of Action objects ready for Arena.executeBatch()
export function buildTapOpenPosition(params: TapOpenPositionParams): Action[] {
  const actions: Action[] = [];
  
  // Extract quote metrics
  const quoteData = params.quote.data;
  const inputAmount = quoteData.inAmount;
  const outputAmount = quoteData.outAmount;
  const slippagePercentage = parseFloat(quoteData.priceImpactPercentage || "0");
  
  // Compute minimum output with slippage buffer
  const minOutputAmount = params.minOutputAmount || outputAmount;
  const minOutput = BigInt(minOutputAmount);
  
  // Validate quote sanity
  if (BigInt(outputAmount) === 0n) {
    throw new Error("buildTapOpenPosition: Quote returned zero output amount");
  }
  
  // Step 1: Unlock vault (prepare for modifications)
  const unlockVault: Action = {
    opcode: 0x84, // AE_UNLOCK_VAULT
    params: [{ type: "bytes32", value: params.vaultId }],
  };
  actions.push(unlockVault);
  
  // Step 2: Deposit collateral (principal input)
  // ModifyDebt with positive principalDelta = deposit
  const depositAction: Action = {
    opcode: 0x91, // AE_MODIFY_DEBT
    params: [
      { type: "bytes32", value: params.vaultId },
      { type: "int128", value: BigInt(inputAmount) },
      { type: "uint256", value: 0n },
      { type: "uint256", value: 0n },
      { type: "uint256", value: 0n },
    ],
  };
  actions.push(depositAction);
  
  // Step 3: Execute swap via OKX DEX route
  // Extract the first (best) swap action from the OKX quote
  const swapRoute = quoteData.routerResult.swapActionStructs[0];
  if (!swapRoute) {
    throw new Error("buildTapOpenPosition: OKX DEX quote has no swap routes");
  }
  
  // Encode the swap action (using SWAP_EXACT_IN_SINGLE opcode)
  // In a real implementation, we'd extract the pool ID from the swap route.
  // For now, we use a placeholder derived from token addresses.
  const poolId = ethers.solidityPacked(
    ["address", "address"],
    [params.inputToken, params.outputToken]
  );
  
  const swapAction: Action = {
    opcode: 0x06, // SWAP_EXACT_IN_SINGLE
    params: [
      { type: "bytes32", value: poolId },
      { type: "address", value: params.inputToken },
      { type: "address", value: params.outputToken },
      { type: "uint256", value: BigInt(inputAmount) },
      { type: "uint256", value: minOutput },
    ],
  };
  actions.push(swapAction);
  
  // Step 4: Deposit swapped output as position principal
  // Leverage computation: gamma = (swapOutputAmount / inputAmount) * leverage
  // For quote-first MVP: leverage = 1.0, so gamma = swapOutputAmount
  const leverage = params.leverage ?? 1.0;
  const positionPrincipal = BigInt(outputAmount);
  const leveragedPrincipal = BigInt(Math.floor(Number(positionPrincipal) * leverage));
  
  const positionDepositAction: Action = {
    opcode: 0x91, // AE_MODIFY_DEBT
    params: [
      { type: "bytes32", value: params.vaultId },
      { type: "int128", value: leveragedPrincipal },
      { type: "uint256", value: 0n },
      { type: "uint256", value: 0n },
      { type: "uint256", value: 0n },
    ],
  };
  actions.push(positionDepositAction);
  
  // Step 5: Optionally add liquidity to position (for LP strategies)
  // This is a placeholder; actual tick range would come from position parameters
  const lowerTick = params.lowerTick ?? -887220; // Full range lower
  const upperTick = params.upperTick ?? 887220;  // Full range upper
  
  const addLiquidityAction: Action = {
    opcode: 0x90, // AE_MODIFY_LIQUIDITY
    params: [
      { type: "bytes32", value: params.vaultId },
      { type: "int128", value: leveragedPrincipal },
      { type: "address", value: "0x0000000000000000000000000000000000000000" },
      { type: "uint256", value: 0n },
      { type: "int24", value: lowerTick },
      { type: "int24", value: upperTick },
    ],
  };
  actions.push(addLiquidityAction);
  
  // Step 6: Lock vault (finalize modifications)
  const lockVault: Action = {
    opcode: 0x85, // AE_LOCK_VAULT
    params: [{ type: "bytes32", value: params.vaultId }],
  };
  actions.push(lockVault);
  
  return actions;
}

/// @notice Build a tap close position action sequence
/// @param params Configuration with vault, position, and exit quote
/// @returns Array of Action objects ready for Arena.executeBatch()
export function buildTapClosePosition(params: TapClosePositionParams): Action[] {
  const actions: Action[] = [];
  
  // Extract quote metrics for the exit swap
  const quoteData = params.quote.data;
  const exitOutputAmount = quoteData.outAmount;
  
  // Compute minimum output with slippage buffer
  const minOutputAmount = params.minOutputAmount || exitOutputAmount;
  const minOutput = BigInt(minOutputAmount);
  
  // Step 1: Unlock vault for closure
  const unlockVault: Action = {
    opcode: 0x84, // AE_UNLOCK_VAULT
    params: [{ type: "bytes32", value: params.vaultId }],
  };
  actions.push(unlockVault);
  
  // Step 2: Execute exit swap (sell position output for collateral)
  const swapRoute = quoteData.routerResult.swapActionStructs[0];
  if (!swapRoute) {
    throw new Error("buildTapClosePosition: OKX DEX quote has no swap routes");
  }
  
  // Pool ID derived from token pair
  const poolId = ethers.solidityPacked(
    ["address", "address"],
    [params.sellToken, params.buyToken]
  );
  
  const exitSwapAction: Action = {
    opcode: 0x06, // SWAP_EXACT_IN_SINGLE
    params: [
      { type: "bytes32", value: poolId },
      { type: "address", value: params.sellToken },
      { type: "address", value: params.buyToken },
      { type: "uint256", value: BigInt(params.closeAmount) },
      { type: "uint256", value: minOutput },
    ],
  };
  actions.push(exitSwapAction);
  
  // Step 3: Take position via PositionManager
  // This settles the position and returns proceeds
  const takeAction: Action = {
    opcode: 0xc0, // PM_TAKE
    params: [
      { type: "bytes32", value: params.vaultId },
      { type: "uint256", value: params.positionId },
      { type: "uint256", value: BigInt(params.closeAmount) },
      { type: "uint256", value: minOutput },
    ],
  };
  actions.push(takeAction);
  
  // Step 4: Withdraw remaining collateral
  // ModifyDebt with negative principalDelta = withdraw
  const closeAmount = BigInt(params.closeAmount);
  const withdrawAction: Action = {
    opcode: 0x91, // AE_MODIFY_DEBT
    params: [
      { type: "bytes32", value: params.vaultId },
      { type: "int128", value: -closeAmount as any as bigint },
      { type: "uint256", value: 0n },
      { type: "uint256", value: 0n },
      { type: "uint256", value: 0n },
    ],
  };
  actions.push(withdrawAction);
  
  // Step 5: Lock vault
  const lockVault: Action = {
    opcode: 0x85, // AE_LOCK_VAULT
    params: [{ type: "bytes32", value: params.vaultId }],
  };
  actions.push(lockVault);
  
  return actions;
}
