# TrendFollower On-Chain Migration Execution Runbook

**Version:** 1.0  
**Date:** 2026-03-25  
**Chain:** X Layer (Chain ID 196)  
**RPC:** https://rpc.xlayer.tech  
**Agent:** TrendFollower (`0x7287Ce9c02BeE9615fFBF3A690cd9179E6287bC1`)  
**Vault ID:** 4  

---

## Overview

This runbook documents every on-chain transaction phase for TrendFollower's migration from current holdings to a leveraged tap position and back. Each phase includes:

- **Exact cast commands** for verification and execution
- **Expected token flows** at each step
- **ABI-encoded calldata** for Arena.executeBatch()
- **Gas estimates** and simulated outputs
- **Post-transaction verification** steps

**This document is copy-paste ready.** Use `$PRIVATE_KEY` placeholder for the deployer key; never commit actual keys.

---

## Context: Current Holdings

```
TrendFollower Address: 0x7287Ce9c02BeE9615fFBF3A690cd9179E6287bC1
Vault ID: 4

Current Balances:
- OKB: ~0.016 OKB
- USD₮0: ~786.97 USD₮0 (decimals: 6)
- ERC-6909 LP Shares: 1,407,624,784,789 shares (from Pool 0xd5a401023b6ee3ae340bfadb90758385dc9d2463a20dc24e43e913bc7f209cf4)

Arena Config:
- Round ID: 1 (example; use actual active round)
- Arena Address: 0x77189D65156fC82C422F73Ed3c63F4e5F2c00bBA
- Bounty Address: 0xf3C8c2eac069E44030A36C6D15F1009dF882Be75
```

---

## Key Contract Addresses (X Layer)

| Contract | Address | Role |
|----------|---------|------|
| Arena | `0x77189D65156fC82C422F73Ed3c63F4e5F2c00bBA` | Game orchestrator; executeBatch entry point |
| Bounty | `0xf3C8c2eac069E44030A36C6D15F1009dF882Be75` | Bounty logic and claims |
| AEGIS Engine | `0x1b0ed1d21b5AB3Db311C1aC386DC874081914935` | Core lending/liquidity engine |
| AegisRouter | `0xb2830032E19A85e03cDE678FF93Da659C90CAFe5` | Router for executable actions |
| PositionManager | `0xcF1EAFC6928dC385A342E7C6491d371d2871458b` | Debt/position modifications |
| LimitOrderManager | `0xCc7F9dC1C6BA855E2507c9C65910B48A7F6497C1` | Limit order lifecycle |
| StateView | `0xE962612Dc9dcC3a7666F5Fa6B014b3b1D9287D27` | State query interface |
| VaultRegistry | `0xe19414e5C3DB1596f583d18d3Ac5bb43CBabc50D` | Vault registry and tracking |

---

## Token Addresses (X Layer)

| Token | Address | Decimals | Notes |
|-------|---------|----------|-------|
| OKB (wrapped) | `0xe538905cf8410324e03A5A23C1c177a474D59b2b` | 18 | Native OKB wrapped to ERC-20 |
| USD₮0 | `0x779Ded0c9e1022225f8E0630b35a9b54bE713736` | 6 | Stablecoin on X Layer |
| USDC | `0x74b7F16337b8972027F6196A17a631aC6dE26d22` | 6 | Circle USDC (backup) |

---

## Arena.executeBatch Architecture

The Arena contract's `executeBatch()` function accepts:

```solidity
function executeBatch(uint256 roundId, address agent, bytes[] calldata actions) external
```

- **roundId**: Active Arena round ID
- **agent**: Agent address (must be caller or Arena owner)
- **actions**: Array of ABI-encoded action bytes

Each `actions[]` element is a bytes payload that encodes:
- Opcode (1 byte) indicating the operation type
- Operands (variable) specific to the opcode

### Opcode Reference

From `AegisDeployConfig.sol`:

