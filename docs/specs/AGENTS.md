# Agent Strategies

## Overview

Three AI agents compete with distinct strategies:
1. **PassiveLP** — Conservative, fee farming
2. **TrendFollower** — Aggressive, leveraged trading
3. **Predator** — Market-neutral, volatility arbitrage

Each agent inherits from `BaseAgent` and implements the `decideAction()` method.

---

## Agent 1: PassiveLP

### Strategy
Provide liquidity and earn trading fees, with minimal leverage.

### Profile
- **Risk Level:** Low
- **Leverage:** 0–1x (no borrowing)
- **Target Return:** ≥10%
- **Success Metric:** Accumulate fees consistently

### Implementation

```typescript
class AgentPassiveLP extends BaseAgent {
  async decideAction(state: GameState): Promise<Action[]> {
    const liquidityAmount = this.initialAllocation / 2n;  // 50% deployed

    // Provide liquidity to USDC/WOKB pool
    return [
      {
        opcode: OPCODES.AE_MODIFY_LIQUIDITY,
        params: [
          { type: "bytes32", value: this.vaultId },
          { type: "int128", value: liquidityAmount },
          { type: "address", value: this.agentAddress },
          { type: "uint256", value: 0n },
          { type: "int24", value: -887272 },    // Full range
          { type: "int24", value: 887272 },
        ],
      },
    ];
  }
}
```

### Actions
- **Primary:** `AE_MODIFY_LIQUIDITY` (provide full-range liquidity)
- **Secondary:** Hold idle USDC (50% stays in vault as USDC)
- **Leverage:** No `AE_MODIFY_DEBT` calls

### Why It Works
- Captures swap fees passively (no active management)
- Full-range liquidity ensures fee capture across price range
- Idle USDC provides buffer against adverse price moves
- No liquidation risk (no debt)

### Bounty Integration: Creator Strategy

PassiveLP creates bounties when excess liquidity is idle:

```typescript
// In performAction():
const idleUsdc = await this.getIdleUsdcBalance();
const bountyThreshold = 5000n * 10n ** 6n;

if (idleUsdc > bountyThreshold) {
  // Create bounty to attract trading volume
  const bountyReward = 1000n * 10n ** 6n;
  const condition: BountyCondition = {
    minVolumeUsdc: 10000n * 10n ** 6n,
    targetPriceMin: 950000000n,
    targetPriceMax: 1050000000n,
    windowBlocks: 100n,
  };

  try {
    const bountyId = await createBounty(
      this.arenaClient,
      roundId,
      bountyReward,
      condition
    );
    console.log(`[PassiveLP] Created bounty ${bountyId} with reward ${bountyReward}`);
  } catch (error) {
    console.error("[PassiveLP] Failed to create bounty:", error);
    // Don't fail the round
  }
}
```

**Outcome:** PassiveLP trades bounty cost for fee revenue from trading volume. Incentivizes other agents to trade on its pool.

### Example Results
```
Initial capital: 100 USDC
After 1 hour:
  - sL shares accumulated: 1000 shares
  - Fees earned: ~5 USDC (0.5M volume × 5 bps × 50% LP participation)
  - Final score: ~105 USDC ✓ (meets 10% target)
```

---

## Agent 2: TrendFollower

### Strategy
Detect price trends, borrow capital via AEGIS, and take leveraged directional bets.

### Profile
- **Risk Level:** High
- **Leverage:** Up to 3x (using AEGIS sqrt(K) solvency)
- **Target Return:** ≥20% (higher risk)
- **Success Metric:** Profitable bets despite aggressive leverage

### Implementation

```typescript
class AgentTrendFollower extends BaseAgent {
  async decideAction(state: GameState): Promise<Action[]> {
    const trend = await this.detectTrend(state);

    if (trend > 0) {
      // Uptrend: borrow and go long WOKB
      const borrowAmount = this.initialAllocation;  // 1x leverage

      return [
        {
          opcode: OPCODES.SWAP_EXACT_IN_SINGLE,
          params: [
            { type: "bytes32", value: KNOWN_ADDRESSES.LIVE_POOL_ID },
            { type: "address", value: KNOWN_ADDRESSES.USDC },
            { type: "address", value: KNOWN_ADDRESSES.WOKB },
            { type: "uint256", value: borrowAmount },
            { type: "uint256", value: 0n },
          ],
        },
      ];
    }

    return [];
  }

  private async detectTrend(state: GameState): Promise<number> {
    // Compare current price to moving average
    // Return: 1 (up), -1 (down), 0 (sideways)
    return 0;  // Stub
  }
}
```

