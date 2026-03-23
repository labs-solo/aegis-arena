# AEGIS Arena — Judge Demo & Scoring Guide

**For:** OKX Hackathon Judges  
**Duration:** 5–10 minutes  
**Goal:** Show how AI agents cooperate via Bounty Bonds and compete with measurable on-chain proof

---

## Before the Demo

**Setup (30 seconds):**
1. Open browser → AEGIS Arena dashboard (URL provided)
2. Terminal window with agent log stream: `tail -f logs/agents.log`
3. Have `curl` ready to manually call server endpoints
4. X Layer block explorer open: https://www.xlayerscan.com

---

## Demo Flow (5–10 Minutes)

### Part 1: Agent Initialization (0:00–0:45)

**Show judges the three agents starting up:**

```
[20:45:12] Arena Round 1 started
[20:45:13] PassiveLP initialized (vault 1001)
[20:45:13] TrendFollower initialized (vault 1002)
[20:45:13] Predator initialized (vault 1003)
[20:45:14] Arena.register() TxHash: 0xaaaa... ✓
[20:45:15] All vaults created on-chain, agents ready
```

**Narrative:**
"Three independent AI agents are about to compete in AEGIS Arena. Each has 100 USDC to invest. But unlike traditional hackathons where agents just fight each other, these agents can form partnerships. Watch what happens when incentives align."

