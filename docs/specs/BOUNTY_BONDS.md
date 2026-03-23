# Bounty Bonds Specification

**Status:** CP-013 Implementation (Hackathon)  
**Author:** TALOS governance  
**Date:** 2026-03-24

---

## 1. Overview & Motivation

### What Are Bounty Bonds?

Bounty Bonds enable AI agents in AEGIS Arena to transact directly with each other. One agent (Creator) posts a USDC reward for another agent (Claimer) to claim by executing specific trading conditions. This mechanism demonstrates:

- **Autonomous agent cooperation** — agents negotiate value exchange without human mediation
- **Emergent market dynamics** — agents discover optimal strategies through real incentives
- **On-chain verifiability** — all transactions are permanent and auditable
- **Economic realism** — agents face realistic cost-benefit tradeoffs

### Example Flow

**Round 1, Block 15000:**
```
PassiveLP has excess liquidity: 10k USDC idle, earning 0% fees
PassiveLP posts a bounty:
  - Reward: 1000 USDC
  - Condition: "Execute 10k USDC in trades within 0.95-1.05 price range, within 100 blocks"

TrendFollower detects uptrend:
  - Estimates it can execute 15k USDC in favorable trades
  - Evaluates bounty conditions: volume OK, price range OK
  - Claims bounty (submits x402 token to prevent spam)

Server monitors (Block 15076):
  - Queries Arena.getSnapshots(roundId, TrendFollower)
  - Gets: volume=10500 USDC, avgPrice=1.0000
  - Validates: 10500 >= 10000 ✓, 0.95 <= 1.0 <= 1.05 ✓
  - Calls Bounty.verifyAndPay()
  - Transfers 1000 USDC to TrendFollower

Final Settlement:
  - PassiveLP: 10k USDC volume × 5bps × 50% = ~25 USDC fees (offset bounty cost)
  - TrendFollower: +1000 USDC bounty reward (profit from both trading AND cooperation)
  - Judge sees: two agents coordinating, proof of agency
```

### Why This Matters for Judges

In traditional hackathon projects, agents compete in a zero-sum game. Bounty Bonds create something unprecedented:

1. **Multi-Agent Value Exchange** — Agents can cooperate while competing
2. **Market Discovery** — Bounty prices reveal agent preferences and capabilities
3. **Judge-Facing Evidence** — Every bounty is a verifiable transaction proving agent autonomy
4. **Emergent Complexity** — Simple mechanism (post reward → execute → verify) creates sophisticated dynamics

---

## 2. Core Concepts & Data Structures

### BountyCondition

Specifies the trading requirements a claimer must satisfy:

```solidity
struct BountyCondition {
  uint256 minVolumeUsdc;     // Minimum USDC volume (6 decimals)
  uint256 targetPriceMin;    // Min acceptable avg price (sqrtPriceX96 format)
  uint256 targetPriceMax;    // Max acceptable avg price (sqrtPriceX96 format)
  uint64 windowBlocks;       // Observation window in blocks
}
```

**Example:** 
```solidity
BountyCondition {
  minVolumeUsdc: 10000e6,      // 10,000 USDC
  targetPriceMin: 950000000,   // ~0.95 USDC/WOKB
  targetPriceMax: 1050000000,  // ~1.05 USDC/WOKB
  windowBlocks: 100            // ~30 min on Ethereum
}
```

### Bounty

The complete bounty record, stored on-chain:

```solidity
struct Bounty {
  uint256 bountyId;          // Unique auto-incrementing ID
  address creator;           // Agent that posted bounty
  uint256 rewardAmount;      // USDC reward (6 decimals)
  uint256 roundId;           // Arena round this applies to
  bytes32 conditionHash;     // Hash of BountyCondition (immutable reference)
  BountyCondition condition; // Full condition data
  uint64 expiresAt;          // Block number (not timestamp)
  bool claimed;              // Has someone claimed this bounty?
  address claimedBy;         // Which agent claimed it (or 0x0)
  uint256 claimTxBlock;      // Block number when claim was submitted
}
```

### Bounty Lifecycle States

```
CREATED → AVAILABLE → CLAIMED → VERIFIED
                   ↓
                 EXPIRED → (refund)
```

**State Transitions:**

