# AEGIS Arena Architecture

## System Overview

```
┌─────────────────────────────────────────────────────┐
│ AI Agents (PassiveLP, TrendFollower, Predator)      │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼ (simulate before broadcast)
        ┌─────────────────────────────┐
        │   OKX Onchain Gateway       │ ← TX Simulation + Optimization
        │   (Pre-flight Validation)   │
        └─────────┬───────────────────┘
                  │ (broadcast if simulation passes)
                  ▼
        ┌─────────────────────┐
        │   Arena Contract    │ ← Game Orchestration
        │   (ETH/X Layer)     │
        └─────────┬───────────┘
                  │
                  ▼
    ┌─────────────────────────────────┐
    │  AEGIS Engine (PR #18 branch)   │ ← Vault + Liquidity
    │  (sqrt(K) Solvency)             │
    └─────────┬───────────────────────┘
              │
              ▼
    ┌─────────────────────────────────┐
    │   Uniswap v4 PoolManager        │ ← Swap Execution
    │   USDC/WOKB Pool (5 bps)        │
    └─────────────────────────────────┘
              │
              ▼
        ┌──────────────────┐
        │  X Layer (RPC)   │ (Chain ID: 196)
        └──────────────────┘
```

---

## Key Components

### 1. Arena.sol (Game Contract)

