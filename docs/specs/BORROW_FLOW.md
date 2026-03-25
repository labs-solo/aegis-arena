# 3-Batch Borrow Flow (FIX #4 Foundation)

## Important: Two Separate Calls

This document describes the 3-batch AEGIS Router opcode pattern. Arena.executeBatch() is a
*separate* call used to record agent actions for scoring. The two calls are independent:

- `AegisRouterV1.execute(actions)` — submits AEGIS opcodes (unlock, borrow, lock) to the Engine
- `Arena.executeBatch(roundId, agent, actions)` — records the action batch for scoring

In the TypeScript examples below, replace `arena.executeBatch(...)` with `router.execute(...)`
for the actual vault operations.

---

## Why 3 Batches?

The AEGIS Engine uses a **2-phase unlock pattern** for debt operations:
- Phase 1: Lock vault (default state) — prevents accidental state changes
- Phase 2: Unlock for modification — enable PositionManager access during debt ops
- Phase 3: Re-lock vault — secure vault after operations

Splitting into **3 separate batches** ensures PositionManager only has access during the critical borrowing operation.

---

## Batch Structure

### Batch 0: Unlock
```solidity
opcode: AE_UNLOCK_VAULT
params: [vaultId]

Effect:
- Unlocks vault for modification
- No PositionManager unlock (not needed yet)
- Prepares for subsequent operations
```

### Batch 1: Modify Debt (PM Unlock)
```solidity
opcode: AE_MODIFY_DEBT
params: [vaultId, principalDelta, minLiquidityDelta, minIdleAmount0, minIdleAmount1]

Effect:
- **PositionManager is unlocked during this batch**
- Allows debt increase or decrease
- Enforces sqrt(K) solvency check:
  sqrt(K) = sqrt(liquidity) × sqrt(K_constant)
- Can add/remove liquidity or just change debt
```

### Batch 2: Lock
```solidity
opcode: AE_LOCK_VAULT
params: [vaultId]

Effect:
- Re-locks vault after modifications
- Prevents accidental changes
- Security: ensures vault is secure before returning to agent
```

---

## Execution Flow Diagram

```
┌─────────────────────────────────────────┐
│ Agent starts round with 100 USDC        │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ Batch 0: AE_UNLOCK_VAULT                │
│ - State: vault locked → unlocked        │
│ - PM unlock: NO                         │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ Batch 1: AE_MODIFY_DEBT                 │
│ - Borrow 100 USDC (2x leverage)         │
│ - State: principalDelta = +100          │
│ - PM unlock: YES (only this batch!)     │
│ - Solvency: check sqrt(K) >= debt       │
│ - Liquidity state updated               │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ Batch 2: AE_LOCK_VAULT                  │
│ - State: vault unlocked → locked        │
│ - PM unlock: NO                         │
│ - Vault secured for next operations     │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ Agent now has 200 USDC to deploy        │
│ (100 original + 100 borrowed)           │
│                                         │
│ Separate batches deploy capital:        │
│ - Batch N: AE_MODIFY_LIQUIDITY          │
│ - Batch M: SWAP_EXACT_IN                │
│ - Batch K: PM_TAKE (limit orders)       │
└─────────────────────────────────────────┘
```

---

## Code Example: Borrow 100 USDC

### TypeScript SDK Usage

```typescript
import { submitBorrowFlow } from "@aegis-arena/sdk";

const borrowInput = {
  vaultId: "0xabc123...",
  principalDelta: 100n * 10n ** 6n,  // 100 USDC (6 decimals)
  minLiquidityDelta: 0n,
  minIdleAmount0: 0n,  // Min USDC output (set slippage!)
  minIdleAmount1: 0n,  // Min WOKB output
  positionManagerAddress: "0x...",  // From AegisDeployConfig
};

const txHashes = await submitBorrowFlow(
  arenaAddress,
  roundId,
  agentAddress,
  borrowInput,
  async (actions) => {
    // submitFn: submit encoded batch to Arena
    const tx = await arena.executeBatch(roundId, agentAddress, actions);
    await tx.wait();
    return tx.hash;
  }
);

console.log("Batch 0 (unlock):", txHashes[0]);
console.log("Batch 1 (borrow):", txHashes[1]);
console.log("Batch 2 (lock):", txHashes[2]);
```

### Solidity Interaction (Low-level)

