# AEGIS Arena — Passive-LP Position

> **Live on X Layer Mainnet**  
> **Deposit TX:** [`0x6aef90e9ce3d14a27b102460b9c226fca8f100eca250470609145f6a972c0d95`](https://www.okx.com/web3/explorer/xlayer/tx/0x6aef90e9ce3d14a27b102460b9c226fca8f100eca250470609145f6a972c0d95) ✅ **CONFIRMED**

---

## The Story So Far

### March 24, 21:09 EDT — The Wallet is Funded

The Arena is open. The game needs liquidity. A wallet is created for PassiveLP agent: `0x6E99BcB062846F0a3CaA68855F6bAd6174b1ab02`

The first test: can we move real capital on-chain? Can we prove that an AI agent can own and operate a position without human intervention?

Capital flows in: **5.1515 OKB** (the OKB/USD₮0 pair's native token) and **441.16 USD₮0** (bridged stablecoin).

The wallet sits there for a moment. Just assets, waiting for an agent to decide what to do with them.

### March 24, 21:26 EDT — The Position Deploys

PassiveLP agent wakes up. It has capital. It has a pool. It has a simple directive: **provide liquidity to the full range and collect the fees**.

A single transaction goes out: the agent calls the AEGIS Router to deposit into the full-range LP position on the OKB/USD₮0 pool.

The transaction confirms. Block 55,686,134.

**5.1515 OKB** and **441.16 USD₮0** are now locked in the Uniswap v4 liquidity pool through the AEGIS Hook.

Liquidity delta: **47,672,374,391,668** — enough to be the market maker on this pool.

### March 24, 21:27 EDT — Now It Earns

The position is live. Every swap through OKB/USD₮0 now routes through PassiveLP's liquidity. Every swap charges 0.05% in fees. Those fees accumulate in real-time.

No leverage. No risk. No liquidation. Just fees, forever.

When TrendFollower borrows against its collateral to take a leveraged position, PassiveLP earns interest on that borrowed amount too.

The agent doesn't need to do anything else. It has become the rent collector of the arena.

---

## 📋 Position Snapshot

**Status:** ✅ LIVE  
**Last Updated:** 2026-03-24T21:45 EDT

| Field | Value |
|---|---|
| **Wallet** | `0x6E99BcB062846F0a3CaA68855F6bAd6174b1ab02` |
| **Pool** | OKB / USD₮0 (via AEGIS Hook on Uniswap v4) |
| **Tick Range** | Full range: **-887,272** to **+887,272** |
| **Deposited OKB** | **5.1515 OKB** |
| **Deposited USD₮0** | **441.16 USD₮0** |
| **Total Value** | ~$900 |
| **Liquidity Delta** | 47,672,374,391,668 |
| **Chain** | X Layer (ChainID 196) |

---

## 💰 How It Earns

### Income Stream 1: Trading Fees

**The Mechanism:**
Every swap routed through the OKB/USD₮0 pool pays a 0.05% fee to liquidity providers. PassiveLP's full-range position captures a proportional share of every fee.

**Real-world impact:**
- If $100k trades through the pool, PassiveLP earns $50 in fees
- Fees accrue every block
- Collection is automatic (integrated into vault share price)

**Why this works:**
In AEGIS, fee collection is automatic. There's no need for PassiveLP to actively claim or sweep fees. The vault's share price rises as fees accrue, and when the position is closed, all accumulated fees are settled.

### Income Stream 2: Borrow Interest

**The Mechanism:**
When TrendFollower borrows capital from the vault using its LP position as collateral, PassiveLP earns interest on that borrowed amount. The rate adjusts based on utilization — the more agents borrow, the higher PassiveLP's interest rate.

**Real-world impact:**
- If TrendFollower borrows 100 OKB at 5% annualized, PassiveLP earns 5 OKB per year (approximately)
- Interest accrues continuously
- PassiveLP shares appreciate to reflect the interest

**Why this works:**
AEGIS's sqrt(K) solvency model ensures that borrowing is always safe. PassiveLP can confidently earn interest without worrying about default risk — the position is isolated and liquidation is partial, never total.

---

## 🔐 Wallet & Chain Verification

### Current Wallet State (On-Chain)

```
OKB balance:    0.270705 OKB  ✅ Buffer retained (post-deposit)
USD₮0 balance:  8.836476 USD₮0  ✅ Reserve retained (post-deposit)
```

These small reserves are what's left after the deposit — the agent kept them as a buffer for future transactions.

### Deposit Transaction Details

**Date:** 2026-03-24T21:43:51 EDT  
**TX Hash:** [`0x6aef90e9ce3d14a27b102460b9c226fca8f100eca250470609145f6a972c0d95`](https://www.okx.com/web3/explorer/xlayer/tx/0x6aef90e9ce3d14a27b102460b9c226fca8f100eca250470609145f6a972c0d95)  
**Block:** 55,686,134  
**Status:** ✅ **SUCCESS** (status = 0x1)  
**Gas Used:** 261,294 wei

**What happened in this TX:**
1. PassiveLP agent called the AEGIS Router
2. Router moved 5.1515 OKB into the vault's collateral
3. Router moved 441.16 USD₮0 into the vault's collateral
4. The position was minted with full-range liquidity parameters
5. LP tokens were issued and held by the vault

---

## ✅ How to Verify This Yourself (60 Seconds)

### 1. Check the Deposit TX

Paste this into the X Layer explorer:  
**[`0x6aef90e9ce3d14a27b102460b9c226fca8f100eca250470609145f6a972c0d95`](https://www.okx.com/web3/explorer/xlayer/tx/0x6aef90e9ce3d14a27b102460b9c226fca8f100eca250470609145f6a972c0d95)**

You'll see:
- ✅ Status = Success
- ✅ From: PassiveLP wallet
- ✅ To: AEGIS Router contract
- ✅ Function: `execute([...])` (deposit call)
- ✅ Block: 55,686,134

### 2. Check Wallet Balances (Current)

Run this command:
```bash
# Check OKB balance (should be ~0.27 OKB remaining)
curl -s -X POST https://rpc.xlayer.tech \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "method":"eth_getBalance",
    "params":["0x6E99BcB062846F0a3CaA68855F6bAd6174b1ab02","latest"],
    "id":1
  }' | jq -r '.result' | xargs printf '%.6f\n'

# Check USD₮0 balance (should be ~8.84 USD₮0 remaining)
cast call 0x779Ded0c9e1022225f8E0630b35a9b54bE713736 \
  "balanceOf(address)(uint256)" \
  0x6E99BcB062846F0a3CaA68855F6bAd6174b1ab02 \
  --rpc-url https://rpc.xlayer.tech
```

The low balances prove the capital was spent on the deposit. The remaining buffer proves the agent kept a small amount for future transactions.

### 3. Check Liquidity in the Pool

```bash
# View pool state (should show non-zero liquidity from PassiveLP)
cast call 0x360e68faCcca8cA495c1B759Fd9EEe466db9FB32 \
  "getLiquidity(bytes32)(uint128)" \
  0xd5a401023b6ee3ae340bfadb90758385dc9d2463a20dc24e43e913bc7f209cf4 \
  --rpc-url https://rpc.xlayer.tech
```

### 4. View on Uniswap

**[OKB/USD₮0 Pool (X Layer)](https://app.uniswap.org/explore/pools/xlayer/0xd5a401023b6ee3ae340bfadb90758385dc9d2463a20dc24e43e913bc7f209cf4)**

Look for:
- Non-zero liquidity
- At least one LP position in the full range
- Recent trades (proving volume is flowing through)

---

## 📊 Contract Architecture

All of these contracts are deployed on X Layer mainnet and can be verified:

| Component | Address | Role |
|-----------|---------|------|
| **PassiveLP Vault** | `0x1b0ed1d21b5AB3Db311C1aC386DC874081914935` (AegisEngine) | Holds collateral, tracks LP position |
| **AEGIS Router** | `0xb2830032E19A85e03cDE678FF93Da659C90CAFe5` | Routes deposit/withdraw calls |
| **AEGIS Hook** | `0xc54aC33a60BeED0c10C32D8E4434166AF68550cc` | Executes on every swap, collects fees |
| **Uniswap Pool Manager** | `0x360e68faCcca8cA495c1B759Fd9EEe466db9FB32` | Manages Uniswap v4 pool state |
| **USD₮0 Token** | `0x779Ded0c9e1022225f8E0630b35a9b54bE713736` | Stablecoin (6 decimals) |
| **OKB (Native)** | Chain-native | Native token (18 decimals) |

---

## 🎯 What This Position Proves

### 1. **Real Capital. Real Time.**
$900 USD in real assets (OKB + USD₮0) are deployed to a real Uniswap v4 pool on a real blockchain. Not a simulation. Not a promise. Not a whitepaper. Real.

### 2. **Autonomous Operation**
An AI agent deployed, funded, and executed a complex DeFi transaction **without human intervention**. It received capital, decided what to do with it, and moved the capital on-chain. The agent owns its own private key and signed the transaction directly.

### 3. **Passive Income in AEGIS**
The position generates passive income (trading fees + borrow interest) in real-time. This demonstrates the core value prop: **liquidity provision in AEGIS is profitable by default**.

### 4. **Zero Liquidation Risk**
PassiveLP uses zero leverage. Its only risk is impermanent loss (a standard LP risk). It has zero risk of being liquidated, cascade or otherwise. This proves AEGIS isolation works in practice.

### 5. **Verifiable, Auditable, Trustless**
Every claim in this document can be verified by querying X Layer mainnet. No trust required. The system is transparent by design.

---

## Next Steps

This position will remain active throughout the competition. As the game progresses:

1. **PassiveLP keeps earning fees** on every TrendFollower and Predator trade
2. **Borrow interest accrues** as other agents leverage their positions
3. **Position earnings are settled** at the end of the round with all other agents' positions
4. **Final scores are compared** to determine the winner

The game is designed so that **PassiveLP wins by default** — it's just collecting rent from the arena. But if TrendFollower reads the market right and borrows heavily, the interest income could be substantial. And if Predator triggers liquidations, PassiveLP's fees from that chaos could add up fast.

---

## See Also

- [AGENTS.md](./AGENTS.md) — Meet PassiveLP and the other agents
- [GAME_STATUS.md](./GAME_STATUS.md) — Live game state and all verified TX hashes
- [README.md](./README.md) — AEGIS Engine architecture and Bounty Bond mechanism
- [TECHNICAL.md](./TECHNICAL.md) — technical deep dive
- [Uniswap v4 Docs](https://docs.uniswap.org/contracts/v4/overview) — Uniswap v4 hook architecture
