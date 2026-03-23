# Seer Bets — Post-Hackathon Roadmap

**Status:** Specification (Phase 2, post-hackathon)  
**Timeline:** 4-8 weeks after hackathon completion  
**Feasibility:** 5/10 for 48-hour hackathon (deferred due to complexity)

---

## Overview

**Seer Bets** is a prediction futures market where AEGIS Arena agents trade outcomes of other agents' on-chain behavior. Agents mint, buy, sell, and settle prediction tokens on Arena events.

Example:
- PassiveLP mints: "TrendFollower LP volume > 50k USDC in Round 5" → trades at 0.72 probability
- Predator buys 100 tokens at 0.72 probability
- If TrendFollower hits the volume target, tokens settle at 1.0 (Predator profits)
- If not, tokens settle at 0.0 (PassiveLP profits)

---

## Why Post-Hackathon?

### Complexity
- **Commit-reveal cycle:** Agents must commit predictions without front-running
- **Oracle settlement:** Requires trusted source of execution data or on-chain verification
- **Atomic settlement:** Multiple predictions settling in same tx requires careful ordering

### Time Constraint
- Hackathon is 48 hours
- Bounty Bonds deliver immediate value (agent-to-agent payments) with clear scope
- Seer Bets would consume 20+ hours of the 48-hour window with uncertain payoff

### Deferral Strategy
- **Hackathon focus:** Bounty Bonds (foundation, judge points)
- **Post-hackathon focus:** Seer Bets (sophistication, roadmap signal)
- **Integration:** Seer Bets can settle on Bounty Bonds events (composable)

---

## Design (High-Level)

### Prediction Market Contract (FuturesMarket.sol)

```solidity
// @title FuturesMarket
// @notice Prediction futures on AEGIS Arena agent behavior
contract FuturesMarket {
  
  struct Prediction {
    uint256 predictionId;
    address creator;          // Agent that minted
    bytes32 outcomeHash;      // Hash of prediction params
    uint256 expiresAt;        // Block when settlement window opens
    uint256 probability;      // Initial probability (0-100%)
    bool settled;
    uint256 settlement;       // Final settlement value (0-100%)
  }

  struct PredictionTokens {
    uint256 balanceYes;       // Tokens if outcome is YES
    uint256 balanceNo;        // Tokens if outcome is NO
    uint256 priceCurve;       // AMM curve parameter (Uniswap-style)
  }

  // Mint prediction tokens
  function mintPrediction(
    bytes32 outcomeHash,
    uint256 expiresAt,
    uint256 initialProbability
  ) external returns (uint256 predictionId);

  // Trade via automated market maker (buy YES or NO tokens)
  function trade(
    uint256 predictionId,
    bool buyYes,              // true=buy YES tokens, false=buy NO tokens
    uint256 tokenAmount,
    uint256 maxPrice           // Max price willing to pay
  ) external returns (uint256 costUsdc);

  // Settle prediction when outcome is known
  function settle(
    uint256 predictionId,
    uint256 settlementValue,   // 0-100%
    bytes calldata proof       // Evidence from Arena
  ) external;

  // Redeem settled tokens for USDC
  function redeem(
    uint256 predictionId,
    uint256 tokenAmount
  ) external returns (uint256 usdcOut);
}
```

### Settlement via Arena Snapshots

Seer Bets leverage the Arena.getSnapshots() method from Bounty Bonds:

```solidity
// Example: predict agent volume
function settlePredictionVolume(
  uint256 predictionId,
  uint256 roundId,
  address targetAgent,
  uint256 volumeThreshold
) external {
  (uint256 volume, , , ) = Arena.getSnapshots(roundId, targetAgent);
  
  uint256 settlementValue = volume >= volumeThreshold ? 100 : 0;
  settle(predictionId, settlementValue, abi.encode(volume));
}
```

### Supported Predictions

Phase 2 v1:
- Agent total volume (USDC) in round
- Agent average execution price (sqrtPriceX96)
- Agent final score (USDC equivalent)
- Agent wins round (binary: top 3 agents)

Phase 2 v2 (later):
- Bounty bonds created/claimed (composable with CP-013)
- Multi-agent outcomes (coalition predictions)
- Negative predictions (e.g., "X does NOT win")

---

## Architecture

### System Diagram
```
┌──────────────────────────────────────┐
│  AI Agents (create/trade/settle)    │
└──────────────┬───────────────────────┘
               │
               ▼
     ┌─────────────────────┐
     │ FuturesMarket.sol   │ ← Mint, trade, settle
     └─────────┬───────────┘
               │
               ▼
     ┌─────────────────────┐
     │ Arena.getSnapshots()│ ← Settlement evidence
     └─────────┬───────────┘
               │
               ▼
     ┌─────────────────────┐
     │  X Layer (RPC)      │
     └─────────────────────┘
```

### SDK Methods (New)

```typescript
// Create prediction
export async function mintPrediction(
  client: ArenaClient,
  outcomeHash: string,
  expiresAt: bigint,
  initialProbability: number
): Promise<bigint>;

// Trade tokens
export async function tradeTokens(
  client: ArenaClient,
  predictionId: bigint,
  buyYes: boolean,
  tokenAmount: bigint,
  maxPrice: bigint
): Promise<bigint>; // costUsdc

// Settle with proof
export async function settlePrediction(
  client: ArenaClient,
  predictionId: bigint,
  settlementValue: number, // 0-100
  proof: string
): Promise<void>;

// Redeem tokens for USDC
export async function redeemTokens(
  client: ArenaClient,
  predictionId: bigint,
  tokenAmount: bigint
): Promise<bigint>; // usdcOut
```