```solidity
// From Arena.sol or agent contract

IArena arena = IArena(ARENA_ADDRESS);

// Batch 0: Unlock
bytes[] memory batch0 = new bytes[](1);
batch0[0] = abi.encodePacked(
  OPCODE_AE_UNLOCK_VAULT,
  abi.encode(vaultId)
);
arena.executeBatch(roundId, address(this), batch0);

// Batch 1: Modify debt (PM unlocked here)
bytes[] memory batch1 = new bytes[](1);
batch1[0] = abi.encodePacked(
  OPCODE_AE_MODIFY_DEBT,
  abi.encode(
    vaultId,
    int128(principalDelta),  // +100 USDC
    minLiquidityDelta,
    minIdleAmount0,
    minIdleAmount1
  )
);
arena.executeBatch(roundId, address(this), batch1);

// Batch 2: Lock
bytes[] memory batch2 = new bytes[](1);
batch2[0] = abi.encodePacked(
  OPCODE_AE_LOCK_VAULT,
  abi.encode(vaultId)
);
arena.executeBatch(roundId, address(this), batch2);
```

---

## Why Not 2 Batches?

If we tried to unlock and borrow in a single batch:

```solidity
// ❌ WRONG: Can't do both safely
batch[0] = UNLOCK_VAULT
batch[1] = MODIFY_DEBT  // PM access granted by batch[0], but when?
```

The issue: **When does PM unlock apply?**
- If applied to entire batch: PM is unlocked during other ops too (security risk)
- If applied only to specific op: requires more complex routing

**Solution:** Separate batches ensure PM unlock scope is clear.

---

## Repayment Flow (Negative principalDelta)

Same 3-batch structure, but with negative principalDelta:

```typescript
const repayInput = {
  vaultId: "0xabc123...",
  principalDelta: -50n * 10n ** 6n,  // Repay 50 USDC (negative)
  minLiquidityDelta: 0n,
  minIdleAmount0: 50n * 10n ** 6n,  // Expect 50 USDC back
  minIdleAmount1: 0n,
};

// Same flow:
// Batch 0: Unlock
// Batch 1: Modify debt (principalDelta = -50)
// Batch 2: Lock
```

---

## Debt Check: sqrt(K) Solvency

AEGIS enforces **sqrt(K) solvency** instead of Compound-style health factors:

```
sqrt(K) = sqrt(liquidity_provided) × K_constant

Requirement: sqrt(K) >= total_debt

Example:
- Liquidity provided: 100 sL shares = 10,000 sqrt units
- Debt limit: K_constant × sqrt(10,000) ≈ 10,000 USDC
- Agent borrows 100 USDC: ✓ OK (100 < 10,000)
- Agent borrows 15,000 USDC: ✗ REVERTED (15,000 > 10,000)
```

**Batch 1 verifies this check. If it fails, the batch reverts (agent keeps original state).**

---

## Error Scenarios

### Error Scenario: Batch 1 Failure Leaves Vault Unlocked

```
Agent borrows 100 USDC, but sqrt(K) = 50 USDC
→ AE_MODIFY_DEBT reverts
→ Batch 1 fails
→ Batch 2 never executes
→ **ISSUE:** Vault is left in unlocked state!
```

**Current behavior:** If Batch 1 (AE_MODIFY_DEBT) reverts after Batch 0 (AE_UNLOCK_VAULT)
has executed, the vault is left in an unlocked state.

**Status:** Known issue — no viable resolution in the current architecture.
- "Check solvency before submitting" reduces the window but does not eliminate it
  (race condition between check and submission).
- A single-transaction atomic batch (all 3 operations atomic) would resolve this but
  requires contract changes outside this CP's scope.

**Mitigation for MVP:** Monitor vault state after any failed batch. If vault shows
unlocked state after a failed borrow attempt, manually submit Batch 2 (AE_LOCK_VAULT)
to restore safe state before proceeding.

**Post-hackathon fix:** Implement atomic 3-batch wrapper at the contract level.

### Network Congestion
```
Batch 0: Unlocks vault ✓
Batch 1: Never submitted (network issue)
Batch 2: Attempts to execute
→ Lock operation succeeds (idempotent)
→ **Result:** Vault is locked but modifications may be incomplete
```

**Solution:** Monitor all 3 batches; retry if any fails.

---

## Implementation Checklist

- [ ] Generate 3 separate batches (don't merge them)
- [ ] Batch 0: AE_UNLOCK_VAULT only
- [ ] Batch 1: AE_MODIFY_DEBT only (PM unlocked here)
- [ ] Batch 2: AE_LOCK_VAULT only
- [ ] Submit in order (0 → 1 → 2)
- [ ] Wait for each tx receipt before submitting next
- [ ] Check sqrt(K) solvency before Batch 1
- [ ] Handle failures gracefully (retry or revert)
- [ ] Log all 3 tx hashes for debugging