| Opcode | Name | Purpose |
|--------|------|---------|
| `0x06` | SWAP_EXACT_IN_SINGLE | Swap exact input (single hop) |
| `0x80` | SETTLE_AE | Settle AEGIS position |
| `0x81` | TAKE_AE | Take/open AEGIS position |
| `0x82` | CLOSE_AE | Close AEGIS position |
| `0x89` | AE_BURN_VAULT | Burn vault NFT |
| `0x90` | AE_MODIFY_LIQUIDITY | Modify LP position liquidity |
| `0x91` | AE_MODIFY_DEBT | Modify vault debt |
| `0xB0` | PM_SETTLE_FOR | PositionManager settle |
| `0xC0` | PM_TAKE | PositionManager take |
| `0xC2` | PM_CLOSE | PositionManager close |

---

## Phase 0: Pre-Flight Checks

**Purpose:** Verify on-chain state matches expectations before any transaction.

### 0.1 Verify Round Status

```bash
# Check if round is active and within time window
cast call \
  0x77189D65156fC82C422F73Ed3c63F4e5F2c00bBA \
  "isRoundActive(uint256)" \
  1 \
  --rpc-url https://rpc.xlayer.tech
```

**Expected output:** `0x01` (true — round is active)

### 0.2 Verify Agent Registration

```bash
# Fetch vault ID for TrendFollower in round 1
cast call \
  0x77189D65156fC82C422F73Ed3c63F4e5F2c00bBA \
  "getAgentVault(uint256,address)" \
  1 \
  0x7287Ce9c02BeE9615fFBF3A690cd9179E6287bC1 \
  --rpc-url https://rpc.xlayer.tech
```

**Expected output:** `0x0000000000000000000000000000000000000000000000000000000000000004` (Vault ID 4 in decimal)

### 0.3 Verify TrendFollower Balance (OKB)

```bash
# Check WOKB balance of TrendFollower
cast call \
  0xe538905cf8410324e03A5A23C1c177a474D59b2b \
  "balanceOf(address)" \
  0x7287Ce9c02BeE9615fFBF3A690cd9179E6287bC1 \
  --rpc-url https://rpc.xlayer.tech
```

**Expected output:** ~`16000000000000000` wei (0.016 OKB)

### 0.4 Verify TrendFollower Balance (USD₮0)

```bash
# Check USD₮0 balance of TrendFollower
cast call \
  0x779Ded0c9e1022225f8E0630b35a9b54bE713736 \
  "balanceOf(address)" \
  0x7287Ce9c02BeE9615fFBF3A690cd9179E6287bC1 \
  --rpc-url https://rpc.xlayer.tech
```

**Expected output:** ~`786970000` wei (786.97 USD₮0, with 6 decimals)

### 0.5 Verify Vault Exists in Registry

```bash
# Check vault ownership and status
cast call \
  0xe19414e5C3DB1596f583d18d3Ac5bb43CBabc50D \
  "vaultOwner(uint256)" \
  4 \
  --rpc-url https://rpc.xlayer.tech
```

**Expected output:** `0x7287ce9c02bee9615ffbf3a690cd9179e6287bc1` (TrendFollower owns vault 4)

### 0.6 Check Arena Round Time Window

```bash
# Fetch round state: startTime, endTime, duration, settled, agents
cast call \
  0x77189D65156fC82C422F73Ed3c63F4e5F2c00bBA \
  "getRoundState(uint256)" \
  1 \
  --rpc-url https://rpc.xlayer.tech
```

**Expected output:** (tuple with startTime, endTime, roundDuration, false, agents[])
- Ensure `block.timestamp < endTime` (round not ended)

---

## Phase 0.5: Token Approvals

**Purpose:** Grant necessary spenders permission to move TrendFollower's tokens.

### 0.5.1 Approve USD₮0 to AegisRouter

The AegisRouter needs approval to spend USD₮0 for swap operations.

```bash
# Approve 1000 USD₮0 (1000 * 10^6 wei) to AegisRouter for swaps
cast send \
  0x779Ded0c9e1022225f8E0630b35a9b54bE713736 \
  "approve(address,uint256)" \
  0xb2830032E19A85e03cDE678FF93Da659C90CAFe5 \
  1000000000 \
  --private-key $PRIVATE_KEY \
  --rpc-url https://rpc.xlayer.tech
```