**Responsibilities:**
- Round lifecycle management (register → start → settle)
- Agent vault creation (FIX #1)
- Action batch execution
- Final scoring with WOKB→USDC conversion (FIX #4)
- Prize distribution with dust handling (FIX #7)

**Key State:**
```solidity
mapping(uint256 => RoundData) public rounds;
struct RoundData {
  uint256 roundId;
  uint256 startTime;
  uint256 endTime;
  uint256 roundDuration;           // FIX #5
  address[] agents;
  mapping(address => uint256) agentVaultIds;  // FIX #1
  mapping(address => uint256) finalScores;    // FIX #4
  bool settled;
}
```

---

### 2. OKX Onchain Gateway Integration

**Responsibilities:**
- Pre-flight transaction simulation (dry-run before broadcast)
- Gas estimation and cost prediction
- Multi-path transaction propagation (optimized for X Layer)
- Order tracking and confirmation polling
- Graceful fallback to direct RPC if gateway unavailable

**Integration Pattern:**
```
Agent.decideAction() → Action[]
    ↓
Agent.executeActions() [NEW: with OKX Gateway]
    ↓
GatewayClient.simulate(txData)
    ├─ If success: GatewayClient.broadcast(signedTx)
    │                   ↓
    │            GatewayClient.waitForConfirmation(txHash)
    ├─ If simulation fails: skip action (graceful degradation)
    └─ If gateway unavailable: fallback to direct RPC
```

**Key Features:**
- **Simulation before broadcast** — Agents validate their own actions before submitting on-chain
- **Gas estimation** — Agents predict transaction costs upfront
- **Autonomous safety** — No human review; agents make autonomous decisions
- **Production pattern** — Uses the same infrastructure OKX uses for production DeFi
- **Logging** — All simulation/broadcast results logged for audit and judge visibility

**Example Log Output:**
```
[PassiveLP] TX simulated OK — gasUsed: 145233
[PassiveLP] Broadcasting signed transaction...
[PassiveLP] Confirmed in 2 blocks ✓
```

**Fallback Behavior:**
- If OKX Gateway timeout → use direct RPC
- If simulation fails → log reason, skip action, continue
- If broadcast fails → log error, fall back to direct RPC
- **No crashes** — graceful degradation always available

---

### 4. Agent Contracts (Off-chain or Integrated)

**Each Agent:**
- Inherits `BaseAgent` class
- Implements `decideAction(state)` → returns `Action[]`
- Calls `Arena.executeBatch()` to execute actions
- **NEW:** Calls `GatewayClient.simulate()` before broadcasting (automatic via BaseAgent)

**Three Strategies:**
1. **PassiveLP:** Fee farming via liquidity provision
2. **TrendFollower:** Leveraged directional trading (3x via AEGIS)
3. **Predator:** Delta-neutral volatility arbitrage

**All agents inherit OKX Gateway simulation automatically** — no agent-specific changes required.

---

### 5. AEGIS Engine Integration

**PositionManager Address (from PR #18):**
- Critical for debt modification (FIX #1)
- Unlocked only during Batch 1 of borrow flow (FIX #4)
- Enforces sqrt(K) solvency: `sqrt(K) >= total_debt`

**Vault Creation:**
```
Arena.register() 
  → for each agent: engine.createVault() 
  → store vaultId mapping (FIX #1)
```

**Debt Modification (3-batch pattern):**
```
Batch 0: AE_UNLOCK_VAULT
Batch 1: AE_MODIFY_DEBT (PM unlocked)
Batch 2: AE_LOCK_VAULT
```

---

### 6. X Layer Network

**RPC:** https://rpc.xlayer.tech
**Chain ID:** 196

**Key Contracts:**
- PoolManager: 0x360e68...
- StateView: 0x76fd29...
- WOKB (OKB-X): 0xe5389...
- USDC: 0x74b7f1...
- Live Pool (USDC/WOKB, 5bps): 0x907210...

---

## Data Flow

### Registration Phase

```
Agent Addresses[]
      │
      ▼
Arena.register()
      │
      ├─→ for each agent:
      │    └─→ engine.createVault() → vaultId
      │    └─→ store mapping[agent] = vaultId
      │
      ▼
RoundData created, agents registered
Event: AgentRegistered(roundId, agent, vaultId)
```

### Action Execution Phase

```
Agent Decision Logic
      │
      ├─→ detect trend
      ├─→ calculate signal
      └─→ decide action[]

Arena.executeBatch(roundId, agent, actions[])
      │
      ├─→ validate round is active
      ├─→ encode actions to calldata
      ├─→ forward to AEGIS Router
      │
      ▼
Router processes opcodes:
  - 0x90: AE_MODIFY_LIQUIDITY
  - 0x91: AE_MODIFY_DEBT
  - 0x06-0x09: SWAP opcodes
  - 0xC0: PM_TAKE (limit orders)
      │
      ▼
Pool state updated, vault state updated
```

### Settlement Phase

```
Arena.settle(roundId)
      │
      ├─→ for each agent: calculate final score
      │    ├─→ query vault sL balance
      │    ├─→ query vault WOKB balance
      │    ├─→ query pool USDC reserves
      │    ├─→ convert sL → USDC: (sL / totalSL) × reserves
      │    ├─→ convert WOKB → USDC: wokb × (sqrtPrice/2^96)^2
      │    ├─→ add idle USDC
      │    └─→ finalScores[agent] = total USDC
      │
      ├─→ sort agents by score (descending)
      │
      ├─→ distribute prizes
      │    ├─→ 1st: 50% + dust
      │    ├─→ 2nd: 25%
      │    └─→ 3rd: 25%
      │
      ▼
RoundData.settled = true
Event: RoundSettled(roundId, winners[], prizes[])
```

---

## Scoring Example (Full Flow)

**Round 1 Setup:**
- PassiveLP vault: 100 USDC initial
- TrendFollower vault: 100 USDC initial
- Predator vault: 100 USDC initial

**After 1 hour of trading:**

**PassiveLP vault state:**
- sL shares: 1000
- WOKB: 0
- Idle: 50 USDC

**Scoring:**
```
sL → USDC: (1000 / 100k) × 10M = 100k
WOKB → USDC: 0 × price = 0
Idle: 50k
Total: 150k USDC
```

**TrendFollower vault state:**
- sL shares: 2000
- WOKB: 100
- Idle: 0

**Scoring:**
```
sL → USDC: (2000 / 100k) × 10M = 200k
WOKB → USDC: 100 × 1000 (approx) = 100k
Idle: 0
Total: 300k USDC ← WINNER
```

**Predator vault state:**
- sL shares: 1500
- WOKB: 50
- Idle: 25 USDC

**Scoring:**
```
sL → USDC: (1500 / 100k) × 10M = 150k
WOKB → USDC: 50 × 1000 = 50k
Idle: 25k
Total: 225k USDC
```

**Prize Distribution (1000 USDC pool):**
```
Ranking: TrendFollower (300k) > Predator (225k) > PassiveLP (150k)

Prizes:
  TrendFollower: 500 + 1 dust = 501 USDC
  Predator: 250 USDC
  PassiveLP: 249 USDC
```

---

## Security Model

### No Cascade Liquidations
AEGIS Engine uses sqrt(K) solvency instead of health factors:
```
Requirement: sqrt(liquidity_provided) × K_constant >= total_debt

Example:
- Agent provides 100 sL = √100 = 10 units
- K_constant = 1000
- Max debt: 10 × 1000 = 10,000 USDC
- Agent borrows 9,999 USDC: ✓ OK
- Agent borrows 10,001 USDC: ✗ REVERTED

If debt grows (price moves against position):
- Agent can still repay without cascade
- No liquidation of other agents
```

### Vault Isolation (FIX #1)
- Each agent has distinct vault
- Cross-agent contamination prevented
- VaultId mapping ensures 1:1 agent ↔ vault

### Explicit Duration (FIX #5)
- Round duration stored separately
- Prevents time-of-check-time-of-use bugs
- No confusion between endTime and start + duration

---

## Known Addresses (X Layer)

| Contract | Address |
|----------|---------|
| **PoolManager** | 0x360e68faCcca8cA495c1B759Fd9EEe466db9FB32 |
| **StateView** | 0x76fd297e2d437cd7f76d50f01afe6160f86e9990 |
| **Permit2** | 0x000000000022D473030F116dDEE9F6B43aC78BA3 |
| **WOKB** | 0xe538905cf8410324e03A5A23C1c177a474D59b2b |
| **USDC** | 0x74b7f16337b8972027f6196a17a631ac6de26d22 |
| **UniversalRouter** | 0x35029f7AD06B7d62C4511239d65CEbF0f1124338 |
| **Live Pool** | 0x9072107b33ad70c231602b537d91774a43c1837f9b28040ee9bf8cad0a0ab4a1 |
| **AEGIS PositionManager** | TBD (see POSITION_MANAGER_LOOKUP.md) |
| **Bounty Contract** | TBD (CP-013 deployment) |

---

## 6. Bounty Bonds Layer (CP-013)

**Status:** Hackathon Feature (CP-013 Implementation)

### System Diagram

```
[PassiveLP Agent]  [TrendFollower]  [Predator]
       │                  │               │
       └──────────────────┼───────────────┘
                          │
                          ▼
            ┌───────────────────────┐
            │  Bounty.sol Contract  │
            │ (create, claim,       │
            │  verify, expire)      │
            └───────────┬───────────┘
                        │
                ┌───────┴─────────┐
                │                 │
                ▼                 ▼
         ┌──────────────┐  ┌─────────────────┐
         │ USDC Escrow  │  │ Arena Contract  │
         │ (holds funds)│  │ .getSnapshots() │
         └──────────────┘  │ (attests volume)│
                           └─────────────────┘
                                   │
                                   ▼
                        ┌──────────────────────┐
                        │  x402 Payment Flow   │
                        │  (claim validation)  │
                        └──────────────────────┘
```

### Component Breakdown

**1. Bounty.sol Smart Contract**
- Manages bounty lifecycle: create → claim → verify → expire
- Holds USDC in escrow until verification
- Emits immutable event trail for auditing

**2. Arena.getSnapshots() Method**
- Returns (volume, avgPrice, blockRange) for an agent
- Attests to on-chain trading activity
- Used as proof for bounty verification

**3. SDK Module (src/sdk/bounty.ts)**
- TypeScript client for agents
- Methods: createBounty, claimBounty, getBounty, getRoundBounties, verifyBountyClaim
- Type-safe wrappers around Bounty.sol

**4. Server Verification Endpoint**
- POST `/bounties/verify` — validates proof and pays out
- Calls Arena.getSnapshots() for off-chain validation
- x402 token required for claim submissions

**5. Agent Logic**
- **PassiveLP:** Creates bounties when idle balance exceeds threshold
- **TrendFollower:** Claims bounties when volume/price conditions align
- **Predator:** Claims bounties conservatively (tight price constraints)

### Data Flow: Complete Bounty Lifecycle

```
Time → 

[Block 15000] PassiveLP detects excess liquidity (10k USDC)
    │
    ├─ Decides: Create bounty to attract trading volume
    │
    └─ Approves USDC transfer
        │
        ▼
[Block 15001] PassiveLP calls Bounty.createBounty()
    │
    ├─ reward: 1000 USDC
    ├─ minVolume: 10k USDC
    ├─ priceRange: 0.95–1.05
    ├─ windowBlocks: 100 (expires at block 15101)
    │
    ├─ USDC transferred to escrow
    ├─ Bounty stored in state
    ├─ BountyCreated event emitted
    │
    └─ bountyId=42 returned to PassiveLP

[Block 15050] TrendFollower scans active bounties
    │
    ├─ Finds bounty 42 in round 1
    ├─ Evaluates: estimates 15k USDC trade volume possible
    ├─ Decides: conditions are achievable
    │
    └─ Includes x402 token in request

[Block 15075] TrendFollower calls Bounty.claimBounty(42)
    │
    ├─ Validates: bounty exists, not claimed, not expired ✓
    ├─ Updates: claimed=true, claimedBy=TrendFollower
    ├─ Records: claimTxBlock=15075
    ├─ BountyClaimSubmitted event emitted
    │
    └─ State: BOUNTY IS NOW CLAIMED

[Block 15076] Server monitors BountyClaimSubmitted event
    │
    ├─ Queries: Arena.getSnapshots(roundId=1, TrendFollower)
    │   → returns: volume=10500 USDC, avgPrice=1.0000
    │
    ├─ Validates conditions:
    │   ├─ 10500 >= 10000? ✓ YES
    │   ├─ 0.95 <= 1.0 <= 1.05? ✓ YES
    │   └─ block.number < expiresAt? ✓ YES (15076 < 15101)
    │
    └─ All conditions satisfied

[Block 15077] Server calls Bounty.verifyAndPay(42, proof)
    │
    ├─ Proof = abi.encode([10500e6, 1.0])
    │
    ├─ Validates snapshot:
    │   └─ Decode proof: volume=10500, price=1.0
    │
    ├─ Payout logic:
    │   ├─ Read: escrowBalance[42] = 1000e6
    │   ├─ Check: volume 10500 >= min 10000 ✓
    │   ├─ Check: price 1.0 in [0.95–1.05] ✓
    │   ├─ Set: escrowBalance[42] = 0
    │   └─ Transfer: 1000e6 USDC → TrendFollower vault
    │
    ├─ Events emitted:
    │   ├─ BountyVerified(bountyId=42, claimer=TrendFollower, payout=1000e6, block=15077)
    │   └─ EscrowReleased(bountyId=42, recipient=TrendFollower, amount=1000e6)
    │
    └─ State: BOUNTY IS NOW VERIFIED

[Block 15100] Arena settles round 1
    │
    ├─ Computes final scores (includes bounty rewards)
    │
    ├─ PassiveLP final: ~105 USDC (fee earnings ~5, offset by bounty ~1000 cost)
    ├─ TrendFollower final: ~120 USDC (trading profit + 1000 USDC bounty)
    ├─ Predator final: ~108 USDC
    │
    └─ Judge sees: Agents coordinating via on-chain bounties
```

### Why Bounty Bonds Matter for Judges

| Aspect | Value for Judges |
|--------|------------------|
| **Multi-Agent Coordination** | Demonstrates agents can cooperate, not just compete |
| **On-Chain Evidence** | Every transaction is verifiable on X Layer explorer |
| **Emergent Behavior** | Simple rules (create/claim/verify) produce sophisticated dynamics |
| **Economic Realism** | Agents face real cost-benefit tradeoffs |
| **Autonomy Proof** | No human mediation; agents autonomously transact |

---

## 7. Post-Hackathon Roadmap

**Status:** Hackathon feature (deployed with Arena)

**Purpose:** Enable agent-to-agent payments for provable trading behavior.

**Mechanism:**
1. **Creator (PassiveLP)** posts a bounty: min volume, target price range, USDC reward
2. **Claimer (TrendFollower/Predator)** submits claim if they satisfy conditions
3. **Server** validates claim against Arena.getSnapshots() and pays from escrow
4. **Fallback** — unclaimed bounties expire and refund creator

**Key Components:**
- `Bounty.sol` — smart contract (creation, claim, verification, expiry)
- `Arena.getSnapshots()` — attests to agent trading volumes and prices
- `src/sdk/bounty.ts` — SDK methods (createBounty, claimBounty, getBounty, getRoundBounties)
- `src/server/routes/bounty.ts` — `/verify-bounty-claim` endpoint with x402 validation
- Agent logic — PassiveLP creates bounties; TrendFollower/Predator claim them

**x402 Integration:**
- USDC held in escrow until verification
- Claim submission requires x402 token (prevents spam)
- Server validates proof and pays out atomically

**See also:** `state/change-proposals/CP-013.md` (TALOS governance)

---

## 7. Post-Hackathon Roadmap

### Seer Bets (Phase 2)

**Status:** Specification, 4-8 weeks post-hackathon

**Purpose:** Agents trade prediction futures on Arena events.

**Example:**
- PassiveLP mints: "TrendFollower volume > 50k USDC" → trades at 0.72 probability
- Predator buys YES tokens
- If outcome verified, tokens settle 1.0; Predator profits

**Timeline:** Deferred due to complexity (commit-reveal, oracle settlement) and 48-hour hackathon constraint.

**See also:** `docs/roadmap/SEER_BETS.md` (full specification)

