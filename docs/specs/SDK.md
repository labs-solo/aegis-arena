# TypeScript SDK Guide

## Installation

```bash
npm install aegis-arena
```

## Imports

```typescript
import {
  OPCODES,
  encodeAction,
  encodeBatch,
  encodeBorrowFlow,
  GameState,
  Action,
  BorrowFlowInput,
  KNOWN_ADDRESSES,
  CHAIN_CONFIG,
} from "aegis-arena/sdk";
```

---

## Opcode Reference

### Swap Opcodes
```typescript
OPCODES.SWAP_EXACT_IN_SINGLE     // 0x06
OPCODES.SWAP_EXACT_IN            // 0x07
OPCODES.SWAP_EXACT_OUT_SINGLE    // 0x08
OPCODES.SWAP_EXACT_OUT           // 0x09
```

### AEGIS Core Opcodes
```typescript
OPCODES.AE_CREATE_VAULT          // 0x83
OPCODES.AE_UNLOCK_VAULT          // 0x84
OPCODES.AE_LOCK_VAULT            // 0x85
OPCODES.AE_MODIFY_LIQUIDITY      // 0x90
OPCODES.AE_MODIFY_DEBT           // 0x91 (debt = borrow/repay)
OPCODES.AE_MODIFY_IDLE           // 0x92
OPCODES.AE_PEEL_OR_MICRO_LIQUIDATE // 0x96
```

### PositionManager Opcodes
```typescript
OPCODES.PM_SETTLE_FOR            // 0xB0
OPCODES.PM_TAKE                  // 0xC0
OPCODES.PM_CLOSE                 // 0xC2
OPCODES.LOM_SETTLE_FOR           // 0xB8
OPCODES.LOM_TAKE                 // 0xC4
OPCODES.LOM_CLOSE                // 0xC6
```

---

## Encoding Actions

### Single Action

```typescript
import { encodeAction } from "aegis-arena/sdk";

const action = encodeAction(OPCODES.AE_UNLOCK_VAULT, [
  { type: "bytes32", value: "0xvaultId..." },
]);

console.log(action);
// Output: 0x84<encoded_params>
```

### Batch Actions

```typescript
import { encodeBatch } from "aegis-arena/sdk";

const actions = [
  {
    opcode: OPCODES.AE_UNLOCK_VAULT,
    params: [{ type: "bytes32", value: "0xvaultId..." }],
  },
  {
    opcode: OPCODES.AE_MODIFY_DEBT,
    params: [
      { type: "bytes32", value: "0xvaultId..." },
      { type: "int128", value: 100n * 10n ** 6n },
      { type: "uint256", value: 0n },
      { type: "uint256", value: 0n },
      { type: "uint256", value: 0n },
    ],
  },
];

const encoded = encodeBatch(actions);
// Returns: ["0x84<params>", "0x91<params>"]
```

---

## 3-Batch Borrow Flow (FIX #4)

```typescript
import { submitBorrowFlow } from "aegis-arena/sdk";

const borrowInput = {
  vaultId: "0xabc123...",
  principalDelta: 100n * 10n ** 6n,  // Borrow 100 USDC
  minLiquidityDelta: 0n,
  minIdleAmount0: 0n,
  minIdleAmount1: 0n,
  positionManagerAddress: "0x...",
};

const txHashes = await submitBorrowFlow(
  arenaAddress,
  roundId,
  agentAddress,
  borrowInput,
  async (actions) => {
    const tx = await arena.executeBatch(roundId, agentAddress, actions);
    await tx.wait();
    return tx.hash;
  }
);

console.log("Batch 0 (unlock):", txHashes[0]);
console.log("Batch 1 (borrow):", txHashes[1]);
console.log("Batch 2 (lock):", txHashes[2]);
```

---

## Known Addresses

```typescript
import { KNOWN_ADDRESSES, CHAIN_CONFIG } from "aegis-arena/sdk";

console.log(KNOWN_ADDRESSES.WOKB);              // 0xe538905c...
console.log(KNOWN_ADDRESSES.USDC);              // 0x74b7f163...
console.log(KNOWN_ADDRESSES.LIVE_POOL_ID);      // 0x907210...
console.log(CHAIN_CONFIG.chainId);              // 196
console.log(CHAIN_CONFIG.rpc);                  // https://rpc.xlayer.tech
```

---