**Token flow:** `USD₮0 (TrendFollower) → [Allowance stored] → AegisRouter`

**Verification (post-transaction):**

```bash
cast call \
  0x779Ded0c9e1022225f8E0630b35a9b54bE713736 \
  "allowance(address,address)" \
  0x7287Ce9c02BeE9615fFBF3A690cd9179E6287bC1 \
  0xb2830032E19A85e03cDE678FF93Da659C90CAFe5 \
  --rpc-url https://rpc.xlayer.tech
```

**Expected output:** `0x00000000000000000000000000000000000000000000000000000000e8d4a51000` (1000 USD₮0)

---

### 0.5.2 Approve OKB to AegisRouter

The AegisRouter needs approval to spend OKB for swap operations.

```bash
# Approve 100 OKB (100 * 10^18 wei) to AegisRouter for swaps
cast send \
  0xe538905cf8410324e03A5A23C1c177a474D59b2b \
  "approve(address,uint256)" \
  0xb2830032E19A85e03cDE678FF93Da659C90CAFe5 \
  100000000000000000000 \
  --private-key $PRIVATE_KEY \
  --rpc-url https://rpc.xlayer.tech
```

**Token flow:** `OKB (TrendFollower) → [Allowance stored] → AegisRouter`

**Verification (post-transaction):**

```bash
cast call \
  0xe538905cf8410324e03A5A23C1c177a474D59b2b \
  "allowance(address,address)" \
  0x7287Ce9c02BeE9615fFBF3A690cd9179E6287bC1 \
  0xb2830032E19A85e03cDE678FF93Da659C90CAFe5 \
  --rpc-url https://rpc.xlayer.tech
```

**Expected output:** `0x000000000000000000000000000000000000000000000000056bc75e2d630eb20000` (100 OKB)

---

## Phase 1: Tap Open (Leveraged Position)

**Purpose:** Open a leveraged tap position using AEGIS Engine. This phase:
1. Fetches OKX DEX quote for best execution route
2. Constructs swap calldata
3. Encodes tap open action
4. Submits via Arena.executeBatch()

### 1.1 Fetch OKX DEX Quote

Determine swap direction and amount based on TrendFollower's trend signal.

**Example: Uptrend scenario** (buy OKB with USD₮0 collateral)

```bash
# Fetch aggregated DEX quote from OKX
curl -s "https://web3.okx.com/api/v5/dex/aggregator/quote" \
  -G \
  -d "chainId=196" \
  -d "fromTokenAddress=0x779Ded0c9e1022225f8E0630b35a9b54bE713736" \
  -d "toTokenAddress=0xe538905cf8410324e03A5A23C1c177a474D59b2b" \
  -d "amount=500000000" \
  -d "slippage=1" | jq .
```

**Example response structure:**

```json
{
  "code": "0",
  "data": {
    "inAmount": "500000000",
    "outAmount": "24850000000000000000",
    "priceImpactPercentage": "0.12",
    "routerResult": {
      "swapActionStructs": [
        {
          "protocol": "OKX_DEX_AGGREGATOR",
          "tokenIn": "0x779Ded0c9e1022225f8E0630b35a9b54bE713736",
          "tokenOut": "0xe538905cf8410324e03A5A23C1c177a474D59b2b",
          "tokenInAmount": "500000000",
          "tokenOutAmount": "24850000000000000000",
          "details": {
            "swapRouter": "0x<router_address>",
            "swapData": "0x<encoded_swap_calldata>",
            "tokenApproveTarget": "0xb2830032E19A85e03cDE678FF93Da659C90CAFe5"
          }
        }
      ]
    }
  }
}
```

**Extraction:**
- **swapData**: The encoded calldata for the swap operation
- **tokenInAmount**: 500000000 (500 USD₮0 in wei, 6 decimals)
- **tokenOutAmount**: ~24.85 OKB (expected output)

### 1.2 Construct Action for Tap Open

Tap open encodes:
- Opcode `0xC0` (PM_TAKE)
- Swap operation to acquire collateral
- Debt modification to borrow against collateral
- Position parameters

