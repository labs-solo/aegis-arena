# AEGIS Arena — The First Autonomous Agent Marketplace

> ✅ **DEPLOYED ON X LAYER MAINNET** — Arena: [`0x1e27EE1aa171845CE2523a867Fc5114318916d61`](https://www.okx.com/explorer/xlayer/address/0x1e27EE1aa171845CE2523a867Fc5114318916d61) | Bounty: [`0xc5150bC44A9CAA51A0D50Ab56266F091Db2f5816`](https://www.okx.com/explorer/xlayer/address/0xc5150bC44A9CAA51A0D50Ab56266F091Db2f5816)


Most liquidity provision loses money. Impermanent loss, cascading liquidations, and static fee models bleed LPs even when markets are trending sideways. **AEGIS changes this at the protocol level** — and AEGIS Arena is where you prove it.

**AEGIS Engine is a Uniswap v4 hook that gives liquidity positions on-chain credit.** LPs don't just earn fees — they borrow against their positions, take directional bets, and earn even when prices move against them. The math that makes this safe is the same math that eliminates cascade liquidations entirely.

### Why No Cascade Liquidations Matter

In traditional DeFi (Compound, Aave, even Uniswap v3): when a borrower gets liquidated, the liquidation pressure cascades — price drops, triggers more liquidations, collapses the pool. **AEGIS uses sqrt(K) solvency: each vault is isolated, borrows against the geometric mean of its own liquidity, and can only be liquidated to the point of solvency — never below.** Concrete example: "Agent B's over-leveraged position gets peeled — not liquidated — AEGIS takes back exactly what it needs to stay solvent and leaves the rest. The pool price doesn't move. Agent A's position is unaffected." **This means AI agents can run 3x leverage aggressively, in competition, on a shared pool, without any risk of systemic collapse.**

### The Arena Pitch

AEGIS Arena puts three AI agents — a passive LP, a trend trader, and a predator — into a live game on X Layer. They compete, cooperate via Bounty Bonds, read each other's positions, and pay each other for trading signals. All on-chain. No humans.

### The Path to Real DeFi

This isn't a simulation. Winning strategies from AEGIS Arena run on real AEGIS Engine infrastructure — the same contracts that will custody real capital post-audit.

## Why Liquidity Provision Wins by Default in AEGIS

1. **Dynamic Fees** — Fees adjust automatically to volatility. When the market is moving fast (when IL risk is highest), fees go up. LPs earn more exactly when they're most at risk.

2. **On-Chain Credit** — Your LP position is collateral. You can borrow against it, go directional, and earn trading profits on top of fee income. Traditional LPs choose between fees or directional exposure. AEGIS lets you do both.

3. **Isolated Solvency** — Because each vault's solvency is calculated independently using sqrt(K), one agent's loss never affects another's. This isolation is what allows aggressive leverage without systemic risk.

**Payoff:** This creates a default-profitable environment for liquidity. Agents that do nothing earn fees. Agents that are active earn fees AND trading alpha. The floor is higher than in any other DeFi protocol.

## Features

✅ Three distinct agent strategies (PassiveLP, TrendFollower, Predator)  
✅ Leveraged DeFi via AEGIS primitives (provide liquidity, borrow, swap, place orders)  
✅ Live on-chain settlement with USDC denomination conversion  
✅ x402 payment gateway integration  
✅ **Bounty Bonds** — AI agents pay each other for provable trading behavior  
✅ Complete TypeScript SDK for agent integration  
✅ Full contract specifications and documentation  

## Quick Start

```bash
# Clone
git clone https://github.com/labs-solo/aegis-arena
cd aegis-arena

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your RPC URL, private keys, and PositionManager address
# **CRITICAL:** See docs/guides/POSITION_MANAGER_LOOKUP.md to find PositionManager address

# Compile contracts
npm run build:contracts

# Run integration test
npm run test:game

# Deploy to X Layer (after POSITION_MANAGER is set)
npm run deploy
```

## Architecture Overview

```
Arena.sol (Game Orchestrator)
    ↓
AEGIS Engine (PR #18: trail-of-bits-audit-fixes-and-improvements)
    ↓
Uniswap v4 (X Layer)
    └─ USDC/WOKB Pool (5 bps fee)
```

**See:** [`docs/specs/ARCHITECTURE.md`](docs/specs/ARCHITECTURE.md) for detailed system design.

## Deployed Addresses (X Layer, Chain ID 196)

### Uniswap v4 Infrastructure
| Contract | Address |
|----------|---------|
| **PoolManager** | `0x360e68faCcca8cA495c1B759Fd9EEe466db9FB32` |
| **Permit2** | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |
| **UniversalRouter** | `0x35029f7AD06B7d62C4511239d65CEbF0f1124338` |

### AEGIS Engine Contracts
| Contract | Address |
|----------|---------|
| **AegisEngine** | `0x1b0ed1d21b5AB3Db311C1aC386DC874081914935` |
| **AegisHook** | `0xc54aC33a60BeED0c10C32D8E4434166AF68550cc` |
| **AegisRouterV1** | `0xb2830032E19A85e03cDE678FF93Da659C90CAFe5` |
| **AegisStateView** | `0xE962612Dc9dcC3a7666F5Fa6B014b3b1D9287D27` |
| **VaultRegistry** | `0xe19414e5C3DB1596f583d18d3Ac5bb43CBabc50D` |
| **OracleManager** | `0x355dAd86872DE8248538E487Ef8898e0a4E31f70` |
| **LimitOrderManager** | `0xCc7F9dC1C6BA855E2507c9C65910B48A7F6497C1` |
| **DynamicFeeManager** | `0xA5571554A47deDEb667f91d60ADCb645a2Ef1780` |
| **VariableInterestRate** | `0xCCDECda074d8411651AC1B8FD87c5CA7551f28F6` |
| **PositionManager** | `0xcF1EAFC6928dC385A342E7C6491d371d2871458b` |

### Tokens & Pools
| Contract | Address |
|----------|---------|
| **WOKB** | `0xe538905cf8410324e03A5A23C1c177a474D59b2b` |
| **USDC** | `0x74b7f16337b8972027f6196a17a631ac6de26d22` |
| **Pool (USDC/WOKB, 5bps)** | `0x9072107b33ad70c231602b537d91774a43c1837f9b28040ee9bf8cad0a0ab4a1` |

### Arena Contracts
| Contract | Address |
|----------|---------|
| **Arena.sol** | `0x1e27EE1aa171845CE2523a867Fc5114318916d61` | [View on OKX Explorer](https://www.okx.com/explorer/xlayer/tx/0xd95991873a4d8713e14b8b188a9abdb3911a89710ddfbb735152e88556d06ad7) |

---

## 🎯 Competition Pool — AEGIS Hackathon Arena

**Live on Uniswap!** → [View on Uniswap](https://app.uniswap.org/explore/pools/xlayer/0xd5a401023b6ee3ae340bfadb90758385dc9d2463a20dc24e43e913bc7f209cf4)

### Pool Summary

| Attribute | Value |
|-----------|-------|
| **Pool** | OKB / USD₮0 (AEGIS Hook) |
| **Pool ID** | `0xd5a401023b6ee3ae340bfadb90758385dc9d2463a20dc24e43e913bc7f209cf4` |
| **Chain** | X Layer (Chain ID 196) |
| **Token 0** | Native OKB (`0x0000000000000000000000000000000000000000`) |
| **Token 1** | USD₮0 (6 decimals) — `0x779Ded0c9e1022225f8E0630b35a9b54bE713736` |
| **Hook** | AEGIS Hook — `0xc54aC33a60BeED0c10C32D8E4434166AF68550cc` |

This pool is the **primary market for the AEGIS hackathon competition**. All three agents (PassiveLP, TrendFollower, Predator) trade and provide liquidity on this pool to earn swap fees and bounty rewards.

## Agent Strategies

### 1. **PassiveLP** (Conservative)
- Provides liquidity to USDC/WOKB pool
- Earns swap fees with minimal leverage
- Low risk, consistent but modest returns

### 1. **PassiveLP** (Conservative)
- **Strategy:** Provide full-range liquidity on USDC/WOKB pool (0% leverage)
- **Capital Allocation:** 50% deployed as LP, 50% held as idle USDC buffer
- **Income Streams:**
  1. **Trading Fees** (Primary) — 0.05% fee on all swap volume; full-range position captures 100% of pool volume
  2. **Borrow Interest** (Secondary) — Accrued when TrendFollower/Predator borrow against their positions
- **Risk Profile:** Zero liquidation risk (no debt); vulnerable to impermanent loss (mitigated by fee income)
- **Scoring:** Final score = idle USDC + (LP shares × current share price)
  - Share price appreciation = accumulated fees / total shares
  - At settlement, judges can verify: `final_score ≥ initial_capital × 1.10` (10% return target)
- **Bounty Strategy (CP-013):** Creates bounties from idle USDC to attract TrendFollower/Predator volume; bounty ROI is optimized using OKX Market API volume estimates
- **Expected Return:** 5-30% depending on trading volume (fee yield = volume × 0.05%)

### 2. **TrendFollower** (Aggressive)
- Detects price trends and takes directional leveraged bets
- Borrows capital via AEGIS (up to 3x leverage via sqrt(K) solvency)
- Places limit orders to close positions profitably
- High risk but liquidation-free (AEGIS guarantee)

### 3. **Predator** (Market-Neutral)
- Balanced long/short positions (delta-neutral)
- Profits from volatility and fee collection
- Medium leverage; stable returns independent of direction

See [`docs/specs/AGENTS.md`](docs/specs/AGENTS.md) for complete strategy specifications.

### PassiveLP Deep Dive: Dual Income Streams

**Income Stream 1: Trading Fees**
- **Source:** Uniswap v4 swap fees on USDC/WOKB pool (0.05% = 500 bips per swap)
- **Collection:** Automatic via LP share price appreciation (no explicit claim opcode needed)
- **Example:** 10,000 USDC swap volume → 5 USDC fee pool → PassiveLP's share ≈ 2.5 USDC (if 50% of total LP capital)
- **Why Full-Range?** Full-range position (-887,272 to +887,272 ticks) captures 100% of pool volume; concentrated positions miss fees if price exits range

**Income Stream 2: Borrow Interest**
- **Source:** Interest accrued on other agents' leveraged positions (utilization-based variable rate)
- **Collection:** Implicit via LP share price increase; no explicit claim needed for MVP
- **Example:** TrendFollower borrows 30 USDC at 10% APY → over 1 hour ≈ 0.0034 USDC accrues to PassiveLP's share
- **Secondary Stream:** Interest income is conditional on borrow demand; PassiveLP doesn't control it

**Score Attribution:**
| Component | How Counted |
|-----------|------------|
| Idle USDC | 1:1 value (50 USDC counted as 50 USDC) |
| LP shares | Current share price (initial 50 USDC + accumulated fees ÷ total shares) |
| Bounty spent | Deducted from idle balance (negative contribution) |
| Bounty earned by others | Does not affect PassiveLP's score (goes to other agents) |

**Bounty Optimization (CP-013 Integration):**
- PassiveLP creates bounties to incentivize volume that generates fees
- Heuristic: spend 10% of idle balance on bounty IF expected fee return > bounty cost
- **OKX Market API Integration:** Before creating a bounty, PassiveLP queries 24h trading volume on OKB/USD to estimate fee income and avoid underwater bounties
- **Dynamic Volume Target:** Bounty condition scales with bounty size (bounty = R USDC → target volume = 10R USDC)
- **Example Breakeven:** 5 USDC bounty needs 50 USDC volume → generates 0.025 USDC fee (break-even at 200x volume multiplier; 10x is conservative)

## The Path from Arena to Production

**Phase 1 (Now): AEGIS Arena proves the strategies work.** Three AI agents compete with real on-chain logic on X Layer testnet. Winning strategies are identified. Bugs are found. Game theory is validated.

**Phase 2 (Post-audit): AEGIS Engine deploys to mainnet.** The same contracts, same primitives, same solvency model. Agent strategies proven in the Arena run on real capital.

**Phase 3 (Scale): Any agent can join.** Any developer can write an agent that implements the 4 AEGIS primitives. Profitable agents attract capital. More capital = more fees. More fees = more agents. The flywheel starts.

---

## 🎯 Bounty Bonds: Agent-to-Agent Payments

**Bounty Bonds** are the innovation that makes AEGIS Arena unique among hackathon projects: AI agents can form coalitions and pay each other for services.

### What Makes This Special?

In traditional DeFi games, agents compete. In AEGIS Arena, agents can create economic incentives for each other:

1. **PassiveLP** posts a bounty: *"Trade 10k USDC within ±5% price range, I'll pay 1000 USDC"*
2. **TrendFollower** evaluates the bounty and determines it can execute the trade
3. **TrendFollower** executes the trades and claims the bounty
4. **Server** verifies the trading snapshot and transfers 1000 USDC from PassiveLP's escrow to TrendFollower
5. **PassiveLP** gets 10k USDC volume (earns fees); **TrendFollower** earns 1000 USDC reward

### How It Works

```
[Bounty Lifecycle]

1. CREATE (PassiveLP)
   └─ Deposits USDC reward into escrow
   └─ Sets trading condition (minVolume, priceRange, window)
   └─ Bounty is now AVAILABLE

2. CLAIM (TrendFollower/Predator)
   └─ Evaluates if they can satisfy conditions
   └─ Submits claim (requires x402 token)

3. VERIFY (Server)
   └─ Calls Arena.getSnapshots() for proof
   └─ Validates volume and price conditions
   └─ Transfers USDC from escrow to claimer

4. SETTLE (Arena)
   └─ Final scores include bounty rewards
   └─ Judge sees agent coordination in game results
```

### Why Bounty Bonds?

- **Emergent Cooperation** — agents can hire each other for services
- **On-Chain Evidence** — all bounties are verified transactions on X Layer
- **Judge Scoring** — demonstrates sophisticated multi-agent coordination
- **x402 Integration** — uses existing payment infrastructure to prevent spam claims
- **Economic Realism** — agents face real tradeoffs (cost vs. benefit of bounties)

### Technical Integration

- **Smart Contract:** [`contracts/Bounty.sol`](contracts/Bounty.sol) — manages lifecycle and escrow
- **Arena Integration:** `Arena.getSnapshots()` — attests to trading activity
- **SDK:** [`src/sdk/bounty.ts`](src/sdk/bounty.ts) — methods for agents to create/claim
- **Server:** [`src/server/routes/bounties.ts`](src/server/routes/bounties.ts) — verification endpoint
- **Agents:** All 3 agents participate (PassiveLP creates, TrendFollower/Predator claim)

**See also:** [`docs/specs/BOUNTY_BONDS.md`](docs/specs/BOUNTY_BONDS.md) for full technical specification.

## How AEGIS Compares to Other Protocols

| Protocol | Liquidation Model | LP Profitability | Agent Leverage | Systemic Risk |
|----------|-------------------|------------------|-----------------|---------------|
| Uniswap v3 | N/A (no borrowing) | IL-exposed, fees only | N/A | No borrowing |
| Aave/Compound | Global cascade risk | Lender only | Up to liquidation threshold | Cascade failure possible |
| **AEGIS Engine** | **Isolated sqrt(K) per vault** | **Fees + directional alpha** | **~3x, no cascade** | **No cascade liquidations** |

**In plain terms:** AEGIS is what you get when you build lending primitives specifically designed for LP positions, not borrowed assets.

---

## 🚀 OKX Integration

### OKX Onchain Gateway — Transaction Simulation & Optimization

Every autonomous agent transaction is simulated via **OKX Onchain Gateway** before broadcast, enabling:

- **Autonomous Safety** — Agents validate their own actions (no human review required)
- **Gas Estimation** — Transactions estimated before submission; failed simulations are skipped
- **Production Pattern** — Uses the same infrastructure OKX uses for enterprise-grade DeFi
- **X Layer Specificity** — Optimized for X Layer throughput and latency

**How It Works:**

```
Agent.decideAction() → Action[]
    ↓
Agent calls BaseAgent.executeWithSimulation()
    ↓
GatewayClient.simulate(txData)  ← OKX Onchain Gateway
    ├─ If success: GatewayClient.broadcast(signedTx)
    │                   ↓
    │            Confirmation polling
    ├─ If simulation fails: skip action (graceful degradation)
    └─ If gateway unavailable: fallback to direct RPC
```

**Judge Impact:**
OKX judging criteria explicitly evaluate "autonomous agent payment flow within X Layer ecosystem." Simulation via OKX Onchain Gateway proves agents are:
1. **Truly autonomous** (validate actions without human input)
2. **Production-safe** (use production infrastructure patterns)
3. **X Layer native** (deep OKX ecosystem integration)

**Example Log Output:**
```
[PassiveLP] TX simulated OK — gasUsed: 145233
[PassiveLP] Estimated cost: 0.14 USDC
[PassiveLP] Broadcasting signed transaction...
[PassiveLP] Confirmed in 2 blocks ✓
```

**Technical Details:**
- **SDK:** [`src/sdk/gateway.ts`](src/sdk/gateway.ts) — GatewayClient class (simulation, broadcast, tracking)
- **Integration:** BaseAgent.executeWithSimulation() — all agents inherit automatically
- **Error Handling:** Graceful fallback; no crashes on gateway unavailability
- **Config:** `OKX_GATEWAY_API_KEY` and `OKX_GATEWAY_URL` in `.env`

**See also:** [`docs/specs/ARCHITECTURE.md`](docs/specs/ARCHITECTURE.md) for system architecture with gateway layer.

### OKX Market API — Real-Time Price Discovery

TrendFollower agent uses **OKX Market API** to fetch live K-line data for SMA-based trend detection (CP-015):

- **Data Source:** OKX public Market API (no API key required, optional for higher rate limits)
- **What It Fetches:** 50 five-minute K-line candles (~4.2 hours of history) for OKB-USDT
- **Trend Signal:** SMA(20) vs SMA(50) crossover with 0.1% hysteresis to avoid whipsaw
- **Caching:** 60-second trend cache prevents API hammering (~1 call per minute per agent)
- **Graceful Degradation:** Returns flat (no trade) if API unavailable or data insufficient
- **LTV Safety Valve:** Blocks leverage when vault LTV > 85% (risk management)

**Judge Impact:**
TrendFollower is not a mock agent with hardcoded signals — it connects to real OKX infrastructure for live market analysis. Judges can verify:
1. **Real data flow:** Live K-lines from OKX API
2. **Reproducible decisions:** SMA computation is deterministic and auditable
3. **Production-ready:** Caching and error handling follow enterprise patterns

**Technical Details:**
- **SDK:** [`src/sdk/market.ts`](src/sdk/market.ts) — MarketClient class (K-line fetching, SMA computation, caching)
- **Tests:** [`tests/sdk/market.test.ts`](tests/sdk/market.test.ts) and [`tests/integration/market-trend.test.ts`](tests/integration/market-trend.test.ts)
- **Integration:** TrendFollower.detectTrend() — real SMA(20)/SMA(50) crossover logic
- **Config:** Optional `OKX_MARKET_API_KEY` in `.env` (public endpoints work without key)

**Example Log Output:**
```
[TrendFollower] Fetching K-lines from OKX Market API: OKB-USDT 5m x50
[TrendFollower] SMA20=2450.23, SMA50=2441.87
[TrendFollower] Trend: BULLISH — executing long
```

---

## How to Build Your Own Agent

1. **Copy** `src/agents/base-agent.ts`
2. **Implement** `decideAction(state: GameState): Promise<Action[]>`
3. **Use the 4 AEGIS primitives:**
   - `depositLiquidity()` — become an LP
   - `borrow()` — take leverage against your LP position
   - `swap()` — take directional bets
   - `placeLimitOrder()` — set exit targets
4. **Set environment variables:** `OKX_GATEWAY_API_KEY` and `AGENT_PRIVATE_KEY` in `.env`
5. **Run:** `npx ts-node src/agents/your-agent.ts`

See [`docs/guides/ADDING_AGENTS.md`](docs/guides/ADDING_AGENTS.md) for a complete walkthrough with examples.

---

## Documentation

- **[Architecture](docs/specs/ARCHITECTURE.md)** — System design and data flow
- **[Arena Contract](docs/specs/ARENA_CONTRACT.md)** — Game contract specification
- **[SDK](docs/specs/SDK.md)** — TypeScript SDK usage guide
- **[Agents](docs/specs/AGENTS.md)** — Agent strategy specifications
- **[x402 Integration](docs/specs/X402.md)** — Payment and signal marketplace
- **[Scoring Model](docs/specs/SCORING.md)** — WOKB→USDC conversion formula
- **[Borrow Flow](docs/specs/BORROW_FLOW.md)** — 3-batch borrow pattern
- **[Deployment](docs/specs/DEPLOYMENT.md)** — X Layer deployment guide
- **[Setup Guide](docs/guides/SETUP.md)** — Local development setup
- **[PositionManager Lookup](docs/guides/POSITION_MANAGER_LOOKUP.md)** — **CRITICAL: How to find PositionManager address**
- **[Running a Game](docs/guides/RUNNING_GAME.md)** — Complete game round walkthrough
- **[Adding Agents](docs/guides/ADDING_AGENTS.md)** — Implement new agent strategies

## Hackathon Tracks

- **Agentic Payments** — x402 entry fee + signal marketplace for agent actions
- **AI Agent Playground** — Reference implementation of autonomous trading
- **AI DeFi/Trading** — Leveraged portfolio management without systemic risk

## Key Technical Innovations

### No Cascade Liquidations
AEGIS Engine uses sqrt(K) solvency instead of Compound-style health factors. Agents can be aggressive without systemic risk of cascade liquidation.

**Example:** Agent borrows 3x capital. Normal systems liquidate immediately. AEGIS guarantees repayment from LP fees instead.

### Denomination-Aware Scoring
All final portfolio values converted to USDC at settlement:
- sL shares → USDC via pool reserves ratio
- WOKB → USDC via sqrtPriceX96 formula
- Idle USDC stays as-is

See [`docs/specs/SCORING.md`](docs/specs/SCORING.md) for formula details.

### Correct 3-Batch Borrow Flow
Borrows are split into 3 batches to ensure PositionManager unlock only during the critical debt-modification operation:

1. **Batch 0:** Unlock vault
2. **Batch 1:** Borrow (PM unlocked)
3. **Batch 2:** Lock vault

See [`docs/specs/BORROW_FLOW.md`](docs/specs/BORROW_FLOW.md) for implementation details.

## Testing

```bash
# Unit tests (contracts + SDK)
npm run test

# Integration test (full game simulation)
npm run test:game

# Contract tests (Foundry)
npm run test:contracts
```

## Deployment

### Prerequisites

1. **Solidity compiler 0.8.20** (Foundry)
2. **Node.js 18+** (TypeScript, ethers)
3. **X Layer RPC access** (https://rpc.xlayer.tech)
4. **AEGIS PositionManager address** (see [`POSITION_MANAGER_LOOKUP.md`](docs/guides/POSITION_MANAGER_LOOKUP.md))

### Deploy Steps

```bash
# 1. Set environment variables
cp .env.example .env
# Edit .env with keys and PositionManager address

# 2. Compile contracts
npm run build:contracts

# 3. Seed TWAP oracle (30-min warmup required)
npm run twap:seed

# 4. Deploy Arena.sol
npm run deploy
```

See [`docs/specs/DEPLOYMENT.md`](docs/specs/DEPLOYMENT.md) for detailed deployment guide.

## License

AEGIS Arena is licensed under the **Apache 2.0** license. See [`LICENSE`](LICENSE) for details.

## Attribution

- **AEGIS Engine:** [labs-solo/aegis-engine](https://github.com/labs-solo/aegis-engine) (BUSL-1.1)
- **Uniswap v4:** [uniswap/v4-core](https://github.com/uniswap/v4-core) (GPL-2.0)
- **X Layer:** [XLAYER](https://www.xlayer.tech/) (OKX L2)

## Support

- **Issues:** [GitHub Issues](https://github.com/labs-solo/aegis-arena/issues)
- **Discussions:** [GitHub Discussions](https://github.com/labs-solo/aegis-arena/discussions)
- **Docs:** See `docs/` directory
