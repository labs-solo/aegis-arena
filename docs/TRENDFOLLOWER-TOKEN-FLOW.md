# TrendFollower Token Flow Diagram

**Version:** 1.0  
**Date:** 2026-03-25  
**Agent:** TrendFollower (`0x7287Ce9c02BeE9615fFBF3A690cd9179E6287bC1`)  
**Vault ID:** 4  
**Round ID:** 1 (example)

---

## Overview

Complete token movement flow across all migration phases. Shows every token transfer, from address → to address, with amounts in wei and decimal form.

---

## Phase 0: Initial State

```
┌─────────────────────────────────────────┐
│         TRENDFOLLOWER WALLET            │
│      (0x7287Ce9c02BeE9615...)           │
├─────────────────────────────────────────┤
│                                         │
│  OKB:        0.016 OKB                  │
│              16,000,000,000,000,000 wei │
│                                         │
│  USD₮0:      786.97 USD₮0               │
│              786,970,000 wei (6 dec)    │
│                                         │
│  LP Shares:  1,407,624,784,789          │
│              (ERC-6909 from pool)       │
│                                         │
└─────────────────────────────────────────┘
```

---

## Phase 0.5: Approvals

```
APPROVAL 1: USD₮0 → AegisRouter
┌──────────────────────┐
│ TrendFollower Wallet │
│   USD₮0 Balance      │
│  786,970,000 wei     │
└──────────────────────┘
         │
         │ approve(AegisRouter, 1,000,000,000)
         │ [Allowance registered; no token transfer]
         ▼
┌──────────────────────────────────────────┐
│  AegisRouter                             │
│  (0xb2830032E19A85e03cDE678...)          │
│                                          │
│  Allowance from TrendFollower:           │
│    1,000,000,000 USD₮0                   │
│    (1,000 USD₮0 * 10^6 decimals)         │
│                                          │
│  [Can now transfer up to 1,000 USD₮0]    │
└──────────────────────────────────────────┘


APPROVAL 2: OKB → AegisRouter
┌──────────────────────┐
│ TrendFollower Wallet │
│   OKB Balance        │
│  16,000,000,000...   │ wei (18 dec)
└──────────────────────┘
         │
         │ approve(AegisRouter, 100,000,000,000,000,000,000)
         │ [Allowance registered; no token transfer]
         ▼
┌──────────────────────────────────────────┐
│  AegisRouter                             │
│                                          │
│  Allowance from TrendFollower:           │
│    100,000,000,000,000,000,000 wei       │
│    (100 OKB * 10^18 decimals)            │
│                                          │
│  [Can now transfer up to 100 OKB]        │
└──────────────────────────────────────────┘
```

---

## Phase 1: Tap Open (Leveraged Position)

### Step 1.1: Fetch OKX Quote (No On-Chain Token Movement)

```
TrendFollower sends HTTP request to OKX DEX API:
  - fromToken:  0x779Ded0c9e1022225f8E0630b35a9b54bE713736 (USD₮0)
  - toToken:    0xe538905cf8410324e03A5A23C1c177a474D59b2b (OKB)
  - amount:     500,000,000 wei (500 USD₮0)
  - slippage:   1%

OKX returns quote:
  - inAmount:        500,000,000 wei (500 USD₮0)
  - outAmount:       24,850,000,000,000,000,000 wei (~24.85 OKB)
  - swapData:        0x<encoded_calldata>
  - tokenApproveTarget: 0xb2830032E19A85e03cDE678FF93Da659C90CAFe5 (AegisRouter)

[No token transfer yet — only quote data exchange]
```

### Step 1.2: PM_TAKE Action Submitted via Arena.executeBatch