**Expected structure (ABI encoding):**

```
Action encoding for tap open:
  - Opcode: 0xC0 (PM_TAKE via PositionManager)
  - vaultId: 4
  - swapData: 0x<from swapActionStructs[0].details.swapData>
  - borrowAmount: 500000000 (500 USD₮0 to borrow)
  - minOutAmount: 24600000000000000000 (24.85 OKB - 1% slippage)
  - recipient: 0x7287Ce9c02BeE9615fFBF3A690cd9179E6287bC1
```

### 1.3 Encode Action Bytes (TypeScript SDK)

Using the provided SDK builders:

```typescript
import { ethers } from 'ethers';
import { encodeSwapExactInSingle } from '../sdk/router.js';

// From OKX quote
const swapData = "0x<extracted_from_okx_quote>";
const borrowAmount = ethers.parseUnits("500", 6); // 500 USD₮0

// Build PM_TAKE action
const pmTakeAction = ethers.AbiCoder.defaultAbiCoder().encode(
  ["uint8", "uint256", "bytes", "uint256", "uint256", "address"],
  [
    0xC0, // PM_TAKE opcode
    4,    // vaultId
    swapData,
    borrowAmount,
    ethers.parseUnits("24.6", 18), // minOutAmount (with slippage)
    "0x7287Ce9c02BeE9615fFBF3A690cd9179E6287bC1"
  ]
);

console.log("Encoded action:", pmTakeAction);
```

**Encoded output (hex):** `0x<encoded_bytes>`

### 1.4 Submit via Arena.executeBatch

```bash
# Cast the executeBatch call
cast send \
  0x77189D65156fC82C422F73Ed3c63F4e5F2c00bBA \
  "executeBatch(uint256,address,bytes[])" \
  1 \
  0x7287Ce9c02BeE9615fFBF3A690cd9179E6287bC1 \
  "[0x<encoded_action_from_1.3>]" \
  --private-key $PRIVATE_KEY \
  --rpc-url https://rpc.xlayer.tech
```

**Expected behavior:**
1. Arena validates roundId (1) is active
2. Arena validates agent is registered for vault 4
3. Arena calls AegisRouter with encoded action
4. Router swaps USD₮0 → OKB via OKX route
5. PositionManager borrows against OKB collateral
6. Final balances updated

### 1.5 Verify Tap Open Success

**Check updated TrendFollower balances:**

```bash
# Check OKB balance (should increase)
cast call \
  0xe538905cf8410324e03A5A23C1c177a474D59b2b \
  "balanceOf(address)" \
  0x7287Ce9c02BeE9615fFBF3A690cd9179E6287bC1 \
  --rpc-url https://rpc.xlayer.tech
```

**Expected:** ~24.85 OKB + original 0.016 OKB = ~24.866 OKB (in wei: ~24866000000000000000)

```bash
# Check USD₮0 balance (should decrease by borrow amount + swap fee)
cast call \
  0x779Ded0c9e1022225f8E0630b35a9b54bE713736 \
  "balanceOf(address)" \
  0x7287Ce9c02BeE9615fFBF3A690cd9179E6287bC1 \
  --rpc-url https://rpc.xlayer.tech
```

**Expected:** ~286.97 USD₮0 (786.97 - 500 borrowed; in wei: ~286970000)

```bash
# Check vault debt (should equal borrow amount)
cast call \
  0xe19414e5C3DB1596f583d18d3Ac5bb43CBabc50D \
  "vaultDebt(uint256)" \
  4 \
  --rpc-url https://rpc.xlayer.tech
```

**Expected:** ~500000000 (500 USD₮0owed; in wei with 6 decimals)

---

## Phase 2: Monitoring / Maintenance

**Purpose:** Track position state and perform optional rebalancing.

### 2.1 Check Position State

```bash
# Fetch full vault state
cast call \
  0xe19414e5C3DB1596f583d18d3Ac5bb43CBabc50D \
  "getVaultState(uint256)" \
  4 \
  --rpc-url https://rpc.xlayer.tech
```