### Agent Integration

```typescript
// PassiveLP: mint bullish predictions on TrendFollower volume
async performAction(roundId: bigint) {
  const predictionId = await mintPrediction(
    client,
    keccak256(abi.encode({
      type: 'AGENT_VOLUME',
      roundId,
      agent: trendFollowerAddr,
      threshold: 50000n * 10n ** 6n  // 50k USDC
    })),
    expiresAtBlock,
    75  // 75% probability
  );
  
  // PassiveLP believes TrendFollower will trade > 50k USDC
  // If correct, PassiveLP redeems 75% of YES tokens
}

// Predator: trade bearish on TrendFollower
async performAction(roundId: bigint) {
  const prediction = await getPrediction(client, predictionId);
  
  // Predator disagrees; buys NO tokens cheap
  const cost = await tradeTokens(
    client,
    predictionId,
    false, // buyYes=false (NO tokens)
    1000n * 10n ** 6n, // 1k tokens
    0.25n * 10n ** 6n  // willing to pay 0.25 USDC per NO token
  );
}
```

---

## Roadmap Timeline

### Phase 2a: FuturesMarket.sol (2 weeks)
- Implement mint, trade, settle, redeem
- Add AMM pricing curve (Uniswap v4 style)
- Integrate Arena.getSnapshots() for settlement

### Phase 2b: SDK & Agent Integration (1 week)
- Export SDK methods
- Add prediction creation/trading to agents
- E2E test: mint → trade → settle → redeem

### Phase 2c: Security & Hardening (1 week)
- Audit FuturesMarket.sol (oracle risk, AMM safety)
- Fuzz test price curve under extreme trading volumes
- Operational runbook for settlement

### Phase 2d: Launch (Post-Hardening)
- Deploy to X Layer mainnet
- Enable agents to trade in live round
- Monitor price discovery and settlement accuracy

---

## Composability with Bounty Bonds (CP-013)

Seer Bets and Bounty Bonds can interact:

```typescript
// Example: Predict bounty claim
const predictionId = await mintPrediction(
  client,
  keccak256(abi.encode({
    type: 'BOUNTY_CLAIM',
    bountyId,
    expectedClaimer: trendFollowerAddr
  })),
  expiresAtBlock,
  60  // 60% probability claim succeeds
);

// Settlement via Bounty event listener
Bounty.on('BountyVerified', async (bountyId, claimer) => {
  if (claimer === expectedClaimer) {
    await settlePrediction(client, predictionId, 100, proof);
  } else {
    await settlePrediction(client, predictionId, 0, proof);
  }
});
```

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Oracle manipulation (fake settlement proof) | Require Arena.getSnapshots() call; no external oracle |
| Price curve DoS (massive single trade) | Limit order size; use bonding curve bounds |
| Settlement delay (agents can't redeem) | Auto-settle after timeout; manual settlement fallback |
| Prediction spam (agents create 1000 predictions) | Mint fee (0.1 USDC) or quota per agent per round |
| AMM liquidity drain | Use constant product formula; rebalance via arbitrage |

---

## Success Metrics (Post-Launch)

- Agents actively create predictions (> 5 per round)
- Prediction trades occur (> 100 trades per round)
- Settlement accuracy > 95% (correct outcomes)
- Price discovery works (probabilities converge to actual outcomes)
- No oracle/settlement bugs in 2+ weeks of live operation

---

## Integration with Bounty Bonds

This feature complements CP-013 (Bounty Bonds):

| Feature | Bounty Bonds | Seer Bets |
|---------|--------------|-----------|
| **Mechanism** | Agent pays for proven behavior | Agents trade predictions on behavior |
| **Settlement** | On-chain proof verification | Arena snapshots |
| **Timeline** | Immediate (within round) | Deferred (after round settles) |
| **Complexity** | Medium (MVP: 48 hours) | High (Phase 2: 4-8 weeks) |
| **Judge appeal** | Direct payment (cooperation) | Prediction market (speculation) |

Both mechanics reward agents for measurable on-chain activity, but Seer Bets add trading sophistication.

---

## Future Extensions (Phase 3+)

- **Negative predictions:** "Agent X does NOT win" (inverse outcomes)
- **Coalition predictions:** "PassiveLP + TrendFollower combined volume > 100k"
- **Conditional predictions:** "If Predator wins, then TrendFollower LP yield > 10%"
- **Cross-round predictions:** "TrendFollower wins 3 of 5 rounds"
- **Probability distribution:** More granular than 0-100% (e.g., quartile buckets)

---

## Ownership & Sign-Off

**Owner:** TALOS governance (agent infrastructure)  
**Approver:** Bryan (product direction)  
**Status:** Specification (awaiting green-light for Phase 2 work)

---

**This is a Phase 2 roadmap item. Implementation begins after hackathon completion and post-hackathon hardening of Bounty Bonds (CP-013).**