```
Arena.executeBatch(
  roundId=1,
  agent=0x7287Ce9c02BeE9615...,
  actions=[
    {
      opcode: 0xC0,         // PM_TAKE
      vaultId: 4,
      swapData: 0x<from_okx>,
      borrowAmount: 500,000,000,  // 500 USD₮0
      minOutput: 24,600,000,000,000,000,000  // ~24.6 OKB (with 1% slippage)
      recipient: 0x7287Ce9c02BeE9615...
    }
  ]
)

Flow:
┌─────────────────────────────────────────┐
│    TrendFollower Wallet                 │
│                                         │
│  USD₮0: 786,970,000 wei                 │
│  OKB:   16,000,000,000,000,000 wei      │
└─────────────────────────────────────────┘
         │
         │ [1] AegisRouter.swap()
         │     Use allowance: 500,000,000 USD₮0
         ▼
┌─────────────────────────────────────────┐
│  USD₮0 Token Contract                   │
│  (0x779Ded0c9e1...)                     │
│                                         │
│  [Swap execution via OKX DEX route]     │
│                                         │
│  From: TrendFollower                    │
│  To:   <DEX_PROTOCOL>                   │
│  Amount: 500,000,000 USD₮0              │
└─────────────────────────────────────────┘
         │
         │ [Swap proceeds to DEX protocol]
         ▼
┌─────────────────────────────────────────┐
│  OKB Token Contract                     │
│  (0xe538905cf8410...)                   │
│                                         │
│  From: <DEX_PROTOCOL>                   │
│  To:   TrendFollower (via PM)           │
│  Amount: 24,850,000,000,000,000,000 wei │
│          (~24.85 OKB)                   │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│  PositionManager (Vault 4)              │
│                                         │
│  [2] Receives OKB collateral            │
│  [3] Borrows 500 USD₮0 against OKB      │
└─────────────────────────────────────────┘
         │
         │ [3] Loan disbursement
         │     Transfer 500 USD₮0 to TrendFollower
         ▼
┌─────────────────────────────────────────┐
│    TrendFollower Wallet (After Phase 1) │
│                                         │
│  USD₮0: 786,970,000 - 500,000,000       │
│         + 500,000,000 (loan)            │
│       = 786,970,000 wei                 │
│         (~786.97 USD₮0, flat)           │
│                                         │
│  OKB:   16,000,000,000,000,000          │
│         + 24,850,000,000,000,000,000    │
│       = 24,866,000,000,000,000,000 wei  │
│         (~24.866 OKB)                   │
│                                         │
│  Vault 4 Debt: 500,000,000 USD₮0        │
│  Vault 4 Collateral: 24,850 OKB         │
│                                         │
└─────────────────────────────────────────┘
```

**Token Flow Summary (Phase 1):**

```
USD₮0:
  TrendFollower → [Swap via OKX] → (OKB received)
  Vault → TrendFollower (loan disbursement)
  Net: USD₮0 stable; now includes borrowed amount

OKB:
  [DEX] → TrendFollower (24.85 OKB from swap)
  TrendFollower → Vault 4 (collateral lock)
  Net: TrendFollower holds ~24.866 OKB (original + swapped)
       Vault 4 holds 24.85 OKB as collateral

Debt:
  Vault 4 owes: 500 USD₮0 (recorded in VaultRegistry)
```

---

## Phase 2: Maintenance (No Token Movement)

During this phase, TrendFollower holds position and monitors state.

```
┌─────────────────────────────────────────┐
│    TrendFollower Wallet (Steady State)   │
│                                         │
│  USD₮0: 786,970,000 wei (stable)        │
│                                         │
│  OKB:   24,866,000,000,000,000,000 wei  │
│         (holding leveraged position)    │
│                                         │
│  Vault 4 Debt:      500,000,000 wei     │
│  Vault 4 Collateral: 24,850,000... wei  │
│                                         │
│  [Optional: Interest accrues on debt]   │
│  [Optional: Rebalance via another swap] │
│                                         │
└─────────────────────────────────────────┘
```

---

## Phase 3: Tap Close + Repayment

### Step 3.1: Fetch OKX Exit Quote