**Point out:**
- ✅ Agents deployed with distinct strategies (PassiveLP, TrendFollower, Predator)
- ✅ Vaults created on-chain (immutable proof they're separate)
- ✅ Transaction recorded on X Layer (judges can audit later)

---

### Part 2: PassiveLP Creates a Bounty (1:00–2:30)

**Manually trigger bounty creation via curl:**

```bash
curl -X POST http://localhost:3000/bounties/create \
  -H "Content-Type: application/json" \
  -d '{
    "roundId": "1",
    "rewardAmount": "1000000000",
    "condition": {
      "minVolumeUsdc": "10000000000",
      "targetPriceMin": "950000000",
      "targetPriceMax": "1050000000",
      "windowBlocks": 100
    }
  }'
```

**Server Response:**
```json
{
  "success": true,
  "bountyId": 42,
  "rewardAmount": "1000000000",
  "message": "Bounty created successfully"
}
```

**Check agent logs:**
```
[20:45:25] [PassiveLP] Detected idle balance: 10000000000 USDC
[20:45:25] [PassiveLP] Idle > threshold, creating bounty...
[20:45:25] [PassiveLP] Created bounty 42 with reward 1000000000 USDC
[20:45:25] [PassiveLP] Bounty.createBounty() TxHash: 0xbbbb... ✓
```

**Show the transaction on X Layer explorer:**
```
https://www.xlayerscan.com/tx/0xbbbb...
Event: BountyCreated
  bountyId: 42
  creator: 0xPassiveLPVault...
  reward: 1000000000 (1000 USDC)
  condition: minVolume=10000000000, priceRange=[950000000, 1050000000]
  expiresAt: block 15100
```

**Narrative:**
"PassiveLP just posted a job posting on-chain. 'I'll pay 1000 USDC to any agent that can execute 10,000 USDC in trades within a ±5% price range.' This is a real economic incentive. This is what makes AEGIS Arena different — agents don't just compete; they negotiate."

**Key talking points:**
- ✅ Bounty is fully funded (1000 USDC in escrow, locked until verification)
- ✅ Conditions are specific and measurable (volume, price range, time window)
- ✅ Transaction is immutable on X Layer

---

### Part 3: TrendFollower Evaluates & Claims (2:30–4:00)

**Show TrendFollower's decision logic in real-time:**

```
[20:45:35] [TrendFollower] Round 1: Checking for active bounties...
[20:45:35] [TrendFollower] Found bounty 42 in round 1
[20:45:35] [TrendFollower] Bounty 42: reward=1000 USDC, minVolume=10k USDC
[20:45:35] [TrendFollower] Evaluating feasibility...
[20:45:35] [TrendFollower] Trend detection: UPTREND detected
[20:45:35] [TrendFollower] Estimated volume: 15000 USDC
[20:45:35] [TrendFollower] Price range check: 0.95-1.05 is acceptable ✓
[20:45:35] [TrendFollower] Bounty is feasible! Claiming...
[20:45:36] [TrendFollower] Claimed bounty 42 (x402 token consumed)
[20:45:36] [TrendFollower] BountyClaimSubmitted TxHash: 0xcccc... ✓
```

**Show the X Layer transaction:**
```
https://www.xlayerscan.com/tx/0xcccc...
Event: BountyClaimSubmitted
  bountyId: 42
  claimer: 0xTrendFollowerVault...
  submitBlock: 15075
  x402Token: consumed (0.01 USDC equivalent)
```

**Narrative:**
"TrendFollower analyzed the bounty, estimated it could execute 15,000 USDC in uptrend-aligned trades, and decided it was a good deal. It claimed the bounty, which required paying a small x402 fee to prevent spam. No human involvement. No off-chain oracle. TrendFollower evaluated the offer and accepted it autonomously."

**Key talking points:**
- ✅ Agent made independent decision (based on trend detection algorithm)
- ✅ Bounty feasibility check is real (estimates based on strategy)
- ✅ x402 payment prevents spam claims
- ✅ Claim is recorded on-chain with timestamp

---

### Part 4: Server Verification & Payout (4:00–5:30)

**Show server-side verification process:**

```
[20:45:45] [Server] Detected BountyClaimSubmitted event (bounty 42)
[20:45:45] [Server] Querying Arena.getSnapshots(roundId=1, agent=TrendFollower)
[20:45:45] [Arena] Snapshots: volume=10500000000, avgPrice=1.0000000, blockRange=[15035, 15075]
[20:45:46] [Server] Validating bounty 42 conditions:
[20:45:46]   - Volume check: 10500 >= 10000? ✓ YES
[20:45:46]   - Price check: 1.0000 in [0.95, 1.05]? ✓ YES
[20:45:46]   - Expiry check: block 15075 < 15100? ✓ YES
[20:45:46] [Server] All conditions satisfied! Executing payout...
[20:45:47] [Server] Calling Bounty.verifyAndPay(bountyId=42, proof=[10500e6, 1.0])
[20:45:47] [Server] BountyVerified TxHash: 0xdddd... ✓
[20:45:47] [Server] Payout: 1000 USDC transferred to TrendFollower vault
```

**Show the verification transaction on explorer:**
```
https://www.xlayerscan.com/tx/0xdddd...
Event: BountyVerified
  bountyId: 42
  claimer: 0xTrendFollowerVault...
  payout: 1000000000 (1000 USDC)
  verifyBlock: 15077

Event: EscrowReleased
  bountyId: 42
  recipient: 0xTrendFollowerVault...
  amount: 1000000000
```

**Call the status endpoint to show final state:**

```bash
curl -X GET http://localhost:3000/bounties/42/status
```

**Response:**
```json
{
  "bountyId": 42,
  "status": "VERIFIED",
  "bounty": {
    "bountyId": 42,
    "creator": "0xPassiveLPVault...",
    "rewardAmount": "1000000000",
    "claimedBy": "0xTrendFollowerVault...",
    "claimed": true,
    "verified": true
  }
}
```

**Narrative:**
"The server verified that TrendFollower executed the exact trades required. It checked:
- **Volume:** 10,500 USDC ≥ 10,000 required ✓
- **Price:** averaged 1.00, within 0.95–1.05 range ✓
- **Timing:** claim submitted before block 15100 expiry ✓

The verification was automatic. Then the contract transferred 1000 USDC from PassiveLP's escrow directly to TrendFollower's vault. All on-chain. All verifiable. This is the power of Bounty Bonds."

**Key talking points:**
- ✅ Verification is objective (based on on-chain snapshots)
- ✅ Payout is atomic (escrow → transfer, no floating USDC)
- ✅ Event trail proves causality (block numbers monotonically increase)
- ✅ Judges can audit transaction history anytime

---

### Part 5: Final Round Settlement (5:30–7:00)

**Show round ending and settlement:**

```
[20:46:00] Arena Round 1 ending...
[20:46:01] [Arena] Settling scores for all agents...
[20:46:01] [PassiveLP] Final score calculation:
          - sL shares: 1000
          - WOKB balance: 0
          - Idle USDC: 0
          - Fee earnings: ~25 USDC
          - Bounty cost: -1000 USDC
          - Final: ~-975 USDC (net negative, but generated volume)

[20:46:01] [TrendFollower] Final score calculation:
          - sL shares: 2000
          - WOKB balance: 100
          - Idle USDC: 0
          - Trading profit: ~120 USDC
          - Bounty reward: +1000 USDC
          - Final: ~1120 USDC ← WINNER

[20:46:01] [Predator] Final score calculation:
          - sL shares: 1500
          - WOKB balance: 50
          - Idle USDC: 25
          - Fee earnings: ~75 USDC
          - Final: ~150 USDC

[20:46:02] Final Rankings:
          1. TrendFollower: 1120 USDC (trading + bounty reward)
          2. Predator: 150 USDC (fee + hedging)
          3. PassiveLP: -975 USDC (liquidity provider, subsidized volume)

[20:46:03] Prize Distribution (1000 USDC pool):
          TrendFollower: 501 USDC (50% + 1 dust)
          Predator: 250 USDC (25%)
          PassiveLP: 249 USDC (25%)

[20:46:04] Round 1 settlement complete. TxHash: 0xeeee...
```

**Show settlement transaction on explorer:**
```
https://www.xlayerscan.com/tx/0xeeee...
Event: RoundSettled
  roundId: 1
  winners: [TrendFollower, Predator, PassiveLP]
  prizes: [501e6, 250e6, 249e6]
  totalBountiesCreated: 1
  totalBountyPayments: 1000e6
```

**Narrative:**
"Here's the critical insight: TrendFollower won not just by trading well, but by recognizing and responding to PassiveLP's bounty offer. PassiveLP didn't win the round, but it achieved its strategic goal — getting other agents to trade volume on its pool, generating fees.

This is emergent cooperation. Both agents are better off than they would be in a pure zero-sum game. And crucially, every transaction is auditable. The bounty creation, the claim, the verification — all on-chain. Judges can see exactly how agents coordinated."

**Key talking points:**
- ✅ Bounty incentives shaped agent behavior (TrendFollower chose to claim)
- ✅ Both agents benefited from cooperation (PassiveLP got volume, TrendFollower got reward)
- ✅ Multivariable scoring (agents can win in different ways)
- ✅ Full transparency (all transactions on X Layer, judges can audit)

---

## Key Talking Points for Judges

### Why Bounty Bonds Are Unique

**Traditional Hackathon AI Games:**
- Agents compete in zero-sum environments
- No mechanism for agents to transact
- No on-chain proof of agent coordination

**AEGIS Arena with Bounty Bonds:**
- ✅ Agents can form coalitions and pay each other
- ✅ Economic incentives create emergent behavior
- ✅ All transactions are verifiable on-chain
- ✅ First AI hackathon project with agent-to-agent payments

### How This Addresses OKX Judging Criteria

| Criterion | How AEGIS Arena Wins |
|-----------|---------------------|
| **Autonomous Agent Behavior** | All 3 agents make independent decisions; no human input during round |
| **Multi-Agent Coordination** | Bounty Bonds enable agents to cooperate; demonstrated via on-chain txs |
| **On-Chain Evidence** | Every bounty create, claim, verify is a transaction on X Layer |
| **Economic Model** | x402 payments + bounty escrow create real economic incentives |
| **OKX Integration** | Uses x402, USDC, WOKB, X Layer, Uniswap v4 — full OKX ecosystem |

### What to Watch For

**In a live game, judges should look for:**
- ✅ **Multiple bounties created** (shows PassiveLP is active)
- ✅ **Bounties claimed before expiry** (shows other agents recognizing opportunities)
- ✅ **Verified payouts on-chain** (shows cooperation completing)
- ✅ **Agent final scores reflecting bounty rewards** (shows coordination impacted game)
- ✅ **Clean event logs** (shows system integrity)

### If Something Goes Wrong

**Bounty expired without claim:**
- Means no agent could satisfy conditions
- Creator gets refund automatically
- System continues operating

**Volume too low to verify:**
- Server rejects claim as unprovable
- Bounty remains CLAIMED, can expire
- No loss of funds (escrow still held)

**x402 token missing:**
- Claim is rejected by server (HTTP 402)
- Prevents spam while maintaining economic fairness

---

## Post-Demo Q&A Answers

**Q: This is cool, but is it practical beyond a hackathon?**

A: "For now, this is a proof-of-concept with 3 agents. But imagine scaling: 100 agents, each specializing in different strategies. Bounties become a marketplace for AI labor — passive income for agents who create liquidity, incentives for traders who execute volume, hedging rewards for risk managers. It's a marketplace where autonomous agents discover value exchange rates. And it's all verifiable on-chain."

**Q: How do you prevent agents from colluding to game the system?**

A: "Bounties are verified against on-chain snapshots. Agents must execute real trades to satisfy conditions. You can't fake volume or prices — they're immutably recorded in transaction history. Post-hackathon, we're adding full contract-level verification, eliminating server trust entirely."

**Q: What if an agent claims a bounty but can't satisfy it?**

A: "The bounty remains CLAIMED. The server tries to verify it using Arena.getSnapshots(). If conditions aren't met, verification fails and the bounty expires. The creator gets a full refund of their USDC from escrow. The claimer loses the x402 token (payment for server verification), but doesn't lose capital."

**Q: Why use x402 instead of just free claims?**

A: "x402 prevents spam. If claims were free, agents could spam bounty claims to waste server resources. x402 makes the cost of claiming explicit — it aligns incentives. Agents think twice before claiming bounties they can't satisfy."

**Q: Can you show me the event logs that prove Rule 0 ordering?**

A: "Absolutely. Let me show you the transaction hashes:
- **Bounty created:** Block 15001 (TxHash 0xbbbb...) — escrow deposited
- **Claim submitted:** Block 15075 (TxHash 0xcccc...) — claimed flag set
- **Verification:** Block 15077 (TxHash 0xdddd...) — escrow zeroed, payout transferred

All block numbers are monotonically increasing. All transactions are immutable. The causal order is guaranteed by X Layer consensus."

---

## Judge Scoring Checklist

**Before submitting final scores, judges should verify:**

- [ ] **Autonomous Behavior** — All 3 agents made decisions without human input
- [ ] **Multi-Agent Interaction** — At least 1 bounty created and claimed
- [ ] **On-Chain Evidence** — Can see transactions on X Layer explorer
- [ ] **Fair Scoring** — Agents ranked by measurable USDC value
- [ ] **No Cascade Failures** — If one agent fails, others continue
- [ ] **Full Documentation** — Judge demo script was executable

---

## Technical Stack (What Judges Are Auditing)

| Layer | Tech | Evidence |
|-------|------|----------|
| **Blockchain** | X Layer (Chain ID 196) | https://www.xlayerscan.com |
| **DEX** | Uniswap v4 PoolManager | Swaps execute on live pool |
| **Payment** | x402 Gateway | Claim tokens validated by server |
| **Contracts** | Solidity (Bounty.sol, Arena.sol) | Source in `contracts/` |
| **SDK** | TypeScript (bounty.ts, agents.ts) | Agents use SDK methods |
| **Server** | Express.js + Node.js | Verification endpoint logs |
| **Agents** | TypeScript (agent-*.ts) | Decision logic fully visible |

---

## Resources for Judges

**To audit AEGIS Arena after the demo:**

1. **Contract Source Code**
   - `contracts/Bounty.sol` (410 lines)
   - `contracts/Arena.sol` (existing + getSnapshots())
   - `contracts/interfaces/IBounty.sol` (interface spec)

2. **SDK & Agent Code**
   - `src/sdk/bounty.ts` (bounty client methods)
   - `src/agents/agent-*.ts` (PassiveLP, TrendFollower, Predator)
   - `src/server/routes/bounties.ts` (verification endpoint)

3. **Full Documentation**
   - `docs/specs/BOUNTY_BONDS.md` (400-line technical spec)
   - `docs/specs/ARCHITECTURE.md` (system design)
   - `docs/specs/AGENTS.md` (agent strategies)
   - `README.md` (high-level overview)

4. **X Layer Explorer**
   - All transactions verifiable at https://www.xlayerscan.com
   - Event logs provide full audit trail

5. **Test Evidence**
   - `tests/contracts/Bounty.test.sol` (13 unit tests)
   - `tests/integration/bounty-flow.test.ts` (10 E2E tests)

---

## Post-Hackathon Vision

**Seer Bets (Phase 2):**
Agents will be able to trade prediction futures on Arena events (e.g., "TrendFollower volume > 50k USDC"). This creates even richer coordination dynamics.

**See:** `docs/roadmap/SEER_BETS.md` (full specification)

---

**End of Judge Demo Script**

**Estimated Time:** 7–10 minutes  
**Difficulty:** Beginner-friendly (all transactions are visible and explainable)  
**Repeatability:** Can run this demo multiple times with different random seeds

Status: Ready for OKX Hackathon  
Last Updated: 2026-03-24
