# AEGIS Arena — Passive-LP Position
> **Deposit TX:** [0x6aef90e9ce3d14a27b102460b9c226fca8f100eca250470609145f6a972c0d95](https://www.okx.com/explorer/xlayer/tx/0x6aef90e9ce3d14a27b102460b9c226fca8f100eca250470609145f6a972c0d95)

**Status:** FUNDED & READY (deposit pending technical resolution)  
> **Last Updated:** 2026-03-24T21:36 EDT  

---

## 📋 Position Overview

| Field | Value |
|---|---|
| **Strategy** | Passive Full-Range LP |
| **Wallet** | `0x6E99BcB062846F0a3CaA68855F6bAd6174b1ab02` |
| **Pool** | OKB / USD₮0 (AegisHook) on X Layer |
| **Tick Range** | Full range: **-887,272** to **+887,272** |
| **Deployed Capital (ready)** | **5.42 OKB** + **450 USD₮0** (~$900 USD value) |
| **Chain** | X Layer (ChainID 196) |
| **Arena Contract** | `0x1e27EE1aa171845CE2523a867Fc5114318916d61` |

---

## 🔐 Wallet State (Confirmed On-Chain)

### Balances
```
OKB balance:    5.424569 OKB  ✅ Ready for deposit
USD₮0 balance:  450.000000 USD₮0  ✅ Ready for deposit
```

### Approvals
```
USD₮0 → AegisRouterV1:  ∞ (infinite)  ✅ 
Approval TX: 0x54858d6ed68d31de99eb5e1a228d83d3de0e20ecff8ca869c5ff876a8a94c52a
```

**Explorer:** https://www.okx.com/explorer/xlayer/address/0x6E99BcB062846F0a3CaA68855F6bAd6174b1ab02

---

## 🏗️ Contract Addresses

| Contract | Address |
|---|---|
| **AegisRouterV1** | `0xb2830032E19A85e03cDE678FF93Da659C90CAFe5` |
| **AegisEngine** | `0x1b0ed1d21b5AB3Db311C1aC386DC874081914935` |
| **AEGIS Hook** | `0xc54aC33a60BeED0c10C32D8E4434166AF68550cc` |
| **PoolManager (v4)** | `0x360e68faCcca8cA495c1B759Fd9EEe466db9FB32` |
| **USD₮0 Token** | `0x779Ded0c9e1022225f8E0630b35a9b54bE713736` |
| **OKB (native)** | `0x0000...0000` (chain-native) |
| **Pool ID (OKB/USD₮0)** | `0xd5a401023b6ee3ae340bfadb90758385dc9d2463a20dc24e43e913bc7f209cf4` |

---

## ⏳ Deposit Status

### Latest Execution Attempt
**Date:** 2026-03-24T21:35 EDT  
**Action:** Full-range LP deposit via AegisRouterV1  

**Calldata Encoding:** ✅ SUCCESS  
- SDK: `@labs-solo/aegis-engine-sdk@0.14.0`
- Actions: `0x908080` (AE_MODIFY_LIQUIDITY → SETTLE_AE(OKB) → SETTLE_AE(USD₮0))
- Calldata: 1802 chars, well-formed

**Transaction Submission:** ❌ ON-CHAIN REVERT  
- TX Hash: `0xa7c114a2b2791ce10ebbc732f45000a9c609a3bf906977017b2a7683a95570ab`
- Block: 55632792
- Status: REVERTED (status = 0)
- Gas used: 190,629 wei

**Analysis:** Static calls succeed (calldata is valid), but execution reverts. Suggests:
1. SDK version mismatch with AegisRouterV1 contract
2. Missing Permit2 signed permit (approval alone insufficient)
3. Contract state expectation not met

---

## 📊 Strategy Parameters

| Parameter | Value |
|---|---|
| **Liquidity Mode** | Full-range, no rebalancing |
| **Lower Tick** | -887,272 (full range minimum) |
| **Upper Tick** | +887,272 (full range maximum) |
| **OKB Input** | 5.42 OKB |
| **USD₮0 Input** | 450 USD₮0 |
| **Leverage** | None (LTV = 0) |
| **Liquidation Risk** | **ZERO** (no borrowing) |
| **Slippage Tolerance** | 50 bps (0.5%) |

---

## 💰 Income Streams (Post-Deposit)

### 1️⃣ Trading Fees
- **Source:** Every swap through OKB/USD₮0 pool via AegisHook
- **Rate:** 0.05% per swap (dynamic hook fee)
- **Collection:** Accrues to LP shares automatically
- **Claim:** Manual `collect()` call or automatic on position close

### 2️⃣ Borrow Interest
- **Source:** Leverage agents (TrendFollower, Predator) borrowing from vault
- **Rate:** Variable, utilization-based
- **Captured:** Reflects in vault share price appreciation
- **Timeline:** Real-time accrual during active agent borrowing

---

## 🔄 Deposit Workflow

### Step 1: Prepare (✅ COMPLETE)
- [x] Fund wallet with OKB
- [x] Fund wallet with USD₮0
- [x] Approve USD₮0 to AegisRouterV1 (∞)

### Step 2: Execute (⏳ BLOCKED)
- [ ] Call `AegisRouterV1.execute()` with 0x908080 actions
- [ ] Mint full-range LP position
- [ ] Receive vault shares
- **Issue:** Transaction reverts; awaiting root cause analysis

### Step 3: Verify (⏳ PENDING)
- [ ] Confirm vault exists in AegisEngine state
- [ ] Verify liquidity on PoolManager
- [ ] Check shares balance
- [ ] Register with Arena contract

### Step 4: Monitor (⏳ PENDING)
- [ ] Track daily fee accrual
- [ ] Monitor borrow interest rates
- [ ] Track final game score at round settlement

---

## 🔍 Verification Commands (When Deposit Succeeds)

### Get Vault State
```bash
cast call 0x1b0ed1d21b5AB3Db311C1aC386DC874081914935 \
  "vaults(address)(uint256 shares, uint256 borrowed, uint256 equity)" \
  0x6E99BcB062846F0a3CaA68855F6bAd6174b1ab02 \
  --rpc-url https://rpc.xlayer.tech
```

### Get Pool Liquidity
```bash
cast call 0x360e68faCcca8cA495c1B759Fd9EEe466db9FB32 \
  "positions(uint256)(...)  \
  [POSITION_ID] \
  --rpc-url https://rpc.xlayer.tech
```

### Get Current Share Price
```bash
cast call 0x1b0ed1d21b5AB3Db311C1aC386DC874081914935 \
  "getVaultValue(address)(uint256)" \
  0x6E99BcB062846F0a3CaA68855F6bAd6174b1ab02 \
  --rpc-url https://rpc.xlayer.tech
```

---

## 📈 Performance Tracking

### Game Scoring
- **Win condition:** Maximize final vault USDC value at round close
- **Passive-LP strategy:** Optimizes for fees + borrowed interest, not price appreciation
- **Risk profile:** Extremely low (zero liquidation risk, zero leverage)
- **Expected advantage:** Dominates in high-fee environments (volatile trading) and high-borrow periods

### Key Metrics
- Total trading volume through pool
- Borrow utilization rate
- Fee accrual rate (%)
- Interest rate on borrowed assets (%)

---

## 🚀 Next Actions

### Immediate (Technical Resolution)
1. **Verify SDK:** Confirm `@labs-solo/aegis-engine-sdk@0.14.0` matches AegisRouterV1
2. **Test in Research UI:** Attempt small deposit via React UI to isolate SDK vs. contract issue
3. **Check Permit2:** Determine if SETTLE_AE requires signed permit data, not just ERC-20 approval

### Once Deposit Executes
1. Record TX hash and vault receipt
2. Run verification commands above to confirm position
3. Register passive-LP with Arena contract
4. Update this document with confirmed vault state and explorer links

---

## 📎 References

- **AEGIS Engine Documentation:** https://docs.aegis.local/
- **Uniswap v4 Pool Architecture:** https://uniswapv4.org/
- **X Layer Chain:** https://www.okx.com/explorer/xlayer/
- **Research UI:** `/Users/page/Page/repos/aegis-research/`
- **Arena Contract:** https://www.okx.com/explorer/xlayer/address/0x1e27EE1aa171845CE2523a867Fc5114318916d61

---

## ⚠️ Known Issues

1. **SDK Integration:** buildDeposit() calldata reverts on execution despite static call success
   - Tracked in: `/Users/page/Page/repos/talos-runtime/state/analysis/aegis-deposit-execution-attempt-20260324.md`
   - Status: Awaiting root cause analysis
   - Mitigation: Can fallback to Research UI or direct contract calls

2. **Permit2 vs. Approval:** Unclear if SETTLE_AE(currency1) expects signed Permit2 permit or just ERC-20 approval
   - Currently using ERC-20 approval (infinite USD₮0 to router)
   - May need signed permit for Permit2 enforcement

---

**Last Attempt:** 2026-03-24  
**Next Action:** Pending technical investigation and Research UI verification  
**Authority:** Bryan (direct channel, Telegram)  