```
TrendFollower sends HTTP request to OKX DEX API:
  - fromToken:  0xe538905cf8410324e03A5A23C1c177a474D59b2b (OKB)
  - toToken:    0x779Ded0c9e1022225f8E0630b35a9b54bE713736 (USD₮0)
  - amount:     24,866,000,000,000,000,000 wei (~24.866 OKB — all collateral + original)
  - slippage:   1%

OKX returns exit quote:
  - inAmount:        24,866,000,000,000,000,000 wei (~24.866 OKB)
  - outAmount:       507,230,000 wei (~507.23 USD₮0)
  - swapData:        0x<encoded_exit_calldata>
  - Expected profit: 507.23 - 500 = 7.23 USD₮0 (before fees)

[No token transfer yet — only quote data exchange]
```

### Step 3.2: PM_CLOSE Action Submitted via Arena.executeBatch

```
Arena.executeBatch(
  roundId=1,
  agent=0x7287Ce9c02BeE9615...,
  actions=[
    {
      opcode: 0xC2,         // PM_CLOSE
      vaultId: 4,
      swapData: 0x<from_okx_exit>,
      repayAmount: 507,230,000,  // 507.23 USD₮0 (to cover debt + fees)
      minRepay: 502,000,000,      // Min 502 USD₮0 (with 1% slippage)
      recipient: 0x7287Ce9c02BeE9615...
    }
  ]
)

Flow:
┌──────────────────────────────────────────────────────┐
│    TrendFollower Wallet (Before Close)               │
│                                                      │
│  USD₮0:       786,970,000 wei                        │
│  OKB:         24,866,000,000,000,000,000 wei         │
│  Vault 4 Debt: 500,000,000 USD₮0                     │
│                                                      │
└──────────────────────────────────────────────────────┘
         │
         │ [1] PositionManager.closePosition()
         │     Withdraw collateral from Vault 4
         ▼
┌──────────────────────────────────────────────────────┐
│  Vault 4 (PositionManager)                           │
│                                                      │
│  Release: 24,850,000,000,000,000,000 wei OKB         │
│           (all collateral)                          │
│                                                      │
│  Transfer to: TrendFollower (via Router)             │
│                                                      │
└──────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────┐
│    TrendFollower Wallet (Collateral Received)        │
│                                                      │
│  OKB: 24,866,000,000,000,000,000 wei (all)           │
│       [Ready for exit swap]                          │
│                                                      │
└──────────────────────────────────────────────────────┘
         │
         │ [2] AegisRouter.swap() [Exit]
         │     Use allowance: all OKB
         ▼
┌──────────────────────────────────────────────────────┐
│  OKB Token Contract                                  │
│  (0xe538905cf8410...)                                │
│                                                      │
│  From: TrendFollower                                 │
│  To:   <DEX_PROTOCOL> (OKX-routed)                   │
│  Amount: 24,866,000,000,000,000,000 wei (~24.866 OKB)│
│                                                      │
└──────────────────────────────────────────────────────┘
         │
         │ [Swap execution; OKB → USD₮0]
         ▼
┌──────────────────────────────────────────────────────┐
│  USD₮0 Token Contract                                │
│  (0x779Ded0c9e1...)                                  │
│                                                      │
│  From: <DEX_PROTOCOL>                                │
│  To:   TrendFollower (or directly to Vault for       │
│         repayment)                                   │
│  Amount: 507,230,000 wei (~507.23 USD₮0)             │
│                                                      │
└──────────────────────────────────────────────────────┘
         │
         │ [3] PositionManager repays vault debt
         │     Transfer 500,000,000 USD₮0 to Vault     │
         ▼
┌──────────────────────────────────────────────────────┐
│  Vault 4 (PositionManager)                           │
│                                                      │
│  Receive repayment: 500,000,000 USD₮0                │
│  Debt zeroed: 0 USD₮0                                │
│                                                      │
│  [Vault is now collateral-free and debt-free]       │
│                                                      │
└──────────────────────────────────────────────────────┘
         │
         │ [Residual proceeds returned]
         │ 507,230,000 - 500,000,000 = 7,230,000 USD₮0
         ▼
┌──────────────────────────────────────────────────────┐
│    TrendFollower Wallet (After Close)                │
│                                                      │
│  USD₮0: 786,970,000 + 7,230,000                      │
│       = 794,200,000 wei                              │
│       (~794.2 USD₮0)                                 │
│                                                      │
│  OKB:   0 wei (all sold)                             │
│                                                      │
│  Vault 4 Debt: 0 USD₮0 (repaid)                      │
│  Vault 4 Collateral: 0 OKB (withdrawn)               │
│                                                      │
│  Net Profit: 794.2 - 786.97 = 7.23 USD₮0            │
│              (before slippage & fees)                │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**Token Flow Summary (Phase 3):**

```
OKB:
  Vault 4 → TrendFollower (collateral withdrawal)
  TrendFollower → [DEX via OKX] → (USD₮0 proceeds)
  Net: TrendFollower holds 0 OKB; proceeds to repayment

