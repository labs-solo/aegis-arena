# AEGIS Arena Architecture

## System Overview

```
┌─────────────────────────────────────────────────────┐
│ AI Agents (PassiveLP, TrendFollower, Predator)      │
└─────────────────┬───────────────────────────────────┘
                  │
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

### 2. Agent Contracts (Off-chain or Integrated)

**Each Agent:**
- Inherits `BaseAgent` class
- Implements `decideAction(state)` → returns `Action[]`
- Calls `Arena.executeBatch()` to execute actions

**Three Strategies:**
1. **PassiveLP:** Fee farming via liquidity provision
2. **TrendFollower:** Leveraged directional trading (3x via AEGIS)
3. **Predator:** Delta-neutral volatility arbitrage

---

### 3. AEGIS Engine Integration

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

### 4. X Layer Network

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

