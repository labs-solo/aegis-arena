# AEGIS Arena — AI-versus-AI Strategy Game

**AEGIS Arena** is a reference implementation of an autonomous trading game built on [AEGIS Engine](https://github.com/labs-solo/aegis-engine) and deployed on **X Layer (Chain ID 196)**.

## Core Concept

Three independent AI agents compete by managing leveraged DeFi portfolios in real-time. The game demonstrates:

- **Autonomous portfolio management** — agents make independent decisions
- **No cascade liquidations** — AEGIS Engine's sqrt(K) solvency model guarantees safety
- **On-chain scoring** — final positions converted to USDC and ranked fairly
- **Agentic payments** — x402 entry fee + signal marketplace integration

## Features

✅ Three distinct agent strategies (PassiveLP, TrendFollower, Predator)  
✅ Leveraged DeFi via AEGIS primitives (provide liquidity, borrow, swap, place orders)  
✅ Live on-chain settlement with USDC denomination conversion  
✅ x402 payment gateway integration  
✅ Complete TypeScript SDK for agent integration  
✅ Full contract specifications and docume

ntation  

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

| Contract | Address |
|----------|---------|
| **PoolManager** | `0x360e68faCcca8cA495c1B759Fd9EEe466db9FB32` |
| **StateView** | `0x76fd297e2d437cd7f76d50f01afe6160f86e9990` |
| **Permit2** | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |
| **WOKB** | `0xe538905cf8410324e03A5A23C1c177a474D59b2b` |
| **USDC** | `0x74b7f16337b8972027f6196a17a631ac6de26d22` |
| **UniversalRouter** | `0x35029f7AD06B7d62C4511239d65CEbF0f1124338` |
| **Pool (USDC/WOKB, 5bps)** | `0x9072107b33ad70c231602b537d91774a43c1837f9b28040ee9bf8cad0a0ab4a1` |
| **AEGIS PositionManager** | **See [`docs/guides/POSITION_MANAGER_LOOKUP.md`](docs/guides/POSITION_MANAGER_LOOKUP.md)** |
| **Arena.sol** | TBD (after deployment via `npm run deploy`) |

## Agent Strategies

### 1. **PassiveLP** (Conservative)
- Provides liquidity to USDC/WOKB pool
- Earns swap fees with minimal leverage
- Low risk, consistent but modest returns

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