USD₮0:
  [DEX] → TrendFollower/Vault (507.23 USD₮0 from exit swap)
  Vault → TrendFollower (repayment residual: 7.23 USD₮0)
  Net: TrendFollower holds ~794.2 USD₮0 (initial + profit)
```

### Step 3.3: Vault Burn (Optional)

```
Arena.executeBatch(
  roundId=1,
  agent=0x7287Ce9c02BeE9615...,
  actions=[
    {
      opcode: 0x89,  // AE_BURN_VAULT
      vaultId: 4
    }
  ]
)

Flow:
┌──────────────────────────────────────────────────────┐
│  Vault 4 (VaultRegistry)                             │
│                                                      │
│  State: DEBT=0, COLLATERAL=0                         │
│  Owner: TrendFollower                                │
│                                                      │
│  [Burn action]                                       │
│                                                      │
└──────────────────────────────────────────────────────┘
         │
         │ [Vault NFT destroyed; state cleared]
         │ [No token transfers; pure state cleanup]
         ▼
┌──────────────────────────────────────────────────────┐
│  VaultRegistry                                       │
│                                                      │
│  Vault 4: DESTROYED                                  │
│           [No longer queryable via vaultOwner(4)]    │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**No token transfer in burn phase — purely state cleanup.**

---

## Phase 4: Settlement + Bounty Claim

```
Arena.settle(1) [Called by Arena owner]
  ├─ Compute final scores from cumulativeVolumeUsdc
  ├─ Rank agents by score (TrendFollower's ranking TBD)
  ├─ Allocate prizes (1st, 2nd, 3rd)
  └─ Mark round as settled

[No token transfer in settlement itself]
```

### Bounty Claim (If Eligible)

```
Bounty.claimBounty(
  roundId=1,
  bountyId=<id>,
  proof=0x<proof_data>
)

If approved:
┌──────────────────────────────────────────────────────┐
│  Bounty Contract                                     │
│  (0xf3C8c2eac069E44030A36C6D15F1009dF882Be75)       │
│                                                      │
│  Bounty reward (USD₮0): 0x<amount>                   │
│                                                      │
│  Transfer to: TrendFollower                          │
│                                                      │
└──────────────────────────────────────────────────────┘
         │
         │ [Bounty reward transfer]
         ▼
┌──────────────────────────────────────────────────────┐
│  USD₮0 Token Contract                                │
│                                                      │
│  From: Bounty contract balance                       │
│  To:   TrendFollower                                 │
│  Amount: <bounty_amount> USD₮0                       │
│                                                      │
└──────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────┐
│    TrendFollower Wallet (Final)                      │
│                                                      │
│  USD₮0: ~794.2 + <bounty_amount>                     │
│                                                      │
│  OKB:   0 (position closed)                          │
│                                                      │
│  Net Gain: Position profit + bounty                  │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## Complete Token Flow Diagram (All Phases)

```
INITIAL STATE
═════════════════════════════════════════════════════════════════
│
├─ TrendFollower Wallet: 786.97 USD₮0 + 0.016 OKB
│  Vault 4: Empty (debt=0, collateral=0)
│
└─ PHASE 0.5: APPROVALS
   ├─ AegisRouter approved for 1,000 USD₮0
   ├─ AegisRouter approved for 100 OKB
   └─ [No token movement]

                         ▼

