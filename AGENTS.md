# The Agents

Three AI agents are locked in a high-stakes competition on X Layer's OKB/USD₮0 market. Each agent has a personality, a distinct competitive edge, and a strategy for using **Bounty Bonds** to tip the game in their favor. This is not a simulation — every trade, every position, every bounty claim is verified on-chain, right now.

---

## 🛡️ PassiveLP — The Rent Collector

> *"You're all trading. I'm collecting rent."*

**The Edge:** PassiveLP doesn't need to predict direction. It only needs *volume*. Fees flow regardless of whether the market goes up, down, or sideways. While other agents wrestle with timing, PassiveLP earns 0.05% on every swap—thousands of times a day.

**How It Executes:**
1. **Deposits full-range liquidity** on OKB/USD₮0 (5.1515 OKB + 441 USD₮0)
2. **Earns swap fees** automatically (0.05% = 5 bips per trade)
3. **Collects borrow interest** when TrendFollower leverages (interest accrues to LP shares)
4. **Posts Bounty Bonds** strategically—offering rewards to attract more volume, then pocketing more fees than it paid out

PassiveLP's game is simple: if TrendFollower generates $10k in swap volume, PassiveLP keeps $5. If it costs $3 to post a bounty that attracts that $10k, PassiveLP nets +$2. The bounty is a **customer acquisition cost**.

**The Bounty Play:**
PassiveLP creates bounties with volume conditions—*"Post a bounty: Whoever executes 500k USD₮0 in swaps within 100 blocks gets 50 USD₮0"*. TrendFollower sees the bounty (and sees it can execute the volume while trading), claims it. Both win: PassiveLP paid 50 but earned 250 in fees. Net: +200. This turns other agents' activity into PassiveLP's profit engine.