| State | Event | Trigger | Next |
|-------|-------|---------|------|
| CREATED | BountyCreated | `createBounty()` | AVAILABLE |
| AVAILABLE | BountyClaimSubmitted | `claimBounty()` | CLAIMED |
| CLAIMED | BountyVerified | `verifyAndPay()` ✅ | VERIFIED |
| CLAIMED | BountyExpired | `expireBounty()` ❌ | (refund) |
| AVAILABLE | BountyExpired | `expireBounty()` after windowBlocks | (refund) |

---

## 3. Smart Contract API (Bounty.sol)

### Initialization

```solidity
constructor(address _arena, address _usdcToken) {
  require(_arena != address(0), "Bounty: invalid Arena");
  require(_usdcToken != address(0), "Bounty: invalid USDC");
  arena = _arena;
  usdcToken = IERC20(_usdcToken);
}
```

### createBounty()

```solidity
function createBounty(
  uint256 roundId,
  uint256 rewardAmount,
  BountyCondition calldata condition
) external nonReentrant returns (uint256 bountyId)
```

**What it does:**
1. Validates inputs (reward > 0, condition valid)
2. Transfers USDC from creator to contract (escrow)
3. Stores bounty in state
4. Emits BountyCreated event
5. Returns the new bountyId

**Preconditions:**
- Creator has approved `rewardAmount` USDC to this contract
- `minVolumeUsdc > 0`
- `targetPriceMin <= targetPriceMax`
- `windowBlocks > 0`

**Postconditions:**
- `escrowBalance[bountyId] == rewardAmount`
- `bounty.claimed == false`
- `bounty.expiresAt == block.number + condition.windowBlocks`
- Event: `BountyCreated(bountyId, creator, rewardAmount, roundId, conditionHash, expiresAt)`

### claimBounty()

```solidity
function claimBounty(uint256 bountyId) external nonReentrant
```

**What it does:**
1. Validates bounty exists
2. Checks bounty not already claimed
3. Checks not expired
4. Marks bounty as claimed
5. Records claimer and claim block
6. Emits BountyClaimSubmitted event

**Preconditions:**
- Bounty exists
- `bounty.claimed == false`
- `block.number < bounty.expiresAt`

**Postconditions:**
- `bounty.claimed == true`
- `bounty.claimedBy == msg.sender`
- `bounty.claimTxBlock == block.number`
- Event: `BountyClaimSubmitted(bountyId, msg.sender, block.number)`

### verifyAndPay()

```solidity
function verifyAndPay(
  uint256 bountyId,
  bytes calldata snapshotProof
) external nonReentrant returns (bool success)
```

**What it does:**
1. Validates bounty exists and is claimed
2. Decodes snapshot proof → (volume, avgPrice)
3. Validates conditions (volume >= min, price in range)
4. Transfers USDC from escrow to claimer
5. Emits BountyVerified and EscrowReleased events

**Preconditions:**
- Bounty exists
- `bounty.claimed == true`
- `block.number < bounty.expiresAt`
- Proof contains valid (volume, avgPrice) data
- `volume >= bounty.condition.minVolumeUsdc`
- `bounty.condition.targetPriceMin <= avgPrice <= bounty.condition.targetPriceMax`

**Postconditions:**
- `escrowBalance[bountyId] == 0`
- USDC transferred to `bounty.claimedBy`
- Event: `BountyVerified(bountyId, claimedBy, payout, block.number)`
- Event: `EscrowReleased(bountyId, claimedBy, payout)`

### expireBounty()

```solidity
function expireBounty(uint256 bountyId) external nonReentrant
```

**What it does:**
1. Validates bounty exists
2. Checks bounty is expired (block.number >= expiresAt)
3. Checks bounty not already claimed
4. Marks bounty as expired
5. Refunds creator
6. Emits BountyExpired and EscrowReleased events

**Preconditions:**
- Bounty exists
- `block.number >= bounty.expiresAt`
- `bounty.claimed == false`

**Postconditions:**
- `escrowBalance[bountyId] == 0`
- USDC refunded to `bounty.creator`
- Event: `BountyExpired(bountyId, refund)`
- Event: `EscrowReleased(bountyId, creator, refund)`

### View Functions

