/// AEGIS Router Calldata Encoding

import { AbiCoder } from "ethers";
import { Action, ActionParam } from "./types";
import { OPCODES, isValidOpcode } from "./opcodes";

const abiCoder = AbiCoder.defaultAbiCoder();
export const ARENA_EXECUTION_METADATA_TAG = 0xfe;

/// @notice Encode a single action with opcode and parameters
/// @param opcode The operation code
/// @param params Array of {type, value} parameter definitions
/// @returns Hex-encoded action bytes
export function encodeAction(opcode: number, params: ActionParam[]): string {
  if (!isValidOpcode(opcode)) {
    throw new Error(`Invalid opcode: 0x${opcode.toString(16)}`);
  }

  // Extract types and values from params
  const types = params.map((p) => p.type);
  const values = params.map((p) => p.value);

  // Encode parameters using ethers AbiCoder
  let encoded: string;
  try {
    encoded = abiCoder.encode(types, values);
  } catch (err) {
    throw new Error(`Parameter encoding failed: ${String(err)}`);
  }

  // Prepend opcode as first byte
  const opcodeByte = `0x${opcode.toString(16).padStart(2, "0")}`;
  return opcodeByte + encoded.slice(2);
}

/// @notice Encode a batch of actions
/// @param actions Array of Action objects
/// @returns Array of hex-encoded action bytes
export function encodeBatch(actions: Action[]): string[] {
  return actions.map((action) => encodeAction(action.opcode, action.params));
}

export interface ArenaExecutionMetadataParams {
  surface: string;
  volumeUsdc: bigint;
  avgPriceX96: bigint;
  version?: number;
}

/// @notice Encode the Arena-side execution metadata envelope.
/// @dev This is not forwarded to AEGIS. Arena consumes it as the first batch item.
export function encodeArenaExecutionMetadata(params: ArenaExecutionMetadataParams): string {
  const encoded = abiCoder.encode(
    ["uint8", "address", "uint256", "uint256"],
    [params.version ?? 1, params.surface, params.volumeUsdc, params.avgPriceX96]
  );

  return `0x${ARENA_EXECUTION_METADATA_TAG.toString(16)}${encoded.slice(2)}`;
}

// ================================================================
// Convenience Encoders for Common Operations
// ================================================================

export interface SwapExactInParams {
  poolId: string; // bytes32
  tokenIn: string; // address
  tokenOut: string; // address
  amountIn: bigint;
  minAmountOut: bigint;
}

/// Encode SWAP_EXACT_IN_SINGLE opcode
export function encodeSwapExactInSingle(params: SwapExactInParams): string {
  return encodeAction(OPCODES.SWAP_EXACT_IN_SINGLE, [
    { type: "bytes32", value: params.poolId },
    { type: "address", value: params.tokenIn },
    { type: "address", value: params.tokenOut },
    { type: "uint256", value: params.amountIn },
    { type: "uint256", value: params.minAmountOut },
  ]);
}

export interface ModifyLiquidityParams {
  vaultId: string; // bytes32
  deltaLiquidity: bigint; // int128
  recipient: string; // address
  minDeltaShares: bigint;
  lowerTick: number; // int24
  upperTick: number; // int24
}

/// Encode AE_MODIFY_LIQUIDITY opcode
export function encodeModifyLiquidity(params: ModifyLiquidityParams): string {
  return encodeAction(OPCODES.AE_MODIFY_LIQUIDITY, [
    { type: "bytes32", value: params.vaultId },
    { type: "int128", value: params.deltaLiquidity },
    { type: "address", value: params.recipient },
    { type: "uint256", value: params.minDeltaShares },
    { type: "int24", value: params.lowerTick },
    { type: "int24", value: params.upperTick },
  ]);
}

export interface ModifyDebtParams {
  vaultId: string; // bytes32
  principalDelta: bigint; // int128
  minLiquidityDelta: bigint;
  minIdleAmount0: bigint;
  minIdleAmount1: bigint;
}

/// Encode AE_MODIFY_DEBT opcode
export function encodeModifyDebt(params: ModifyDebtParams): string {
  return encodeAction(OPCODES.AE_MODIFY_DEBT, [
    { type: "bytes32", value: params.vaultId },
    { type: "int128", value: params.principalDelta },
    { type: "uint256", value: params.minLiquidityDelta },
    { type: "uint256", value: params.minIdleAmount0 },
    { type: "uint256", value: params.minIdleAmount1 },
  ]);
}

/// Encode AE_UNLOCK_VAULT opcode
export function encodeUnlockVault(vaultId: string): string {
  return encodeAction(OPCODES.AE_UNLOCK_VAULT, [
    { type: "bytes32", value: vaultId },
  ]);
}

/// Encode AE_LOCK_VAULT opcode
export function encodeLockVault(vaultId: string): string {
  return encodeAction(OPCODES.AE_LOCK_VAULT, [
    { type: "bytes32", value: vaultId },
  ]);
}

/// Encode PM_TAKE opcode (settle position via PositionManager)
export interface PMTakeParams {
  vaultId: string; // bytes32
  positionId: number;
  amountIn: bigint;
  minAmountOut: bigint;
}

export function encodePMTake(params: PMTakeParams): string {
  return encodeAction(OPCODES.PM_TAKE, [
    { type: "bytes32", value: params.vaultId },
    { type: "uint256", value: params.positionId },
    { type: "uint256", value: params.amountIn },
    { type: "uint256", value: params.minAmountOut },
  ]);
}