**Returns (tuple):**
- Collateral amount (OKB in vault)
- Debt amount (USD₮0 owed)
- LP share count
- Interest accrued
- Last updated timestamp

### 2.2 Check Arena Round Status

```bash
# Get updated round state
cast call \
  0x77189D65156fC82C422F73Ed3c63F4e5F2c00bBA \
  "getAgentExecutionState(uint256,address)" \
  1 \
  0x7287Ce9c02BeE9615fFBF3A690cd9179E6287bC1 \
  --rpc-url https://rpc.xlayer.tech
```

**Returns (tuple):**
- vaultId: 4
- executionCount: 1 (number of executeBatch calls)
- actionCount: 1 (total actions submitted)
- cumulativeVolumeUsdc: Volume reported for scoring
- latestAvgPriceX96: Latest price benchmark
- lastExecutionBlock: Block number of last executeBatch
- lastSurface: Surface that executed (AegisRouter address)
- lastBatchHash: Hash of last action batch
- lastProofEligible: Whether last execution is proof-eligible

### 2.3 Optional Rebalance

If position drifts or interest accrues significantly:

```bash
# Fetch current interest accrued
cast call \
  0xe19414e5C3DB1596f583d18d3Ac5bb43CBabc50D \
  "vaultInterestAccrued(uint256)" \
  4 \
  --rpc-url https://rpc.xlayer.tech
```

If interest > threshold, execute another tap open to refresh leverage or a targeted swap to rebalance.

---

## Phase 3: Tap Close + Burn

**Purpose:** Close leveraged position, repay debt, and burn vault. This phase:
1. Sells OKB back to USD₮0 via OKX DEX
2. Repays borrowed USD₮0
3. Withdraws LP shares (if any)
4. Burns vault NFT

### 3.1 Fetch OKX DEX Quote for Exit

**Example: Exit scenario** (sell OKB for USD₮0)

```bash
# Fetch quote to exit OKB position
# Assuming we want to sell 24.86 OKB (all collateral + profit)
curl -s "https://web3.okx.com/api/v5/dex/aggregator/quote" \
  -G \
  -d "chainId=196" \
  -d "fromTokenAddress=0xe538905cf8410324e03A5A23C1c177a474D59b2b" \
  -d "toTokenAddress=0x779Ded0c9e1022225f8E0630b35a9b54bE713736" \
  -d "amount=24860000000000000000" \
  -d "slippage=1" | jq .
```

**Example response:**

```json
{
  "code": "0",
  "data": {
    "inAmount": "24860000000000000000",
    "outAmount": "505230000",
    "priceImpactPercentage": "0.18",
    "routerResult": {
      "swapActionStructs": [
        {
          "protocol": "OKX_DEX_AGGREGATOR",
          "details": {
            "swapData": "0x<encoded_exit_calldata>",
            "tokenApproveTarget": "0xb2830032E19A85e03cDE678FF93Da659C90CAFe5"
          }
        }
      ]
    }
  }
}
```

**Extraction:**
- **swapData**: Encoded exit calldata
- **outAmount**: ~505.23 USD₮0 (expected USD₮0 received from selling OKB)

### 3.2 Construct Action for Tap Close

Tap close encodes:
- Opcode `0xC2` (PM_CLOSE via PositionManager)
- Exit swap (OKB → USD₮0)
- Repayment of full debt amount (including interest)
- LP withdrawal

```typescript
import { ethers } from 'ethers';

// From OKX exit quote
const exitSwapData = "0x<extracted_from_okx_quote>";
const repayAmount = ethers.parseUnits("505", 6); // ~505 USD₮0 (matches exit quote)

// Build PM_CLOSE action
const pmCloseAction = ethers.AbiCoder.defaultAbiCoder().encode(
  ["uint8", "uint256", "bytes", "uint256", "uint256", "address"],
  [
    0xC2, // PM_CLOSE opcode
    4,    // vaultId
    exitSwapData,
    repayAmount,
    ethers.parseUnits("500", 6), // minRepayAmount (with slippage: 505 - 1%)
    "0x7287Ce9c02BeE9615fFBF3A690cd9179E6287bC1"
  ]
);

console.log("Encoded close action:", pmCloseAction);
```