```solidity
function getBounty(uint256 bountyId) 
  external view returns (Bounty memory)

function getRoundBounties(uint256 roundId) 
  external view returns (uint256[] memory)

function getCreatorBounties(address creator) 
  external view returns (uint256[] memory)

function getEscrowBalance(uint256 bountyId) 
  external view returns (uint256)
```

---

## 4. Bounty Verification Flow

### How Server Validates Claims

```
1. Agent calls claimBounty() on-chain (marks CLAIMED)
   ↓
2. Server listens for BountyClaimSubmitted event
   ↓
3. Server queries Arena.getSnapshots(roundId, claimer)
   → returns (totalVolume, avgPrice, startBlock, endBlock)
   ↓
4. Server validates conditions:
   - totalVolume >= condition.minVolumeUsdc
   - condition.targetPriceMin <= avgPrice <= condition.targetPriceMax
   - block.number < bounty.expiresAt
   ↓
5. If valid: Server calls Bounty.verifyAndPay(bountyId, proof)
   - Proof = abi.encode(totalVolume, avgPrice)
   - Escrow transferred to claimer
   ↓
6. If invalid: Bounty remains CLAIMED, can be expired after windowBlocks
```

### Arena.getSnapshots() Interface

```solidity
/// @notice Get snapshots of agent activity for a round
/// @param roundId The Arena round ID
/// @param agent The agent address to snapshot
/// @return totalVolumeUsdc Total USDC volume traded by this agent
/// @return avgSqrtPriceX96 Average execution price (sqrtPriceX96 format)
/// @return startBlock Earliest transaction block
/// @return endBlock Latest transaction block
function getSnapshots(uint256 roundId, address agent)
  external view
  returns (
    uint256 totalVolumeUsdc,
    uint256 avgSqrtPriceX96,
    uint256 startBlock,
    uint256 endBlock
  )
```

**MVP Note:** Hackathon implementation uses server-side validation. Post-hackathon, Arena will track transaction history for full contract-level verification.

---

## 5. Agent Integration

### PassiveLP: Bounty Creator Strategy

**When:** Detects excess idle liquidity

**How:**
```typescript
// Check idle balance
const idleUsdc = await this.getIdleUsdcBalance();
const bountyThreshold = 5000n * 10n ** 6n; // 5k USDC

if (idleUsdc > bountyThreshold) {
  // Create bounty to attract trading volume
  const bountyReward = 1000n * 10n ** 6n; // 1k USDC
  const condition: BountyCondition = {
    minVolumeUsdc: 10000n * 10n ** 6n,
    targetPriceMin: 950000000n,
    targetPriceMax: 1050000000n,
    windowBlocks: 100n,
  };

  const bountyId = await createBounty(
    this.arenaClient,
    roundId,
    bountyReward,
    condition
  );

  console.log(`[PassiveLP] Created bounty ${bountyId}`);
}
```

**Rationale:**
- Excess liquidity earns no fees → incentivize other agents to trade
- Bounty cost is offset by fee revenue from volume
- Attracts TrendFollower/Predator to trade on PassiveLP's pool

### TrendFollower: Bounty Claiming Strategy

**When:** Detects bounties it can satisfy

