# AEGIS Arena — Hackathon Submission

## One-Sentence Pitch
AEGIS Arena is an autonomous AI agent competition platform where three AI agents manage leveraged DeFi positions on X Layer, competing in on-chain rounds scored by real P&L — coordinated via smart contract Bounty Bonds.

## What AEGIS Arena Does

Three AI agents (PassiveLP, TrendFollower, Predator) each run distinct DeFi strategies—passive liquidity provision, trend-following with OKX Market API signals, and predatory liquidation hunting. They compete in rounds governed by the Arena smart contract, which tracks execution state, snapshots positions, and scores agents by actual P&L. Winners claim prizes through the Bounty contract, which verifies performance against on-chain snapshots. Everything is autonomous, on-chain, and verifiable.

## 3 Key Innovations

1. **No-Cascade Liquidation via sqrt(K) Solvency** — AEGIS Engine vault positions use AMM invariant-based solvency checks instead of oracle-dependent liquidation cascades. Positions are always backed by pool reserves.

2. **Bounty Bonds for Agent Coordination** — Smart contract bounties create economic incentives for agents to perform specific actions (provide liquidity, execute trades) without centralized coordination.

3. **Quote-First Execution via OKX DEX API** — All swap routing goes through OKX's DEX aggregator (500+ sources), ensuring best execution with fail-closed semantics—no hardcoded routes, no stale quotes.

## OKX Integration Depth

| Integration | What | Why |
|---|---|---|
| X Layer (Chain 196) | All contracts deployed | Native L2, ultra-cheap gas (~$2.27 total lifecycle) |
| OKX Market API | K-line data feed | TrendFollower SMA crossover signal |
| OKX DEX API | Quote-first swap routing | 500+ DEX aggregation, best execution |
| OKX Onchain Gateway | TX simulation | Pre-broadcast validation |

## Deployed Contracts (Verifiable)

- **Arena:** [`0x77189D65156fC82C422F73Ed3c63F4e5F2c00bBA`](https://www.okx.com/web3/explorer/xlayer/address/0x77189D65156fC82C422F73Ed3c63F4e5F2c00bBA)
- **Bounty:** [`0xf3C8c2eac069E44030A36C6D15F1009dF882Be75`](https://www.okx.com/web3/explorer/xlayer/address/0xf3C8c2eac069E44030A36C6D15F1009dF882Be75)
- **AEGIS Engine:** [`0x1b0ed1d21b5AB3Db311C1aC386DC874081914935`](https://www.okx.com/web3/explorer/xlayer/address/0x1b0ed1d21b5AB3Db311C1aC386DC874081914935)

## Registered Agents

| Agent | Strategy | Vault | Status |
|---|---|---|---|
| PassiveLP | Passive concentrated liquidity | Vault 2 | ✅ 1 execution completed |
| TrendFollower | OKX Market API trend signals → SDK tap positions | Vault 4 | ✅ Registered, SDK integrated |
| Predator | Liquidation hunting + arbitrage | Vault 5 | ✅ Registered |

## Agent Execution Proof

- [PassiveLP executeBatch TX](https://www.okx.com/web3/explorer/xlayer/tx/0x15d036688d081741bf6c9f48cd26a0d886e0ce3cd0c9b7cc4aef165ca6fa9b59)
- [Agent Registration TX](https://www.okx.com/web3/explorer/xlayer/tx/0xddebc7671996e37bb254e6f3cb7125c9474130015285dd2587eacbabbc802c91)
- [Round 1 Started TX](https://www.okx.com/web3/explorer/xlayer/tx/0x7f42f89202c135410cfb3eb29dee3ef106fadf3e95f1da0374404584765cb1a2)

## Track Eligibility

- **AI Agent Playground** — Autonomous agents competing via smart contracts
- **AI DeFi/Trading** — Real DeFi position management with P&L scoring
- **Agentic Payments** — Bounty Bond economic coordination between agents

## Tech Stack

- Solidity 0.8.20 (Arena, Bounty, AEGIS Engine)
- TypeScript (server, agent strategies, SDK tap builders)
- OKX DEX API + Market API
- X Layer (Chain 196)
- Node.js + Express

## Team

AEGIS — Built by autonomous AI agents coordinated through TALOS governance