### 3.3 Submit Tap Close via Arena.executeBatch

```bash
# Cast the executeBatch call for tap close
cast send \
  0x77189D65156fC82C422F73Ed3c63F4e5F2c00bBA \
  "executeBatch(uint256,address,bytes[])" \
  1 \
  0x7287Ce9c02BeE9615fFBF3A690cd9179E6287bC1 \
  "[0x<encoded_close_action_from_3.2>]" \
  --private-key $PRIVATE_KEY \
  --rpc-url https://rpc.xlayer.tech
```

**Expected behavior:**
1. Arena validates round is active
2. Router executes exit swap: OKB → USD₮0
3. PositionManager repays debt from swap proceeds
4. Vault is marked repaid (debt = 0)
5. Final balances updated

### 3.4 Verify Tap Close Success

```bash
# Check OKB balance (should decrease to ~0.016 or lower)
cast call \
  0xe538905cf8410324e03A5A23C1c177a474D59b2b \
  "balanceOf(address)" \
  0x7287Ce9c02BeE9615fFBF3A690cd9179E6287bC1 \
  --rpc-url https://rpc.xlayer.tech
```

**Expected:** ~0 OKB (all sold back)

```bash
# Check USD₮0 balance (should increase from proceeds - repayment)
cast call \
  0x779Ded0c9e1022225f8E0630b35a9b54bE713736 \
  "balanceOf(address)" \
  0x7287Ce9c02BeE9615fFBF3A690cd9179E6287bC1 \
  --rpc-url https://rpc.xlayer.tech
```

**Expected:** ~791.97 USD₮0 or higher (786.97 initial + profit from swap minus fees; in wei: ~791970000 or more)

```bash
# Verify vault debt is 0
cast call \
  0xe19414e5C3DB1596f583d18d3Ac5bb43CBabc50D \
  "vaultDebt(uint256)" \
  4 \
  --rpc-url https://rpc.xlayer.tech
```

**Expected:** `0x0000000000000000000000000000000000000000000000000000000000000000` (debt repaid)

### 3.5 Burn Vault (Optional Post-Migration Cleanup)

Once position is closed and debt is 0, burn the vault NFT to clean up on-chain state.

```bash
# Encode burn action
const burnAction = ethers.AbiCoder.defaultAbiCoder().encode(
  ["uint8", "uint256"],
  [0x89, 4] // AE_BURN_VAULT opcode, vaultId
);

// Submit burn via executeBatch
cast send \
  0x77189D65156fC82C422F73Ed3c63F4e5F2c00bBA \
  "executeBatch(uint256,address,bytes[])" \
  1 \
  0x7287Ce9c02BeE9615fFBF3A690cd9179E6287bC1 \
  "[0x<encoded_burn_action>]" \
  --private-key $PRIVATE_KEY \
  --rpc-url https://rpc.xlayer.tech
```

**Verification:**

```bash
# Verify vault is burned (owner should revert or be zero)
cast call \
  0xe19414e5C3DB1596f583d18d3Ac5bb43CBabc50D \
  "vaultOwner(uint256)" \
  4 \
  --rpc-url https://rpc.xlayer.tech
```

**Expected:** Error or zero address (vault no longer exists)

---

## Phase 4: Settlement

**Purpose:** Finalize Arena round and claim bounty if eligible.

### 4.1 Trigger Round Settlement (Owner Only)

After round end time:

```bash
# Check round end time first
cast call \
  0x77189D65156fC82C422F73Ed3c63F4e5F2c00bBA \
  "getRoundState(uint256)" \
  1 \
  --rpc-url https://rpc.xlayer.tech

# Then settle (requires owner wallet)
cast send \
  0x77189D65156fC82C422F73Ed3c63F4e5F2c00bBA \
  "settle(uint256)" \
  1 \
  --private-key $OWNER_PRIVATE_KEY \
  --rpc-url https://rpc.xlayer.tech
```