## Agent Integration

### Extend BaseAgent

```typescript
import { BaseAgent, GameState, Action } from "aegis-arena/sdk";
import { Signer } from "ethers";

export class MyAgent extends BaseAgent {
  constructor(
    agentAddress: string,
    initialAllocation: bigint,
    arenaAddress: string,
    signer: Signer
  ) {
    super("MyAgent", agentAddress, initialAllocation, arenaAddress, signer);
  }

  async decideAction(state: GameState): Promise<Action[]> {
    const actions: Action[] = [];

    // Implement strategy logic here
    if (state.currentPortfolioValue > this.initialAllocation) {
      // Taking profit
      actions.push({
        opcode: OPCODES.SWAP_EXACT_IN_SINGLE,
        params: [
          { type: "bytes32", value: KNOWN_ADDRESSES.LIVE_POOL_ID },
          { type: "address", value: KNOWN_ADDRESSES.WOKB },
          { type: "address", value: KNOWN_ADDRESSES.USDC },
          { type: "uint256", value: state.currentLiquidity },
          { type: "uint256", value: 0n },
        ],
      });
    }

    return actions;
  }
}
```

### Scoring Calculation

```typescript
// From SCORING.md formula

function calculatePortfolioValue(
  sLBalance: bigint,
  totalSLSupply: bigint,
  poolUSDCReserves: bigint,
  wokbBalance: bigint,
  sqrtPriceX96: bigint,
  idleUSDC: bigint
): bigint {
  // sL → USDC
  const slToUSDC = (sLBalance * poolUSDCReserves) / totalSLSupply;

  // WOKB → USDC: price = (sqrtPrice / 2^96)^2
  const sqrtPrice = sqrtPriceX96 / 2n ** 96n;
  const price = sqrtPrice * sqrtPrice;
  const wokbToUSDC = wokbBalance * price;

  // Total
  return slToUSDC + wokbToUSDC + idleUSDC;
}
```

---

## Type Definitions

### GameState
```typescript
interface GameState {
  roundId: number;
  timeRemaining: number;          // seconds
  agentVaultId: string;
  currentPortfolioValue: bigint;  // USDC
  currentLiquidity: bigint;       // sL shares
  currentDebt: bigint;            // borrowed amount
  currentIdle: bigint;            // idle tokens
  poolPrice: bigint;              // sqrtPriceX96
}
```

### Action
```typescript
interface Action {
  opcode: number;
  params: { type: string; value: any }[];
}
```

### BorrowFlowInput
```typescript
interface BorrowFlowInput {
  vaultId: string;
  principalDelta: bigint;
  minLiquidityDelta: bigint;
  minIdleAmount0: bigint;
  minIdleAmount1: bigint;
  positionManagerAddress: string;
}
```

---

## Error Handling

```typescript
import { isValidOpcode } from "aegis-arena/sdk";

try {
  if (!isValidOpcode(0xFF)) {
    throw new Error("Invalid opcode");
  }

  const encoded = encodeAction(0x90, params);
  console.log("Action encoded:", encoded);
} catch (err) {
  console.error("Encoding failed:", err.message);
}
```

---

## Common Patterns

### Provide Liquidity
```typescript
const liquidityAction = encodeModifyLiquidity({
  vaultId: "0x...",
  deltaLiquidity: 50n * 10n ** 6n,
  recipient: agentAddress,
  minDeltaShares: 0n,
  lowerTick: -887272,    // Full range
  upperTick: 887272,
});
```

### Swap USDC → WOKB
```typescript
const swapAction = encodeSwapExactInSingle({
  poolId: KNOWN_ADDRESSES.LIVE_POOL_ID,
  tokenIn: KNOWN_ADDRESSES.USDC,
  tokenOut: KNOWN_ADDRESSES.WOKB,
  amountIn: 100n * 10n ** 6n,
  minAmountOut: 0n,  // Set slippage protection!
});
```

### Borrow Capital
```typescript
const { batch0, batch1, batch2 } = encodeBorrowFlow({
  vaultId: "0x...",
  principalDelta: 100n * 10n ** 6n,  // Borrow 100 USDC
  minLiquidityDelta: 0n,
  minIdleAmount0: 0n,
  minIdleAmount1: 0n,
  positionManagerAddress: POSITION_MANAGER,
});

// Submit in order: batch0, batch1, batch2
```

