/// 3-Batch Borrow Flow Implementation (FIX #4)
///
/// AEGIS requires 3 separate batches for debt modification:
/// 1. Batch 0: AE_UNLOCK_VAULT (no PM unlock)
/// 2. Batch 1: AE_MODIFY_DEBT (PM unlocked during this batch)
/// 3. Batch 2: AE_LOCK_VAULT (no PM unlock)
///
/// This pattern ensures PositionManager only has vault access during
/// the critical debt-modification operation.

import { BorrowFlowInput, BorrowFlowOutput } from './types.js';
import {
  encodeUnlockVault,
  encodeLockVault,
  encodeModifyDebt,
  ModifyDebtParams,
} from './router.js';

/// @notice Encode borrow flow into 3 batches
/// @param input Borrow parameters (vaultId, principalDelta, etc.)
/// @returns { batch0, batch1, batch2 } with encoded actions
export function encodeBorrowFlow(input: BorrowFlowInput): BorrowFlowOutput {
  // Batch 0: Unlock vault
  // - No PositionManager unlock required
  // - Prepares vault for subsequent operations
  const batch0 = [encodeUnlockVault(input.vaultId)];

  // Batch 1: Modify debt (borrow capital)
  // - **PositionManager is unlocked during this batch ONLY**
  // - Allows debt increase with proper liquidation checks
  // - Must include minimum output/slippage protection
  const modifyDebtParams: ModifyDebtParams = {
    vaultId: input.vaultId,
    principalDelta: input.principalDelta,
    minLiquidityDelta: input.minLiquidityDelta,
    minIdleAmount0: input.minIdleAmount0,
    minIdleAmount1: input.minIdleAmount1,
  };
  const batch1 = [encodeModifyDebt(modifyDebtParams)];

  // Batch 2: Lock vault
  // - No PositionManager unlock
  // - Security: re-locks vault after operations
  // - Prevents accidental debt changes after settlement
  const batch2 = [encodeLockVault(input.vaultId)];

  return { batch0, batch1, batch2 };
}

/// @notice Submit all 3 borrow flow batches to Arena contract
/// @param arenaAddress Arena contract address
/// @param roundId Current round ID
/// @param agentAddress Agent executing the borrow
/// @param borrowInput Borrow parameters
/// @param submitFn Function to submit batch (returns tx hash)
/// @returns Array of transaction hashes for all 3 batches
export async function submitBorrowFlow(
  arenaAddress: string,
  roundId: number,
  agentAddress: string,
  borrowInput: BorrowFlowInput,
  submitFn: (actions: string[]) => Promise<string>
): Promise<string[]> {
  const { batch0, batch1, batch2 } = encodeBorrowFlow(borrowInput);
  const txHashes: string[] = [];

  // Batch 0: Unlock
  const tx0 = await submitFn(batch0);
  txHashes.push(tx0);
  console.log(`Batch 0 (unlock): ${tx0}`);

  // Batch 1: Modify debt (PM unlocked)
  const tx1 = await submitFn(batch1);
  txHashes.push(tx1);
  console.log(`Batch 1 (borrow): ${tx1}`);

  // Batch 2: Lock
  const tx2 = await submitFn(batch2);
  txHashes.push(tx2);
  console.log(`Batch 2 (lock): ${tx2}`);

  return txHashes;
}

/// @notice Example borrow scenario
/// Agent wants to borrow 10 USDC with 2x leverage:
/// - Initial capital: 10 USDC
/// - Borrow: 10 USDC
/// - Total to deploy: 20 USDC
///
/// Execution:
/// 1. Unlock vault
/// 2. AE_MODIFY_DEBT with principalDelta = +10 USDC
///    - PositionManager unlocked here
///    - Borrow executed
///    - Check: agent still solvent under sqrt(K) model
/// 3. Lock vault
/// 4. (Separately) Deploy 20 USDC via AE_MODIFY_LIQUIDITY or swaps
export const exampleBorrowScenario = {
  vaultId: "0x...",
  initialCapital: 10n * 10n ** 6n, // 10 USDC
  borrowAmount: 10n * 10n ** 6n, // 10 USDC
  totalDeployable: 20n * 10n ** 6n, // 20 USDC after borrow
};