PHASE 1: TAP OPEN (LEVERAGE)
═════════════════════════════════════════════════════════════════
│
├─ OKX Quote: Sell 500 USD₮0 → Get 24.85 OKB
│
├─ Swap Execution:
│  TrendFollower: -500 USD₮0 (outflow to DEX)
│  ↓ (OKX DEX router)
│  TrendFollower: +24.85 OKB (inflow from DEX)
│
├─ Vault Debt:
│  Vault 4: +500 USD₮0 debt
│  TrendFollower: +500 USD₮0 loan disbursement
│
└─ Final Balances After Tap Open:
   ├─ TrendFollower: 786.97 USD₮0 (stable) + 24.866 OKB (24.85 + 0.016)
   └─ Vault 4: 24.85 OKB collateral + 500 USD₮0 debt

                         ▼

PHASE 2: MAINTENANCE (STEADY STATE)
═════════════════════════════════════════════════════════════════
│
└─ [Position held; optional interest accrual and rebalancing]
   [No mandatory token movements]

                         ▼

PHASE 3: TAP CLOSE (DELEVERAGE)
═════════════════════════════════════════════════════════════════
│
├─ OKX Quote: Sell 24.866 OKB → Get 507.23 USD₮0
│
├─ Collateral Withdrawal:
│  Vault 4: -24.85 OKB (to TrendFollower)
│
├─ Exit Swap:
│  TrendFollower: -24.866 OKB (outflow to DEX)
│  ↓ (OKX DEX router)
│  TrendFollower: +507.23 USD₮0 (inflow from DEX)
│
├─ Debt Repayment:
│  TrendFollower: -500 USD₮0 (repayment to Vault)
│  Vault 4: -500 USD₮0 debt (zeroed)
│
├─ Vault Burn (Optional):
│  Vault 4: DESTROYED (pure state cleanup, no tokens)
│
└─ Final Balances After Tap Close:
   ├─ TrendFollower: 794.2 USD₮0 (786.97 + 7.23 profit)
   ├─ OKB: 0
   └─ Vault 4: Debt=0, Collateral=0

                         ▼

PHASE 4: SETTLEMENT + BOUNTY
═════════════════════════════════════════════════════════════════
│
├─ Round Settlement: Compute final scores & prizes
│  [No token transfer in settlement]
│
├─ Bounty Claim (If Eligible):
│  Bounty Contract: -<amount> USD₮0
│  TrendFollower: +<amount> USD₮0
│
└─ Final State:
   ├─ TrendFollower: 794.2+ USD₮0 + bounty reward
   ├─ Prize (if ranked): 1st, 2nd, or 3rd prize in USD₮0
   └─ Round 1: SETTLED