### Actions
1. **Borrow:** `AE_MODIFY_DEBT` (3-batch pattern)
   - Batch 0: Unlock vault
   - Batch 1: Borrow capital (PM unlocked)
   - Batch 2: Lock vault

2. **Trade:** `SWAP_EXACT_IN_SINGLE`
   - Deploy borrowed capital on trend

3. **Close:** `PM_TAKE` (limit orders)
   - Close position when profit target or stop-loss hit

### Why It Works
- Leverages AEGIS sqrt(K) solvency: no cascade liquidations even at 3x
- Trend detection allows profitable directional bets
- 3-batch borrow pattern ensures PositionManager unlock only when needed
- Handles both uptrends and downtrends

### Bounty Integration: Claiming Strategy

TrendFollower evaluates and claims bounties when conditions align:

```typescript
// In performAction():
const activeBounties = await getRoundBounties(this.arenaClient, roundId);

for (const bountyId of activeBounties) {
  const bounty = await getBounty(this.arenaClient, bountyId);
  if (!bounty || bounty.claimed) continue;

  // Evaluate if we can satisfy this bounty's conditions
  if (this.canSatisfyBountyCondition(bounty.condition)) {
    try {
      await claimBounty(this.arenaClient, bountyId);
      console.log(
        `[TrendFollower] Claimed bounty ${bountyId} ` +
        `(reward=${bounty.rewardAmount}, minVolume=${bounty.condition.minVolumeUsdc})`
      );
    } catch (error) {
      console.error(`[TrendFollower] Failed to claim bounty ${bountyId}:`, error);
    }
  }
}

private canSatisfyBountyCondition(condition: BountyCondition): boolean {
  // TrendFollower estimates: can execute 15k USDC in trades
  const estimatedVolume = 15000n * 10n ** 6n;
  
  // Price range should be permissive (±5%)
  const priceRangeOk = 
    condition.targetPriceMax - condition.targetPriceMin <= 1000000000n;
  
  return (
    estimatedVolume >= condition.minVolumeUsdc &&
    priceRangeOk
  );
}
```

**Outcome:** Executes directional trades that satisfy bounty conditions; supplements trading returns with bounty rewards.

### Risk/Return Profile
```
Scenario 1: Correct trend, 10% price move
  Initial: 100 USDC
  Borrow: 100 USDC
  Swap: 200 USDC → 200 WOKB (at 1 WOKB = 1 USDC)
  Price move: +10% → 200 WOKB = 220 USDC
  Repay: 100 USDC
  Final: 220 - 100 = 120 USDC ✓ (20% return)

Scenario 2: Wrong trend, 10% adverse move
  Final: 200 WOKB = 180 USDC
  Repay: 100 USDC
  Final: 180 - 100 = 80 USDC ✗ (20% loss)
  BUT: No cascade liquidation (AEGIS guarantee)
```

---

## Agent 3: Predator

### Strategy
Maintain delta-neutral (balanced long/short) positions, profit from volatility and fees.

### Profile
- **Risk Level:** Medium
- **Leverage:** 1–2x (balanced positions)
- **Target Return:** ≥5% (lower but more stable)
- **Success Metric:** Consistent returns independent of direction

### Implementation

```typescript
class AgentPredator extends BaseAgent {
  async decideAction(state: GameState): Promise<Action[]> {
    const deployAmount = this.initialAllocation * 3n / 2n;  // 1.5x total

    // Provide concentrated liquidity around current price
    const centerTick = await this.getCurrentTick(state);

    return [
      {
        opcode: OPCODES.AE_MODIFY_LIQUIDITY,
        params: [
          { type: "bytes32", value: this.vaultId },
          { type: "int128", value: deployAmount },
          { type: "address", value: this.agentAddress },
          { type: "uint256", value: 0n },
          { type: "int24", value: centerTick - 100 },   // Concentrated
          { type: "int24", value: centerTick + 100 },
        ],
      },
    ];
  }

  private calculateDelta(state: GameState): bigint {
    // Sum all long/short positions
    // Return 0 if perfectly neutral
    return 0n;
  }
}
```

### Actions
1. **Borrow:** `AE_MODIFY_DEBT` (1x leverage = 1.5x total capital)
2. **Deploy:** `AE_MODIFY_LIQUIDITY` (concentrated range)
   - Captures more fees in active price range
   - Rebalances if delta drifts too far
3. **Monitor:** Calculate delta, rebalance if needed

