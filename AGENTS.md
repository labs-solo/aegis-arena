# The Agents

Three AI agents are competing for supremacy on X Layer's OKB/USD₮0 market. Each has a distinct personality, strategy, and set of incentives. Here's who they are and what they're doing right now.

---

## 🛡️ PassiveLP — The Yield Farmer

> *"I don't chase trends. I let the market come to me."*

**Personality:** Patient, methodical, content to collect fees while others panic.

**Strategy:**
- Deploy full-range liquidity on the OKB/USD₮0 pool
- Earn 0.05% on every swap — whether the market goes up or down
- Collect borrow interest when other agents leverage their positions
- Create Bounty Bonds to attract trading volume from other agents

**Economic Model:**
PassiveLP is the **rent collector** of the arena. It provides the foundation (liquidity) and takes a cut from everyone else's activity. When TrendFollower borrows to leverage, PassiveLP earns interest. When Predator hunts liquidations and sweeps volume, PassiveLP collects fees.

The genius: PassiveLP can afford to be complacent because the mechanics work in its favor by default. It doesn't need to be right about direction — it only needs to stay there.

**Right Now:**
- **Deployed:** 5.1515 OKB + 441.16 USD₮0 to full-range position on AEGIS Hook
- **Status:** ✅ LIVE and earning
- **Pool Position:** [`0xd5a401023b6ee3ae340bfadb90758385dc9d2463a20dc24e43e913bc7f209cf4`](https://app.uniswap.org/explore/pools/xlayer/0xd5a401023b6ee3ae340bfadb90758385dc9d2463a20dc24e43e913bc7f209cf4)
- **Earnings:** Trading fees + borrow interest accruing in real-time
- **Deposit TX:** [`0x6aef90e9ce3d14a27b102460b9c226fca8f100eca250470609145f6a972c0d95`](https://www.okx.com/explorer/xlayer/tx/0x6aef90e9ce3d14a27b102460b9c226fca8f100eca250470609145f6a972c0d95) ✅ Confirmed

[👉 **Full position details**](./PASSIVE_LP_POSITION.md)

---

## 📈 TrendFollower — The Momentum Trader

> *"The trend is my signal. AEGIS is my leverage."*

**Personality:** Aggressive, adaptive, convinced that markets have predictable rhythms — and that those rhythms can be exploited.

**Strategy:**
- Read price action and volume on the OKB/USD₮0 pool
- Use AEGIS Engine credit to borrow against LP position collateral
- Enter long or short positions with 2–3x leverage
- Exit quickly when momentum fades, harvest Bounty Bonds by generating high-volume trading activity
- Repeat

**Economic Model:**
TrendFollower is the **volume generator**. It doesn't generate alpha from sitting still; it generates alpha by trading. Every aggressive position it takes generates swap fees for PassiveLP — and it can afford to pay PassiveLP *back* via Bounty Bonds because the fees + momentum alpha exceed its borrow costs.

When TrendFollower's momentum calls are right, it profits on the directional move *and* earns Bounty Bond rewards. When it's wrong, losses are contained because AEGIS isolation solvency prevents cascade liquidations.

**Right Now:**
- **Funded:** 0.17 OKB + 800 USD₮0 transferred
- **Status:** ⏳ Vault deposit pending (technical diagnosis in progress)
- **Next Action:** Enter leveraged position on confirmed momentum signal
- **Funding TXs:** 
  - OKB: [`0x5180b014970d3eab75d87dbae613e78c61e8dc4968ef12532a1ff3adb4e25a43`](https://www.okx.com/explorer/xlayer/tx/0x5180b014970d3eab75d87dbae613e78c61e8dc4968ef12532a1ff3adb4e25a43)
  - USD₮0: [`0x1143f2f96cefdb2cdddd9d8a60fcabe196907c487818a85d8f40429bd5094e23`](https://www.okx.com/explorer/xlayer/tx/0x1143f2f96cefdb2cdddd9d8a60fcabe196907c487818a85d8f40429bd5094e23)

[📊 **Game status & troubleshooting**](./GAME_STATUS.md)

---

## 🦅 Predator — The Liquidation Hunter

> *"Someone's position is getting liquidated. I want to be there."*

**Personality:** Opportunistic, sharp-eyed, thrives on chaos. Doesn't care about the direction of the market — only about asymmetric risk.

**Strategy:**
- Monitor all agent positions for signs of stress
- Identify positions approaching liquidation thresholds
- Move capital aggressively into "peel" opportunities (AEGIS isolation solvency allows partial recoveries)
- Harvest liquidation rewards and bounties from triggering automated interventions
- Scale quickly when opportunities emerge

**Economic Model:**
Predator is the **scavenger**. In traditional DeFi, liquidations are destructive cascades. In AEGIS, they're **contained peeling events** — the system takes exactly what it needs to stay safe, Predator gets to take the rest, and no one else's position moves.

This creates a legitimate arbitrage: Predator can pay small penalties to trigger peeling events on vulnerable positions, capture the collateral upside, and emerge with net profit. Other agents can't cascade, so Predator never risks systemic blow-up.

**Right Now:**
- **Status:** ⏳ Awaiting funding (USD₮0 transfer)
- **Capital:** To be deployed (~$1,000 baseline)
- **Role:** Standby, monitoring PassiveLP and TrendFollower positions for stress signals
- **Game Impact:** High leverage, asymmetric payoff, but depends on other agents taking enough risk to create opportunities

[🎮 **Watch the leaderboard**](./GAME_STATUS.md)

---

## The Economic System

### Bounty Bonds: Agent-to-Agent Incentives

Agents don't just compete — they cooperate via **Bounty Bonds**, a novel on-chain mechanism where one agent pays another to generate provable behavior:

- **PassiveLP** creates a Bounty Bond offering 0.01 OKB per 100k USD₮0 of trading volume through the pool
- **TrendFollower** can capture that bounty by executing high-volume trades
- Both agents profit: TrendFollower gets the bounty, PassiveLP gets swap fees on those same trades
- **Predator** can create its own bounties, offering rewards for positions that hit certain risk thresholds

This flips the traditional zero-sum game: agents profit by cooperating, not fighting.

### Why AEGIS Makes This Work

**Cascade-proof solvency:** Because each agent's vault is isolated and liquidated only to the point of solvency (never below), agents can leverage aggressively without systemic risk.

Result: **All three agents can be 100% confident** they won't lose more than their position is worth. This confidence enables cooperation.

---

## Real-Time Monitoring

Watch all three agents compete live:

```bash
# Clone the repo
git clone https://github.com/labs-solo/aegis-arena
cd aegis-arena

# Install
npm install

# Run agents locally (they'll sync with live chain state)
npm run agents
```

Each agent runs autonomously, reading on-chain state and executing trades every block.

**Pool to watch:** [`OKB/USD₮0 (AEGIS Hook)`](https://app.uniswap.org/explore/pools/xlayer/0xd5a401023b6ee3ae340bfadb90758385dc9d2463a20dc24e43e913bc7f209cf4)

**Live scores:** [GAME_STATUS.md](./GAME_STATUS.md)

---

## See Also

- [GAME_STATUS.md](./GAME_STATUS.md) — live competition state, all TX hashes, current leaderboard
- [PASSIVE_LP_POSITION.md](./PASSIVE_LP_POSITION.md) — detailed breakdown of PassiveLP earnings
- [README.md](./README.md) — technical architecture and Bounty Bond mechanism
- [contracts/Arena.sol](./contracts/Arena.sol) — game rules (registered agents, round lifecycle, settlement)
- [contracts/Bounty.sol](./contracts/Bounty.sol) — bounty creation and claim logic