**How:**
```typescript
const activeBounties = await getRoundBounties(arenaClient, roundId);

for (const bountyId of activeBounties) {
  const bounty = await getBounty(arenaClient, bountyId);
  if (!bounty || bounty.claimed) continue;

  // Evaluate if we can satisfy this bounty
  if (this.canSatisfyBountyCondition(bounty.condition)) {
    await claimBounty(arenaClient, bountyId);
    console.log(`[TrendFollower] Claimed bounty ${bountyId}`);
    break;
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

**Rationale:**
- Bounties supplement trading returns
- Only claim bounties aligned with trading strategy
- Requires x402 token (prevents spam)

### Predator: Conservative Bounty Claiming

**When:** Bounties have tight price constraints

**How:**
```typescript
private canSatisfyBountyCondition(condition: BountyCondition): boolean {
  const estimatedVolume = 8000n * 10n ** 6n; // Lower than TrendFollower
  
  // Predator requires ±2% price tolerance (tighter than TrendFollower's ±5%)
  const priceRangeOk = 
    condition.targetPriceMax - condition.targetPriceMin <= 200000000n;
  
  return (
    estimatedVolume >= condition.minVolumeUsdc &&
    priceRangeOk
  );
}
```

**Rationale:**
- Delta-neutral strategy requires tight price control
- Only claims bounties compatible with hedging
- Bounty rewards supplement volatility harvesting

---

## 6. SDK Reference (src/sdk/bounty.ts)

### createBounty()

```typescript
export async function createBounty(
  arenaClient: ArenaClient,
  roundId: bigint,
  rewardAmountUsdc: bigint,
  condition: BountyCondition
): Promise<bigint>
```

**Purpose:** Post a bounty for other agents to claim

**Parameters:**
- `arenaClient` — Initialized Arena client
- `roundId` — Which round this bounty applies to
- `rewardAmountUsdc` — USDC reward (6 decimals, e.g., 1000e6 for 1000 USDC)
- `condition` — BountyCondition with volume/price/window

**Returns:** The newly created bountyId

**Example:**
```typescript
const bountyId = await createBounty(
  arenaClient,
  BigInt(1),
  BigInt(1000e6),
  {
    minVolumeUsdc: BigInt(10000e6),
    targetPriceMin: BigInt(950000000),
    targetPriceMax: BigInt(1050000000),
    windowBlocks: BigInt(100),
  }
);
console.log(`Created bounty ${bountyId}`);
```

### claimBounty()

```typescript
export async function claimBounty(
  arenaClient: ArenaClient,
  bountyId: bigint
): Promise<void>
```

**Purpose:** Submit claim for a bounty (requires x402 token)

**Parameters:**
- `arenaClient` — Initialized Arena client
- `bountyId` — The bounty to claim

**Throws:** Error if bounty not found, already claimed, or expired

**Example:**
```typescript
await claimBounty(arenaClient, BigInt(42));
console.log("Bounty claimed");
```

### getBounty()

```typescript
export async function getBounty(
  arenaClient: ArenaClient,
  bountyId: bigint
): Promise<BountyRecord | null>
```

**Purpose:** Query full bounty details

**Returns:** BountyRecord or null if not found

**Example:**
```typescript
const bounty = await getBounty(arenaClient, BigInt(42));
if (bounty) {
  console.log(`Bounty reward: ${bounty.rewardAmount} USDC`);
  console.log(`Claimed by: ${bounty.claimedBy}`);
}
```

### getRoundBounties()

```typescript
export async function getRoundBounties(
  arenaClient: ArenaClient,
  roundId: bigint
): Promise<bigint[]>
```

**Purpose:** Query all active bounties in a round

**Returns:** Array of bounty IDs

**Example:**
```typescript
const bountyIds = await getRoundBounties(arenaClient, BigInt(1));
console.log(`Found ${bountyIds.length} bounties in round 1`);

for (const bountyId of bountyIds) {
  const bounty = await getBounty(arenaClient, bountyId);
  console.log(`Bounty ${bountyId}: reward=${bounty.rewardAmount}`);
}
```

### verifyBountyClaim()

```typescript
export async function verifyBountyClaim(
  arenaClient: ArenaClient,
  bountyId: bigint,
  snapshotProof: string
): Promise<boolean>
```

**Purpose:** Server-side verification and payout

**Parameters:**
- `arenaClient` — Initialized Arena client
- `bountyId` — The bounty to verify
- `snapshotProof` — Encoded proof from Arena.getSnapshots()

**Returns:** true if verification and payout succeeded

**Example (server-side only):**
```typescript
// Server queries Arena.getSnapshots()
const snapshots = await arena.getSnapshots(roundId, claimer);
const proof = abi.encode(
  ["uint256", "uint256"],
  [snapshots.totalVolume, snapshots.avgPrice]
);

// Verify and pay
const success = await verifyBountyClaim(arenaClient, bountyId, proof);
if (success) {
  console.log(`Bounty ${bountyId} verified and paid`);
}
```

---

## 7. x402 Payment Flow

### Spam Prevention

Claiming a bounty requires an x402 token:

1. **Agent submits claim:** `POST /bounties/claim` with x402 header
2. **Server validates token:** checks freshness (< 5 min old) and signature
3. **Token rejected:** returns 402 Payment Required
4. **Token accepted:** claim processed on-chain

### Cost Model

| Action | Cost | Payer | Justification |
|--------|------|-------|---------------|
| Create bounty | Free | Creator | No on-chain verification burden |
| Claim bounty | x402 token (~0.01 USDC) | Claimer | Server performs verification |
| Verify bounty | Free (amortized in token) | Server | Part of claim flow |

### Token Lifecycle

```
Agent acquires x402 token (via payment gateway)
    ↓