```

---

## Token Movement Summary Table

| Phase | From | To | Token | Amount | Notes |
|-------|------|----|----|--------|-------|
| 0.5 | TrendFollower | [Allowance] | USD₮0 | 1,000 | Approval only; no transfer |
| 0.5 | TrendFollower | [Allowance] | OKB | 100 | Approval only; no transfer |
| 1 | TrendFollower | DEX | USD₮0 | 500 | Swap input |
| 1 | DEX | TrendFollower | OKB | 24.85 | Swap output |
| 1 | TrendFollower | Vault 4 | OKB | 24.85 | Collateral lock |
| 1 | Vault 4 | TrendFollower | USD₮0 | 500 | Loan disbursement |
| 3 | Vault 4 | TrendFollower | OKB | 24.85 | Collateral withdraw |
| 3 | TrendFollower | DEX | OKB | 24.866 | Exit swap input |
| 3 | DEX | TrendFollower | USD₮0 | 507.23 | Exit swap output |
| 3 | TrendFollower | Vault 4 | USD₮0 | 500 | Debt repayment |
| 3 | Vault 4 | TrendFollower | USD₮0 | 7.23 | Residual profit |
| 4 | Bounty | TrendFollower | USD₮0 | <amount> | Bounty claim (if eligible) |

---

## Final State Summary

```
┌──────────────────────────────────────────────────────────────┐
│                    FINAL BALANCES                            │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  TrendFollower Wallet:                                       │
│  ├─ USD₮0: 794.2+ (initial 786.97 + profit 7.23 + bounty)   │
│  └─ OKB:   0                                                 │
│                                                              │
│  Vault 4:                                                    │
│  ├─ Status: BURNED/DESTROYED (state cleanup)                │
│  ├─ Collateral: 0                                            │
│  └─ Debt: 0                                                  │
│                                                              │
│  Arena Round 1:                                              │
│  ├─ Status: SETTLED                                         │
│  ├─ TrendFollower Rank: <TBD based on volume>               │
│  └─ Prize (if ranked): <TBD>                                │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Fee & Loss Accounting

```
Swap Fees (OKX Route):
├─ Phase 1 (Buy 24.85 OKB):    ~0.3-0.5% of 500 USD₮0 = 1.5-2.5 USD₮0
├─ Phase 3 (Sell 24.85 OKB):   ~0.3-0.5% of 507.23 USD₮0 = 1.5-2.5 USD₮0
└─ Total Swap Fees:            ~3-5 USD₮0

Interest Accrual (if held >1 block):
├─ Borrow Rate: Variable (check VARIABLE_INTEREST_RATE contract)
├─ Principal: 500 USD₮0
├─ Duration: Phase 1 → Phase 3 (typically minutes in test; days in prod)
└─ Estimated Interest: 0.1-1 USD₮0 (depends on rate)

Arbitrage Profit (if price moves favorably):
├─ Entry: Bought at 500 USD₮0 / 24.85 OKB = 20.12 USD₮0/OKB
├─ Exit: Sold at 507.23 USD₮0 / 24.866 OKB = 20.39 USD₮0/OKB
├─ Price improvement: +0.27 USD₮0/OKB
└─ Total profit on 24.85 OKB: ~6.7 USD₮0

Net Gain Estimate:
├─ Gross swap proceeds: 507.23 USD₮0
├─ Less debt repayment: -500 USD₮0
├─ Less swap fees (estimated): -2 USD₮0
├─ Less interest (estimated): -0.5 USD₮0
└─ Net profit: ~4.73 USD₮0 (conservative estimate)

Final USD₮0: 786.97 + 4.73 = ~791.7 USD₮0 (before bounty)
```

---

## Assumptions & Caveats

1. **Price Impact:** Assumes OKX quote remains valid (quotes expire ~30 seconds)
2. **Interest Rate:** Uses variable rate; actual accrual depends on VARIABLE_INTEREST_RATE contract state
3. **Slippage:** Assumes 1% slippage tolerance; may require adjustment on-chain
4. **OKX Aggregator Route:** Assumes OKX returns optimal route; alternative DEXes may have different fees
5. **Bounty Eligibility:** Bounty amount and conditions depend on Bounty contract; assume 0 if not eligible
6. **Gas Fees:** Not shown in this flow; add X Layer gas costs (~$0.01-0.05 per transaction)

---

**Document Version:** 1.0  
**Last Updated:** 2026-03-25  
**Author:** TALOS Research  
**Status:** Complete Token Flow Documented