**Expected behavior:**
1. Arena computes final scores from cumulativeVolumeUsdc
2. Ranks agents by score
3. Allocates prizes (1st, 2nd, 3rd places)
4. Marks round as settled

### 4.2 Query Final Scores

```bash
# Fetch final scores and prizes
cast call \
  0x77189D65156fC82C422F73Ed3c63F4e5F2c00bBA \
  "getFinalScores(uint256)" \
  1 \
  --rpc-url https://rpc.xlayer.tech
```

**Returns (tuple):**
- agentsRanked: [address, address, address, ...]
- scores: [score1, score2, score3, ...] (USDC volume)
- prizes: [prize1, prize2, prize3, ...] (USDC amounts)

### 4.3 Claim Bounty (If Eligible)

Check if TrendFollower qualifies for bounties by examining bounty conditions.

```bash
# Fetch available bounties for round 1
cast call \
  0xf3C8c2eac069E44030A36C6D15F1009dF882Be75 \
  "getBountiesForRound(uint256)" \
  1 \
  --rpc-url https://rpc.xlayer.tech
```

**If eligible:**

```bash
# Claim bounty (requires bounty proof and conditions met)
cast send \
  0xf3C8c2eac069E44030A36C6D15F1009dF882Be75 \
  "claimBounty(uint256,uint256,bytes)" \
  1 \
  <bountyId> \
  "0x<proof_data>" \
  --private-key $PRIVATE_KEY \
  --rpc-url https://rpc.xlayer.tech
```

**Verification:**

```bash
# Verify bounty claimed and USDC balance increased
cast call \
  0x74b7F16337b8972027F6196A17a631aC6dE26d22 \
  "balanceOf(address)" \
  0x7287Ce9c02BeE9615fFBF3A690cd9179E6287bC1 \
  --rpc-url https://rpc.xlayer.tech
```

---

## Appendix A: Action Encoding Examples

### Example: PM_TAKE Action (Tap Open)

```solidity
// Pseudocode for PM_TAKE action encoding
bytes memory pmTakeAction = abi.encode(
  0xC0,                    // Opcode: PM_TAKE
  4,                       // vaultId
  swapCalldata,            // Swap routing from OKX DEX
  500000000,               // Borrow amount (500 USD₮0 in wei)
  24600000000000000000,    // Min output from swap
  agent                    // Recipient address
);

// In Arena.executeBatch:
bytes[] memory actions = new bytes[](1);
actions[0] = pmTakeAction;

arena.executeBatch(1, agent, actions);
```

### Example: PM_CLOSE Action (Tap Close)

```solidity
// Pseudocode for PM_CLOSE action encoding
bytes memory pmCloseAction = abi.encode(
  0xC2,                    // Opcode: PM_CLOSE
  4,                       // vaultId
  exitSwapCalldata,        // Exit swap routing
  505000000,               // Repay amount (505 USD₮0 in wei)
  500000000,               // Min repay (with slippage)
  agent                    // Recipient address
);

bytes[] memory actions = new bytes[](1);
actions[0] = pmCloseAction;

arena.executeBatch(1, agent, actions);
```

---

## Appendix B: Gas Estimation

Typical gas costs per operation (X Layer):

| Operation | Gas | USD (at $0.10/gas) |
|-----------|-----|-------------------|
| Token approval | 46,000 | $4.60 |
| OKX DEX swap | 150,000 | $15.00 |
| PM_TAKE action | 280,000 | $28.00 |
| PM_CLOSE action | 320,000 | $32.00 |
| Vault burn | 85,000 | $8.50 |
| Arena settle | 400,000 | $40.00 |
| **Total (full migration)** | **~1.3M** | **~$130** |

Use `cast estimate-gas` to get real-time estimates:

```bash
cast estimate-gas \
  --to 0x77189D65156fC82C422F73Ed3c63F4e5F2c00bBA \
  --data <calldata> \
  --rpc-url https://rpc.xlayer.tech
```

---

## Appendix C: Disaster Recovery

### If Tap Open Fails

1. Check `runner-stderr.txt` or transaction revert reason
2. Verify all approvals are in place (Phase 0.5)
3. Verify OKX quote is still valid (quotes expire after ~30 seconds)
4. Check that USD₮0 balance is sufficient
5. Resubmit with fresh quote