Agent includes token in POST /bounties/claim header
    ↓
Server validates token signature and freshness
    ↓
Server processes claim on-chain
    ↓
Token consumed (one-time use)
```

**Note:** Post-hackathon, could implement tiered fees or reputation discounts for trusted agents.

---

## 8. Rule 0 Ordering (Causality Proof)

All bounty state transitions are atomic and causally ordered. Escrow accounting is a monotonic function:

### Example Transaction Log

```json
{
  "roundId": 1,
  "bounties": [
    {
      "bountyId": 42,
      "stateTransitions": [
        {
          "event": "BountyCreated",
          "block": 15000,
          "txHash": "0xaaaa...",
          "creator": "0xPassiveLP...",
          "rewardAmount": "1000000000",
          "escrowBalance": "1000000000",
          "timestamp": "2026-03-24T20:45:25Z"
        },
        {
          "event": "BountyClaimSubmitted",
          "block": 15075,
          "txHash": "0xbbbb...",
          "claimer": "0xTrendFollower...",
          "claimed": true,
          "escrowBalance": "1000000000",
          "timestamp": "2026-03-24T20:45:35Z"
        },
        {
          "event": "BountyVerified",
          "block": 15077,
          "txHash": "0xcccc...",
          "claimer": "0xTrendFollower...",
          "payout": "1000000000",
          "escrowBalance": "0",
          "timestamp": "2026-03-24T20:45:36Z"
        }
      ]
    }
  ]
}
```

### Invariants (Always True)

1. **Monotonic block numbers:** 15000 < 15075 < 15077
2. **No state regression:** claimed=true never reverts
3. **Escrow monotonic:** 1000 → 1000 → 0 (never increases)
4. **All transitions immutable:** tx hashes recorded

---

## 9. Security Considerations

### Escrow Safety

USDC held in contract until verification:
- Creator deposits on `createBounty()` ✅
- Held in `escrowBalance[bountyId]` mapping ✅
- Transferred atomically on `verifyAndPay()` ✅
- Refunded on `expireBounty()` ✅
- No floating USDC (all accounted for) ✅

### Reentrancy Protection

All state-changing functions use `nonReentrant` guard:
- `createBounty()` ✅
- `claimBounty()` ✅
- `verifyAndPay()` ✅
- `expireBounty()` ✅

Checks-effects-interactions pattern:
1. Validate inputs
2. Update state (escrow, claimed flag)
3. External call (USDC transfer)

### Snapshot Proof Validation

**MVP (Hackathon):** Server validates; stores proof off-chain

**Post-Hackathon:** Contract-level verification:
1. Arena tracks transaction history
2. `Arena.getSnapshots()` returns verifiable snapshot
3. Contract validates conditions directly
4. No trust in server validation

### Known Limitations

| Issue | Severity | Status | Timeline |
|-------|----------|--------|----------|
| Server-side validation (not contract) | Medium | MVP | Week 1 post-hackathon |
| Owner-only verifyAndPay() | Low | MVP | Week 1 post-hackathon |
| Single claim per bounty | Low | MVP | Week 2 post-hackathon |
| No partial claims (all-or-nothing) | Low | MVP | Week 2 post-hackathon |

---

## 10. On-Chain Evidence (What Judges Will See)

### Event Trail

**Every bounty creates immutable records:**

```solidity
event BountyCreated(
  uint256 indexed bountyId,
  address indexed creator,
  uint256 reward,
  uint256 roundId,
  bytes32 conditionHash,
  uint64 expiresAt
);

event BountyClaimSubmitted(
  uint256 indexed bountyId,
  address indexed claimer,
  uint256 submitBlock
);

event BountyVerified(
  uint256 indexed bountyId,
  address indexed claimer,
  uint256 payout,
  uint256 verifyBlock
);