### Why It Works
- **Delta-neutral:** Long WOKB + short USDC debt = market-neutral
- **Concentrated liquidity:** Higher fee per $ deployed
- **Rebalancing:** Locks in gains when delta drifts
- **Stable:** Profits from volatility even if price doesn't move

### Bounty Integration: Conservative Claiming

Predator claims bounties only when price constraints match delta-neutral strategy:

```typescript
// In performAction():
const activeBounties = await getRoundBounties(this.arenaClient, roundId);

for (const bountyId of activeBounties) {
  const bounty = await getBounty(this.arenaClient, bountyId);
  if (!bounty || bounty.claimed) continue;

  // More conservative than TrendFollower
  if (this.canSatisfyBountyCondition(bounty.condition)) {
    try {
      await claimBounty(this.arenaClient, bountyId);
      console.log(
        `[Predator] Claimed bounty ${bountyId} ` +
        `(reward=${bounty.rewardAmount})`
      );
    } catch (error) {
      console.error(`[Predator] Failed to claim bounty ${bountyId}:`, error);
    }
  }
}

private canSatisfyBountyCondition(condition: BountyCondition): boolean {
  // Predator estimates: can execute 8k USDC (conservative)
  const estimatedVolume = 8000n * 10n ** 6n;
  
  // Requires tight price range (±2%), compatible with hedging
  const priceRangeOk = 
    condition.targetPriceMax - condition.targetPriceMin <= 200000000n;
  
  return (
    estimatedVolume >= condition.minVolumeUsdc &&
    priceRangeOk
  );
}
```

**Outcome:** Claims bounties with tight price constraints (compatible with delta-neutral hedging); supplements volatility harvesting returns with bounty rewards.

### Example Results
```
Initial capital: 100 USDC
Borrow: 50 USDC (1.5x total = 150 USDC)
Provide: 150 USDC as concentrated liquidity

24-hour swaps: 10M volume through pool
Fees earned: 10M × 5 bps × (150 / pool_total_liquidity) ≈ 5–10 USDC
Final: 105–110 USDC ✓ (meets 5% target)
```

---

## Comparison

| Metric | PassiveLP | TrendFollower | Predator |
|--------|-----------|---------------|----------|
| **Risk** | Low | High | Medium |
| **Leverage** | 0–1x | 0–3x | 1–2x |
| **Actions** | `MODIFY_LIQUIDITY` | `MODIFY_DEBT`, `SWAP`, `PM_TAKE` | `MODIFY_DEBT`, `MODIFY_LIQUIDITY` |
| **Return Target** | ≥10% | ≥20% | ≥5% |
| **Complexity** | Low | High | Medium |
| **Liquidation Risk** | None | None (AEGIS) | None (AEGIS) |

---

## Game Flow Example

**Initial setup:**
- Prize pool: 1000 USDC
- Initial allocation per agent: 100 USDC
- Round duration: 1 hour

**Round execution:**
1. **T=0min:** Agents register, vaults created
2. **T=1min:** Round starts
   - PassiveLP: deposits 50 USDC as liquidity
   - TrendFollower: detects uptrend, borrows 100 USDC, buys WOKB
   - Predator: borrows 50 USDC, provides 150 USDC as concentrated liquidity
3. **T=5min:** Swaps flow through pool
   - PassiveLP earns: ~0.2 USDC in fees
   - TrendFollower: WOKB position up 2%
   - Predator: earning fees, delta neutral
4. **T=30min:** Price moves up 5%
   - PassiveLP: fees accumulate
   - TrendFollower: 10% profit on position (2x leverage)
   - Predator: rebalances to stay neutral
5. **T=59min:** Round end approaching
   - All agents close active positions
6. **T=60min:** Round ends
   - Arena.settle() computes final scores in USDC
   - Prizes distributed

**Final scores:**
```
PassiveLP:      105 USDC (5% return)
TrendFollower:  120 USDC (20% return) — WINNER
Predator:       108 USDC (8% return)

Prize distribution:
  TrendFollower: 501 USDC (500 + 1 dust)
  Predator:      250 USDC
  PassiveLP:     249 USDC
```

---

## Extending: Custom Agents

To implement a custom agent:

```typescript
import { BaseAgent, GameState, Action } from "aegis-arena/sdk";

export class MyCustomAgent extends BaseAgent {
  async decideAction(state: GameState): Promise<Action[]> {
    const actions: Action[] = [];

    // Implement your strategy:
    // 1. Read current game state
    // 2. Decide what to do
    // 3. Return array of actions

    return actions;
  }
}
```

See `docs/guides/ADDING_AGENTS.md` for detailed guide.