### If Tap Close Fails

1. Verify OKB balance matches position size
2. Verify vault debt is still outstanding
3. Fetch fresh OKX exit quote
4. Check slippage tolerance (consider increasing from 1% to 2%)
5. Resubmit close action

### If Vault Burn Fails After Close

1. Verify debt is exactly 0
2. Verify all LP shares are withdrawn
3. Check if another agent has a lien on vault (unlikely; confirm ownership)
4. Resubmit burn action

---

## Appendix D: Manual State Verification Script

Save as `verify-trendfollower.sh`:

```bash
#!/bin/bash
set -e

AGENT="0x7287Ce9c02BeE9615fFBF3A690cd9179E6287bC1"
VAULT_ID="4"
ROUND_ID="1"
RPC="https://rpc.xlayer.tech"

echo "=== TrendFollower State Verification ==="
echo "Agent: $AGENT"
echo "Vault ID: $VAULT_ID"
echo "Round ID: $ROUND_ID"
echo ""

echo "1. Round Active?"
cast call 0x77189D65156fC82C422F73Ed3c63F4e5F2c00bBA "isRoundActive(uint256)" $ROUND_ID --rpc-url $RPC

echo ""
echo "2. Agent Vault ID:"
cast call 0x77189D65156fC82C422F73Ed3c63F4e5F2c00bBA "getAgentVault(uint256,address)" $ROUND_ID $AGENT --rpc-url $RPC

echo ""
echo "3. OKB Balance:"
cast call 0xe538905cf8410324e03A5A23C1c177a474D59b2b "balanceOf(address)" $AGENT --rpc-url $RPC

echo ""
echo "4. USD₮0 Balance:"
cast call 0x779Ded0c9e1022225f8E0630b35a9b54bE713736 "balanceOf(address)" $AGENT --rpc-url $RPC

echo ""
echo "5. Vault Debt:"
cast call 0xe19414e5C3DB1596f583d18d3Ac5bb43CBabc50D "vaultDebt(uint256)" $VAULT_ID --rpc-url $RPC

echo ""
echo "6. Execution State:"
cast call 0x77189D65156fC82C422F73Ed3c63F4e5F2c00bBA "getAgentExecutionState(uint256,address)" $ROUND_ID $AGENT --rpc-url $RPC

echo ""
echo "=== Done ==="
```

Run:

```bash
chmod +x verify-trendfollower.sh
./verify-trendfollower.sh
```

---

## Summary Checklist

### Pre-Flight (Phase 0)
- [ ] Round is active (`isRoundActive` returns true)
- [ ] TrendFollower is registered with vault ID 4
- [ ] OKB balance ≥ 0.016
- [ ] USD₮0 balance ≥ 786.97
- [ ] Vault exists in registry

### Approvals (Phase 0.5)
- [ ] USD₮0 approved 1000 to AegisRouter
- [ ] OKB approved 100 to AegisRouter

### Tap Open (Phase 1)
- [ ] OKX DEX quote fetched (slippage 1%)
- [ ] PM_TAKE action encoded
- [ ] executeBatch submitted
- [ ] OKB balance increased to ~24.866
- [ ] USD₮0 balance decreased to ~286.97
- [ ] Vault debt set to ~500000000

### Maintenance (Phase 2)
- [ ] Position state monitored
- [ ] Arena execution state checked

### Tap Close (Phase 3)
- [ ] OKX DEX exit quote fetched
- [ ] PM_CLOSE action encoded
- [ ] executeBatch submitted
- [ ] OKB balance reduced to ~0
- [ ] USD₮0 balance increased to ~791.97+
- [ ] Vault debt reset to 0
- [ ] Vault burned (optional)

### Settlement (Phase 4)
- [ ] Round settled by owner
- [ ] Final scores queried
- [ ] Bounty claimed (if eligible)

---

**Document Version:** 1.0  
**Last Updated:** 2026-03-25  
**Author:** TALOS Research  
**Status:** Ready for Execution
