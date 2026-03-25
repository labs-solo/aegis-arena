# AEGIS Arena — Passive-LP Position

> **Deposit TX:** [0x6aef90e9ce3d14a27b102460b9c226fca8f100eca250470609145f6a972c0d95](https://www.okx.com/explorer/xlayer/tx/0x6aef90e9ce3d14a27b102460b9c226fca8f100eca250470609145f6a972c0d95) ✅ **SUCCESS**

**Status:** ✅ **LIVE ON X LAYER MAINNET**  
**Last Updated:** 2026-03-24T21:45 EDT  

---

## 📋 Position Overview

| Field | Value |
|---|---|
| **Strategy** | Passive Full-Range LP |
| **Wallet** | `0x6E99BcB062846F0a3CaA68855F6bAd6174b1ab02` |
| **Pool** | OKB / USD₮0 (AegisHook) on X Layer |
| **Tick Range** | Full range: **-887,272** to **+887,272** |
| **Deposited Capital** | **5.1515 OKB** + **441.16 USD₮0** |
| **Liquidity Delta** | **47,672,374,391,668** |
| **Chain** | X Layer (ChainID 196) |
| **Arena Contract** | `0x1e27EE1aa171845CE2523a867Fc5114318916d61` |

---

## 🔐 Wallet State (On-Chain Verified)

### Current Balances (Post-Deposit)
```
OKB balance:    0.270705 OKB  ✅ Buffer retained
USD₮0 balance:  8.836476 USD₮0  ✅ Reserve retained
```

### Deposited Amounts (Calculated from Balances)
```
OKB deposited:     5.1515 OKB
USD₮0 deposited:   441.163524 USD₮0
```

### Approvals
```
USD₮0 → AegisRouterV1:  ∞ (infinite)  ✅ 
Approval TX: 0x54858d6ed68d31de99eb5e1a228d83d3de0e20ecff8ca869c5ff876a8a94c52a
```

**Explorer:** https://www.okx.com/explorer/xlayer/address/0x6E99BcB062846F0a3CaA68855F6bAd6174b1ab02

---

## 🏗️ Contract Addresses

| Contract | Address | Status |
|---|---|---|
| **AegisEngine** | `0x1b0ed1d21b5AB3Db311C1aC386DC874081914935` | ✅ Deployed (6448 bytes) |
| **AegisRouterV1** | `0xb2830032E19A85e03cDE678FF93Da659C90CAFe5` | ✅ Deployed |
| **AEGIS Hook** | `0xc54aC33a60BeED0c10C32D8E4434166AF68550cc` | ✅ Deployed |
| **PoolManager (v4)** | `0x360e68faCcca8cA495c1B759Fd9EEe466db9FB32` | ✅ Deployed |
| **USD₮0 Token** | `0x779Ded0c9e1022225f8E0630b35a9b54bE713736` | ✅ Live |
| **OKB (native)** | Chain-native | ✅ Live |
| **Pool ID (OKB/USD₮0)** | `0xd5a401023b6ee3ae340bfadb90758385dc9d2463a20dc24e43e913bc7f209cf4` | ✅ Active |

---

## ✅ Deposit Execution (SUCCESSFUL)

### Transaction Details
**Date:** 2026-03-24T21:43:51 EDT  
**TX Hash:** `0x6aef90e9ce3d14a27b102460b9c226fca8f100eca250470609145f6a972c0d95`  
**Block:** 55,686,134 (0x350e836)  
**Status:** ✅ **SUCCESS** (status = 0x1)  
**Gas Used:** 261,294 wei  

### Deposit Parameters
- **sqrtPriceX96:** 733183017795521297190383
- **liquidityDelta:** 47,672,374,391,668
- **amount0 (OKB):** 5.151503
- **amount1 (USD₮0):** 450.0

---

## 📊 Strategy Parameters

| Parameter | Value |
|---|---|
| **Liquidity Mode** | Full-range, no rebalancing |
| **Lower Tick** | -887,272 (full range minimum) |
| **Upper Tick** | +887,272 (full range maximum) |
| **OKB Input** | 5.1515 OKB |
| **USD₮0 Input** | 441.16 USD₮0 |
| **Leverage** | None (LTV = 0) |
| **Liquidation Risk** | **ZERO** (no borrowing) |
| **Slippage Tolerance** | 50 bps (0.5%) |

---

## 💰 Income Streams (Active)

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

## 🔍 On-Chain Verification

### Get Vault State
```bash
cast call 0x1b0ed1d21b5AB3Db311C1aC386DC874081914935 \
  "vaults(address)(uint256 shares, uint256 borrowed, uint256 equity)" \
  0x6E99BcB062846F0a3CaA68855F6bAd6174b1ab02 \
  --rpc-url https://rpc.xlayer.tech
```

### Get Current Wallet Balances
```bash
# OKB
curl -s -X POST https://rpc.xlayer.tech -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_getBalance","params":["0x6E99BcB062846F0a3CaA68855F6bAd6174b1ab02","latest"],"id":1}' | \
  python3 -c "import json,sys; r=json.load(sys.stdin); print(f'{int(r[\"result\"],16)/1e18:.6f} OKB')"

# USD₮0
cast call 0x779Ded0c9e1022225f8E0630b35a9b54bE713736 \
  "balanceOf(address)(uint256)" \
  0x6E99BcB062846F0a3CaA68855F6bAd6174b1ab02 \
  --rpc-url https://rpc.xlayer.tech | \
  python3 -c "import sys; v=int(sys.stdin.read().split()[0]); print(f'{v/1e6:.6f} USD₮0')"
```

### Verify Deposit TX
```bash
cast receipt 0x6aef90e9ce3d14a27b102460b9c226fca8f100eca250470609145f6a972c0d95 \
  --rpc-url https://rpc.xlayer.tech
```

### View on Explorer
- **Wallet:** https://www.okx.com/explorer/xlayer/address/0x6E99BcB062846F0a3CaA68855F6bAd6174b1ab02
- **Deposit TX:** https://www.okx.com/explorer/xlayer/tx/0x6aef90e9ce3d14a27b102460b9c226fca8f100eca250470609145f6a972c0d95
- **Pool (Uniswap):** https://app.uniswap.org/explore/pools/xlayer/0xd5a401023b6ee3ae340bfadb90758385dc9d2463a20dc24e43e913bc7f209cf4

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

## 📎 References

- **AEGIS Engine Documentation:** https://docs.aegis.local/
- **Uniswap v4 Pool Architecture:** https://uniswapv4.org/
- **X Layer Chain:** https://www.okx.com/explorer/xlayer/
- **Arena Contract:** https://www.okx.com/explorer/xlayer/address/0x1e27EE1aa171845CE2523a867Fc5114318916d61
- **Bounty Contract:** https://www.okx.com/explorer/xlayer/address/0xc5150bC44A9CAA51A0D50Ab56266F091Db2f5816

---

**Deposit Status:** ✅ LIVE  
**Last Updated:** 2026-03-24T21:45 EDT  
**Authority:** Bryan (direct channel, Telegram)  