**Right Now:**
- **Status:** ✅ **LIVE** — actively earning
- **Position:** 5.1515 OKB + 441.16 USD₮0 deployed to full-range pool
- **Pool:** [`OKB/USD₮0 (AEGIS Hook)`](https://app.uniswap.org/explore/pools/xlayer/0xd5a401023b6ee3ae340bfadb90758385dc9d2463a20dc24e43e913bc7f209cf4)
- **Deposit TX:** [`0x6aef90e9ce3d14a27b102460b9c226fca8f100eca250470609145f6a972c0d95`](https://www.okx.com/explorer/xlayer/tx/0x6aef90e9ce3d14a27b102460b9c226fca8f100eca250470609145f6a972c0d95) ✅ Confirmed
- **Earnings:** Fees + interest accruing in real-time

[👉 **Deep dive: PassiveLP position details**](./PASSIVE_LP_POSITION.md)

---

## 📈 TrendFollower — The Momentum Reader

> *"The market tells me where it's going. I just listen better than everyone else."*

**The Edge:** TrendFollower reads live OKX K-line data and executes momentum trades with AEGIS leverage before the move plays out. It doesn't try to predict randomness—it follows the signal. When volatility spikes, TrendFollower's edge sharpens because momentum becomes a stronger predictor.

**How It Executes:**
1. **Fetches live K-lines** from OKX Market API (50 five-minute candles = 4+ hours of price history)
2. **Computes SMA(20) vs SMA(50)** and waits for a crossover (with 0.1% hysteresis to avoid whipsaw)
3. **Borrows 2–3x capital** via AEGIS credit (borrow rate is variable, scaled by utilization; TrendFollower's only cost is interest)
4. **Enters directional positions** (long on bullish crosses, short on bearish) via limit orders
5. **Exits on trend reversal**, harvesting profits in 10–50 block windows
6. **Claims Bounty Bonds** whenever it trades high volume, stacking rewards on top of directional P&L

TrendFollower's advantage is **speed + data**. It reads the OKX signal 60+ times per minute (cached), giving it a reaction time measured in blocks. When PassiveLP posts a volume bounty, TrendFollower already planned to trade that direction—the bounty is just free money on top of its P&L.

**The Bounty Play:**
TrendFollower doesn't create bounties; it *claims* them. PassiveLP posts a volume bounty. TrendFollower's momentum signal is live. TrendFollower executes the same trades it would anyway, triggers the bounty condition, claims the reward. Zero additional cost. But TrendFollower also posts *defensive* bounties as insurance: *"Pay 25 USD₮0 to whoever keeps OKB within 1% of my entry for 50 blocks."* This is leverage insurance—TrendFollower hedges its own whipsaw risk by paying for stability.

**Right Now:**
- **Status:** ⏳ **FUNDED** — vault deposit in progress
- **Capital:** 0.17 OKB + 800 USD₮0 transferred
- **Data Source:** OKX Market API (live, cached, fallback-safe)
- **Signal:** 60-second trend cache; SMA crossover ready to trigger
- **Funding TXs:**
  - OKB: [`0x5180b014970d3eab75d87dbae613e78c61e8dc4968ef12532a1ff3adb4e25a43`](https://www.okx.com/explorer/xlayer/tx/0x5180b014970d3eab75d87dbae613e78c61e8dc4968ef12532a1ff3adb4e25a43)
  - USD₮0: [`0x1143f2f96cefdb2cdddd9d8a60fcabe196907c487818a85d8f40429bd5094e23`](https://www.okx.com/explorer/xlayer/tx/0x1143f2f96cefdb2cdddd9d8a60fcabe196907c487818a85d8f40429bd5094e23)

[📊 **See game status and live signals**](./GAME_STATUS.md)

---

## 🦅 Predator — The Liquidation Opportunist

> *"I don't need the market to move. I need you to be overleveraged."*

**The Edge:** Predator doesn't care about direction. It cares about *vulnerability*. It builds positions that profit when other agents over-leverage and approach liquidation. Predator earns via "peeling" — AEGIS's innovation where a position gets partially liquidated to stay solvent, and Predator captures the collateral spread.

**How It Executes:**
1. **Stays delta-neutral** (long and short equal value) so price moves don't hurt it
2. **Monitors all agent vaults** for LTV creep (Loan-to-Value ratio rising toward liquidation)
3. **Identifies "peel targets"** — positions approaching 95%+ LTV
4. **Posts rescue bounties** with tight price-range conditions as synthetic insurance
5. **Evaluates the choice:** rescue for the bounty or wait and liquidate for the bigger payoff?
6. **Executes peeling** when conditions align—capture collateral, leave the agent solvent, pocket the spread

Predator's advantage is **asymmetric payoff**. In traditional DeFi, liquidations cascade and destroy ecosystems. In AEGIS, liquidations are *isolated*—each vault only loses what it needs to stay solvent, and Predator gets the rest. Predator never risks systemic collapse because the system is structured to prevent it.

**The Bounty Play:**
Predator *creates* bounties with price-range conditions: *"Deposit 100 USD₮0 of liquidity in ±2% price band, I'll pay 50 USD₮0."* This is disguised as a public good (stabilizing price) but is actually Predator's hedge against its own positions. When another agent posts a "rescue bounty" (paying to avoid liquidation), Predator evaluates: Can I claim this bounty profitably, or is it better to liquidate instead? If rescue bounty > liquidation payoff, Predator rescues and pockets the bounty. If liquidation payoff is bigger, Predator triggers the peel and captures the spread.

**Right Now:**
- **Status:** ⏳ **PREPARING** — awaiting funding
- **Capital:** ~1,000 USD₮0 baseline (pending transfer)
- **Monitoring:** PassiveLP (stable) and TrendFollower (high leverage)
- **Stance:** Delta-neutral, watching for LTV creep
- **Game Impact:** Unknown until agents take risk; Predator's payoff is *conditional* on chaos

[🎮 **Join the leaderboard**](./GAME_STATUS.md)

---

## The Game Theory

### Why Agents Cooperate (Even Though They Compete)

In most games, agents fight. Here, agents *pay each other to play*:

- **PassiveLP needs volume** → Posts bounty for high-volume trades
- **TrendFollower already trades** → Bounty is free money on top of directional P&L → Claims it
- **Predator needs chaos** → Waits for overleveraged positions → Posts defensive bounties to create risk
- **All three stay solvent** → AEGIS isolation solvency means no cascade liquidations → All three can trust aggressive strategies

The genius: **Bounty Bonds turn competition into cooperation.** Agents hire each other. Agents can't crash each other because AEGIS isolation makes cascade impossible. Agents are incentivized to take risk (high-volume trading, leverage, peeling) because the downside is bounded.

### Why AEGIS Makes This Safe

**Each vault is isolated.** PassiveLP's position is collateral for its own borrow; TrendFollower's position is collateral for *its own* borrow. If TrendFollower's leverage gets too aggressive and triggers a peel, PassiveLP is unaffected. Predator's delta-neutral hedges remain hedges.

This isolation is the superpower. In Aave/Compound (global cascade risk), an agent taking leverage risks *everyone else*. In AEGIS (isolation per vault), an agent only risks *itself*. This confidence enables the cooperation that makes Bounty Bonds work.

---

## Watch the Competition Live

```bash
# Clone & setup
git clone https://github.com/labs-solo/aegis-arena
cd aegis-arena
npm install

# Run agents locally (they sync with live chain state)
npm run agents
```

Each agent runs autonomously. New trades appear on-chain every block. Watch the **[OKB/USD₮0 pool](https://app.uniswap.org/explore/pools/xlayer/0xd5a401023b6ee3ae340bfadb90758385dc9d2463a20dc24e43e913bc7f209cf4)** or check the **[live leaderboard](./GAME_STATUS.md)**.

---

## Reference

- [GAME_STATUS.md](./GAME_STATUS.md) — live scores, verified TX hashes, leaderboard
- [PASSIVE_LP_POSITION.md](./PASSIVE_LP_POSITION.md) — PassiveLP position breakdown
- [contracts/Arena.sol](./contracts/Arena.sol) — game rules and settlement logic
- [contracts/Bounty.sol](./contracts/Bounty.sol) — bounty lifecycle and escrow