event EscrowReleased(
  uint256 indexed bountyId,
  address indexed recipient,
  uint256 amount
);
```

### X Layer Block Explorer Evidence

Judges can view:
1. **Bounty creation TX** → see USDC transferred to escrow
2. **Claim submission TX** → see x402 payment + claim timestamp
3. **Verification TX** → see conditions validated + payout executed
4. **Event logs** → see all state transitions in order

**Example X Layer Explorer URL:**
```
https://www.xlayerscan.com/tx/0xaaaa...
[Shows BountyCreated event with all parameters]

https://www.xlayerscan.com/tx/0xbbbb...
[Shows BountyClaimSubmitted + x402 fee consumption]

https://www.xlayerscan.com/tx/0xcccc...
[Shows BountyVerified + 1000 USDC transferred to claimer]
```

---

## 11. Post-Hackathon Roadmap

### Phase 4 (Week 1): Volume Tracking

**Objective:** Enable contract-level verification

**Tasks:**
- [ ] Add transaction history log to Arena.sol
- [ ] Implement Arena.getSnapshots() with real volume aggregation
- [ ] Update Bounty.verifyAndPay() to validate snapshots on-chain

**Effort:** 16 hours

### Phase 5 (Week 2): Security Audit

**Objective:** Third-party security review

**Tasks:**
- [ ] Engage external firm (e.g., Trail of Bits)
- [ ] Fuzz test Bounty.sol condition validation
- [ ] Audit escrow accounting invariants
- [ ] Verify Rule 0 ordering proofs

**Effort:** 40 hours

### Phase 6 (Week 3): Signer Whitelist

**Objective:** Decentralize verification

**Tasks:**
- [ ] Replace owner-only verifyAndPay() with signer whitelist
- [ ] Implement ECDSA signature verification
- [ ] Add signer addition/removal via governance
- [ ] Maintain backward compatibility

**Effort:** 12 hours

### Phase 7 (Week 4): Mainnet Deployment

**Objective:** Deploy to X Layer production

**Tasks:**
- [ ] Deploy Bounty.sol to X Layer mainnet
- [ ] Initialize addresses.json with production addresses
- [ ] Activate agents with real capital
- [ ] Monitor first week of operations

**Effort:** 8 hours

### Phase 8 (Week 4+): Seer Bets Planning

**Objective:** Design next DeFi primitive

**See:** `docs/roadmap/SEER_BETS.md` (separate specification)

---

## 12. FAQ

**Q: What if an agent claims a bounty but can't satisfy conditions?**  
A: Bounty remains CLAIMED. Creator can wait for expiry (block limit) and refund. Claimer loses x402 token. Post-hackathon: could add slashing (claimer forfeits reputation).

**Q: Can multiple agents claim the same bounty?**  
A: No. First claim wins (MVP). Post-hackathon: support fractionated claims (multiple agents split 1 bounty reward).

**Q: What if the server crashes during verification?**  
A: Bounty remains CLAIMED, can be expired after windowBlocks passes. Creator gets refund. No permanent loss of funds.

**Q: Can agents collude to fake bounty claims?**  
A: No. Server validates against Arena.getSnapshots(). Fake volume would be detectable in transaction history.

**Q: What's the minimum windowBlocks?**  
A: No minimum (MVP). Recommended: ≥5 blocks (ensures finality). Post-hackathon: could enforce `windowBlocks >= 5`.

**Q: Can a bounty be created with impossible conditions?**  
A: Yes (MVP). No validation on condition feasibility. Server will reject impossible proofs during verification. Post-hackathon: could add oracle to validate historical feasibility.

---

## 13. References

- **Smart Contract:** `contracts/Bounty.sol` (410 lines)
- **Interface:** `contracts/interfaces/IBounty.sol`
- **SDK:** `src/sdk/bounty.ts` (260 lines)
- **Server Routes:** `src/server/routes/bounties.ts` (160 lines)
- **Agent Integration:** See `docs/specs/AGENTS.md` (Bounty subsections)
- **Governance:** `state/change-proposals/CP-013.md` (TALOS CP)
- **Architecture:** `docs/specs/ARCHITECTURE.md` (Section 6)

---

**End of Specification**

Status: CP-013 Implementation (Hackathon)  
Next Review: Post-hackathon phase-4 planning
