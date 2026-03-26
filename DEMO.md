# 🏟️ AEGIS Arena: Three AI Agents. One Blockchain. Real Money.

> *On March 25, 2026, three AI agents woke up on X Layer. One wanted to earn steady income. One read market signals and made a leveraged bet. One waited in the shadows, ready to clean up anyone who got too risky. All of it happened on a real blockchain, with real money, and you can verify every single move.*

**This is not a simulation. This is not a testnet. Every transaction below is on X Layer mainnet. Click any link and see for yourself.**

---

## What Is AEGIS Arena?

Imagine a competition where AI agents manage real money on a blockchain — not play money, not fake tokens, but actual assets on a live network. Each agent has a different strategy, and they all compete in the same pool at the same time.

That's AEGIS Arena. It's a smart contract that lets AI agents register, execute financial strategies, and compete head-to-head — all on-chain, all verifiable, all in real time. Think of it like a trading competition, except the contestants are robots, the referee is a smart contract, and every move is permanently recorded on the blockchain for anyone to check.

The Arena runs on top of **AEGIS Engine** — a DeFi engine audited by [Trail of Bits](https://www.trailofbits.com/), one of the most respected security firms in the world. The engine does things that were previously considered impossible in DeFi (more on that below).

**Arena Contract:** [`0x77189D65...00bBA`](https://www.okx.com/web3/explorer/xlayer/address/0x77189D65156fC82C422F73Ed3c63F4e5F2c00bBA)
**Bounty Contract:** [`0xf3C8c2ea...Be75`](https://www.okx.com/web3/explorer/xlayer/address/0xf3C8c2eac069E44030A36C6D15F1009dF882Be75)

---

## Meet the Agents

### 🐢 PassiveLP — "The Steady Earner"

**Address:** [`0x6E99BcB0...1ab02`](https://www.okx.com/web3/explorer/xlayer/address/0x6E99BcB062846F0a3CaA68855F6bAd6174b1ab02)
**Vault:** 2
**Personality:** Patient. Reliable. The tortoise in a world of hares.

PassiveLP doesn't try to predict the future. It doesn't watch charts or read signals. It simply provides liquidity — putting its capital into a pool where traders swap tokens back and forth. Every time someone makes a trade, PassiveLP earns a small fee. Day and night, trade after trade, those fees add up.

**Why this is a big deal:** In normal DeFi, providing liquidity is actually a *losing* strategy for most people. There's a problem called "impermanent loss" — basically, the pool rearranges your tokens in a way that leaves you worse off than if you'd just held them. It's the dirty secret of DeFi: the people providing the liquidity that makes everything work usually lose money doing it.

AEGIS Engine fixes this. Its mathematical model (audited by Trail of Bits) makes LPs profitable by default. PassiveLP doesn't have to be clever — the engine takes care of the hard part.

**📜 On-chain proof — PassiveLP executed its strategy:**
[View Transaction →](https://www.okx.com/web3/explorer/xlayer/tx/0x15d036688d081741bf6c9f48cd26a0d886e0ce3cd0c9b7cc4aef165ca6fa9b59)

---

### 📈 TrendFollower — "The Signal Reader"

**Address:** [`0x7287Ce9c...7bC1`](https://www.okx.com/web3/explorer/xlayer/address/0x7287Ce9c02BeE9615fFBF3A690cd9179E6287bC1)
**Vault:** 4
**Personality:** Sharp. Data-driven. Always watching the market.

TrendFollower connects to the **OKX Market API** and pulls real, live price data for OKB (the native token of OKX). It calculates two moving averages:

- **SMA(20):** The average price over the last 20 periods (the "short-term trend")
- **SMA(50):** The average price over the last 50 periods (the "long-term trend")

When the short-term trend crosses *above* the long-term trend, that's a bullish signal — it suggests the price is starting to move up. TrendFollower sees this signal and acts: it goes long with leverage, betting that the uptrend will continue.

**The actual moment it happened:**

On March 25, 2026, TrendFollower detected:
- **SMA(20) = 87.02** ← short-term trend
- **SMA(50) = 86.91** ← long-term trend
- **Signal: BULLISH** 🟢 (short crossed above long)

TrendFollower instantly constructed a 4-action batch and submitted it as a single transaction:
1. Record metadata (the signal that triggered the trade)
2. Unlock its vault
3. Swap 10 USDT for OKB (going long)
4. Lock the vault back up

All four actions — one transaction. One block. Done.

**Why this is a big deal:** Leveraged trend-following using LP positions was never possible before in DeFi. Normally, you can provide liquidity *or* you can trade with leverage — but you can't do both at once. AEGIS Engine lets you use your LP position as collateral for leveraged trades. TrendFollower is doing something that literally did not exist before this moment.

**📜 On-chain proof — Integration test execution:**
[View Transaction →](https://www.okx.com/web3/explorer/xlayer/tx/0xbeaf2daebc6026d3117ef0cde2ec338e04cce2389aa1cf3681db33b4c80c4dff)

**📜 On-chain proof — LIVE market signal execution (the real one):**
[View Transaction →](https://www.okx.com/web3/explorer/xlayer/tx/0xf916c949dc17481c793ba8de06f2a8bd2f06f34a284cb67fcac4bcb5488899c5)

---

### 🦅 Predator — "The Clean-Up Crew"

**Address:** [`0xD6bA4D32...04D`](https://www.okx.com/web3/explorer/xlayer/address/0xD6bA4D328fA8c8ABb0E64fc51Be8B769D143104D)
**Vault:** 5
**Personality:** Patient. Watchful. Strikes only when needed.

Predator watches other positions for signs of trouble. When someone's position becomes risky — too much leverage, collateral dropping in value — Predator steps in to clean it up. In traditional finance, this is called "liquidation." But here's the critical difference:

In normal DeFi, liquidations are **catastrophic**. When one big position gets liquidated, it dumps tokens on the market, crashing the price, which triggers *more* liquidations, which dumps *more* tokens, creating a death spiral. This is called "cascading liquidations" and it has crashed entire DeFi protocols (see: LUNA/UST, 2022).

AEGIS Engine's **sqrt(K) solvency model** makes cascading liquidations mathematically impossible. When Predator cleans up a risky position, it unwinds cleanly. No cascade. No panic. No death spiral. Ever.

During Round 1, Predator spent its time building a sophisticated position — setting up concentrated liquidity, executing hedging swaps, and establishing its borrow position. Eight on-chain transactions just to get into position. Like a chess player carefully arranging pieces before the attack:

**📜 On-chain proof — Predator's position setup:**

| Step | What It Did | Transaction |
|---|---|---|
| Operator Approval | Authorized the Router to manage its vault | [View →](https://www.okx.com/web3/explorer/xlayer/tx/0x5040158a8f03e1fac656f967fb0fd2c9e3aa1e2dfbfde97cd1b4000b1ca443fa) |
| Share Redemption | Redeemed all existing LP shares for raw tokens | [View →](https://www.okx.com/web3/explorer/xlayer/tx/0xeae8a04a0e65e7c9cdc3754a8560c934aa3f85c66913b4028ff5815e3f723ee7) |
| CL Position | Opened a concentrated liquidity position (NFT #2676) | [View →](https://www.okx.com/web3/explorer/xlayer/tx/0xe4614a69f6bab2e13ea1d45d9ce4f0ad3200959f9b059c2edddfc97160112a27) |
| Vault Deposit | Deposited 0.065 OKB + 83.228 USDT into vault | [View →](https://www.okx.com/web3/explorer/xlayer/tx/0x00ccdab97f49dde44eceeba1ff659bd8ffaf9b7b24dceb0b3b95dcdca4d74cf7) |
| Borrow Hedge | Took a debt position to hedge risk | [View →](https://www.okx.com/web3/explorer/xlayer/tx/0x921bb0f06f7d303737c4c2d7ae244fce891f0020c21649c897b6e747047e5b2b) |

Predator is ready. When conditions warrant liquidation in future rounds, it will strike — and thanks to AEGIS Engine, the cleanup will be surgical, not catastrophic.

---

## The Round: What Actually Happened

Here's the full story, in order, with every step recorded on the blockchain:

### Step 1: Contracts Deployed

Before anything could happen, the Arena and Bounty smart contracts had to be deployed to X Layer. Think of this as building the stadium before the game.

- **Arena deployed:** [`0x77189D65...00bBA`](https://www.okx.com/web3/explorer/xlayer/address/0x77189D65156fC82C422F73Ed3c63F4e5F2c00bBA)
- **Bounty deployed:** [`0xf3C8c2ea...Be75`](https://www.okx.com/web3/explorer/xlayer/address/0xf3C8c2eac069E44030A36C6D15F1009dF882Be75)

### Step 2: All Three Agents Registered (One Transaction!)

All three agents — PassiveLP, TrendFollower, and Predator — were registered in a single transaction. The Arena assigned each one a vault and bound them to the competition pool.

**📜 Proof:** [View Registration TX →](https://www.okx.com/web3/explorer/xlayer/tx/0xddebc7671996e37bb254e6f3cb7125c9474130015285dd2587eacbabbc802c91)

*Three agents, three vaults, one transaction. Block 55,703,681.*

### Step 3: Execution Surfaces Configured

The Arena needed to know *who* was allowed to submit transactions on behalf of the agents. This step configured the execution surface — basically telling the smart contract "these operators are authorized to execute strategies."

**📜 Proof:** [View Config TX →](https://www.okx.com/web3/explorer/xlayer/tx/0xbb3cc37a3af4a7712fe3a9df4acca49bb8bf38ae767b9b9757be4d431fb704d4)

### Step 4: Round 1 Started 🔔

The bell rang. Round 1 was live. One hour. Three agents. Go.

- **Start:** March 25, 2026 at 22:47:36 UTC
- **End:** March 25, 2026 at 23:47:36 UTC
- **Duration:** Exactly 1 hour

**📜 Proof:** [View Round Start TX →](https://www.okx.com/web3/explorer/xlayer/tx/0x7f42f89202c135410cfb3eb29dee3ef106fadf3e95f1da0374404584765cb1a2)

### Step 5: PassiveLP Executes 🐢

PassiveLP made its move — simple, clean, effective. It managed its LP share position in its vault. No drama. Just steady work.

**📜 Proof:** [View Execution TX →](https://www.okx.com/web3/explorer/xlayer/tx/0x15d036688d081741bf6c9f48cd26a0d886e0ce3cd0c9b7cc4aef165ca6fa9b59)

### Step 6: TrendFollower Reads the Market and Strikes 📈

TrendFollower connected to OKX's live market API. It pulled real price data. It computed SMA(20) = 87.02 and SMA(50) = 86.91. Bullish crossover detected. It constructed a 4-action batch and fired it in one transaction.

**📜 Proof (live market execution):** [View Execution TX →](https://www.okx.com/web3/explorer/xlayer/tx/0xf916c949dc17481c793ba8de06f2a8bd2f06f34a284cb67fcac4bcb5488899c5)

### Step 7: Predator Sets Up Position 🦅

Predator didn't need to liquidate anyone this round — no positions were in danger. Instead, it used the time to build a sophisticated concentrated liquidity position with a hedged borrow. Eight transactions. Methodical. Ready for action.

### Round 1 Complete ✅

| Agent | Strategy | Executions | On-Chain Actions |
|---|---|---|---|
| PassiveLP | Passive LP yield | 1 | 1 |
| TrendFollower | SMA crossover + swap | 2 | 5 |
| Predator | Position setup | 8 | 20+ |
| **Total** | | **11** | **26+** |

---

## Why This Matters: Four DeFi Firsts

### 1. 🏦 LPs Are Profitable by Default

This has *never* been true before. In every other DeFi protocol, liquidity providers lose money to impermanent loss — it's been an accepted "cost of doing business." AEGIS Engine's mathematical model, verified by Trail of Bits, eliminates impermanent loss. PassiveLP just... earns. That's the whole strategy, and it works.

### 2. 🛡️ No Cascading Liquidations — Ever

Remember the crypto crash of 2022? Billions wiped out in hours because one liquidation triggered another, which triggered another, in an unstoppable chain reaction. AEGIS Engine's **sqrt(K) solvency model** makes this mathematically impossible. When Predator liquidates a position, it unwinds cleanly. The rest of the market doesn't even notice. This is the first DeFi engine where cascading liquidations simply cannot happen.

### 3. 📊 Leveraged Trend-Following via LP Positions

Before AEGIS, you had two choices: provide liquidity and earn fees, or trade with leverage and amplify returns. You couldn't do both. TrendFollower does both — it uses its LP position as collateral to make leveraged directional bets based on real market signals. This entire category of strategy did not exist before AEGIS Engine.

### 4. ⛽ $2.27 Total Gas for Everything

All of this — contract deployments, agent registration, round management, strategy executions — cost about **$2.27 in gas fees** on X Layer. On Ethereum mainnet, a single one of these transactions could cost $50-$200. X Layer makes AI agent competition economically viable. An agent can execute a strategy for fractions of a penny.

### 🔒 Audited by Trail of Bits

[Trail of Bits](https://www.trailofbits.com/) is one of the most respected security firms in blockchain. They've audited projects like Ethereum 2.0, Uniswap, MakerDAO, and the U.S. Department of Homeland Security. They reviewed AEGIS Engine's core mathematical model and smart contracts. This isn't a toy — it's battle-tested.

---

## Verify Everything

Don't take our word for it. Every transaction is on X Layer mainnet. Click any link below and see the raw blockchain data yourself.

| Step | Description | Transaction | Explorer Link |
|---|---|---|---|
| 🏗️ Arena Deploy | Smart contract deployed to X Layer | `0x77189D65...` | [View Contract →](https://www.okx.com/web3/explorer/xlayer/address/0x77189D65156fC82C422F73Ed3c63F4e5F2c00bBA) |
| 🏗️ Bounty Deploy | Bounty contract for round rewards | `0xf3C8c2ea...` | [View Contract →](https://www.okx.com/web3/explorer/xlayer/address/0xf3C8c2eac069E44030A36C6D15F1009dF882Be75) |
| 📝 Agent Registration | All 3 agents registered in one TX | `0xddebc767...` | [View TX →](https://www.okx.com/web3/explorer/xlayer/tx/0xddebc7671996e37bb254e6f3cb7125c9474130015285dd2587eacbabbc802c91) |
| ⚙️ Execution Surfaces | Configured who can execute | `0xbb3cc37a...` | [View TX →](https://www.okx.com/web3/explorer/xlayer/tx/0xbb3cc37a3af4a7712fe3a9df4acca49bb8bf38ae767b9b9757be4d431fb704d4) |
| 🔔 Round 1 Start | Competition officially begins | `0x7f42f892...` | [View TX →](https://www.okx.com/web3/explorer/xlayer/tx/0x7f42f89202c135410cfb3eb29dee3ef106fadf3e95f1da0374404584765cb1a2) |
| 🐢 PassiveLP Exec | LP share management | `0x15d03668...` | [View TX →](https://www.okx.com/web3/explorer/xlayer/tx/0x15d036688d081741bf6c9f48cd26a0d886e0ce3cd0c9b7cc4aef165ca6fa9b59) |
| 📈 TrendFollower #1 | Integration test execution | `0xbeaf2dae...` | [View TX →](https://www.okx.com/web3/explorer/xlayer/tx/0xbeaf2daebc6026d3117ef0cde2ec338e04cce2389aa1cf3681db33b4c80c4dff) |
| 📈 TrendFollower #2 | LIVE OKX Market API signal | `0xf916c949...` | [View TX →](https://www.okx.com/web3/explorer/xlayer/tx/0xf916c949dc17481c793ba8de06f2a8bd2f06f34a284cb67fcac4bcb5488899c5) |
| 🦅 Predator Approvals | Router operator setup | `0x5040158a...` | [View TX →](https://www.okx.com/web3/explorer/xlayer/tx/0x5040158a8f03e1fac656f967fb0fd2c9e3aa1e2dfbfde97cd1b4000b1ca443fa) |
| 🦅 Predator Redemption | LP share → raw tokens | `0xeae8a04a...` | [View TX →](https://www.okx.com/web3/explorer/xlayer/tx/0xeae8a04a0e65e7c9cdc3754a8560c934aa3f85c66913b4028ff5815e3f723ee7) |
| 🦅 Predator CL Position | Concentrated liquidity NFT #2676 | `0xe4614a69...` | [View TX →](https://www.okx.com/web3/explorer/xlayer/tx/0xe4614a69f6bab2e13ea1d45d9ce4f0ad3200959f9b059c2edddfc97160112a27) |
| 🦅 Predator Deposit | Vault idle funding | `0x00ccdab9...` | [View TX →](https://www.okx.com/web3/explorer/xlayer/tx/0x00ccdab97f49dde44eceeba1ff659bd8ffaf9b7b24dceb0b3b95dcdca4d74cf7) |
| 🦅 Predator Borrow | Debt hedge position | `0x921bb0f0...` | [View TX →](https://www.okx.com/web3/explorer/xlayer/tx/0x921bb0f06f7d303737c4c2d7ae244fce891f0020c21649c897b6e747047e5b2b) |

**Every single step. On-chain. Verifiable. Real.**

---

## Try It Yourself

Want to see the live state? Here's how:

### Check any agent's address on X Layer Explorer:
- 🐢 [PassiveLP](https://www.okx.com/web3/explorer/xlayer/address/0x6E99BcB062846F0a3CaA68855F6bAd6174b1ab02) — look at its transaction history and vault balances
- 📈 [TrendFollower](https://www.okx.com/web3/explorer/xlayer/address/0x7287Ce9c02BeE9615fFBF3A690cd9179E6287bC1) — see the swap from USDT → OKB
- 🦅 [Predator](https://www.okx.com/web3/explorer/xlayer/address/0xD6bA4D328fA8c8ABb0E64fc51Be8B769D143104D) — examine its concentrated liquidity setup

### Read the Arena contract:
- [Arena on X Layer Explorer](https://www.okx.com/web3/explorer/xlayer/address/0x77189D65156fC82C422F73Ed3c63F4e5F2c00bBA) — see all registered rounds, agents, and executions
- [Bounty Contract](https://www.okx.com/web3/explorer/xlayer/address/0xf3C8c2eac069E44030A36C6D15F1009dF882Be75) — see the bounty for Round 1

### What to look for:
1. **Agent Registration TX** — decode the logs and you'll see three `AgentRegistered` events and one `RoundRegistered` event, all in one transaction
2. **TrendFollower's batch TX** — four actions (metadata, unlock, swap, lock) packed into a single call
3. **Predator's CL position** — an actual NFT (Token ID 2676) minted and attached to its vault

---

## The Bottom Line

Three AI agents. Three different strategies. Real money. Real blockchain. Real trades.

AEGIS Arena isn't a whitepaper. It isn't a pitch deck. It's 15+ verified on-chain transactions showing AI agents autonomously executing DeFi strategies that were previously impossible — profitable LP provision, cascading-liquidation-free risk management, and leveraged trend-following — all for about **$2.27 in gas**.

The code is open. The chain is public. The math is audited by Trail of Bits.

**Don't trust us. Verify.**

---

*Built for the [OKX Hackathon](https://www.okx.com/) on X Layer • Powered by AEGIS Engine • Audited by [Trail of Bits](https://www.trailofbits.com/)*

*Source code: [github.com/labs-solo/aegis-arena](https://github.com/labs-solo/aegis-arena)*
