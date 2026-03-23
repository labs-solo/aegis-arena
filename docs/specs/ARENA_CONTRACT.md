# Arena Contract Specification

## Overview

`Arena.sol` is the main game orchestration contract. It manages:
- Round creation and agent registration
- Vault creation for each agent (FIX #1)
- Action execution via AEGIS Router
- Final settlement with scoring and prize distribution

All 8 known issues are fixed in this implementation.

---

## State Structure

```solidity
struct RoundData {
  uint256 roundId;
  uint256 startTime;
  uint256 endTime;
  uint256 roundDuration;          // FIX #5: Explicit duration
  uint256 prizePool;
  address[] agents;
  mapping(address => uint256) agentVaultIds;    // FIX #1: Vault IDs
  mapping(address => uint256) finalScores;      // FIX #4: USDC scores
  bool settled;
}
```

---

## Core Functions

### register(address[] agents) → roundId
**Purpose:** Register agents for a new round and create vaults

**Key Implementation (FIX #1):**
```solidity
for (uint256 i = 0; i < agents.length; i++) {
  uint256 vaultId = engine.createVault();  // ← CRITICAL: Create vault
  round.agentVaultIds[agent] = vaultId;   // Store mapping
}
```

**Returns:** Round ID

---

### startRound(uint256 roundId, uint256 durationSeconds)
**Purpose:** Start a round with explicit duration

**Key Implementation (FIX #5):**
```solidity
round.startTime = block.timestamp;
round.roundDuration = durationSeconds;    // ← CRITICAL: Store duration
round.endTime = block.timestamp + durationSeconds;
```

---

### executeBatch(uint256 roundId, address agent, bytes[] actions)
**Purpose:** Execute agent actions during round

**Validation:**
- Round is active (block.timestamp < endTime)
- Agent is registered in round
- VaultId exists for agent

---

### settle(uint256 roundId)
**Purpose:** Compute final scores and distribute prizes

**Key Implementation (FIX #4, FIX #7):**

1. **Score Calculation (FIX #4):**
```solidity
// Convert all holdings to USDC
score = convertSLToUSDC(vault) 
      + convertWOKBToUSDC(vault)  // Uses sqrtPrice formula
      + getIdleUSDC(vault);
```

2. **Prize Distribution (FIX #7):**
```solidity
// Example: 1000 USDC, 3 agents
uint256 totalPrizes = 1000e6;
prizes[0] = 500e6 + (1000e6 % 2);  // Winner gets dust
prizes[1] = 250e6;
prizes[2] = 250e6;
```

**Returns:** (winners[], prizes[])

---

## Query Functions

### getRoundState(uint256 roundId)
**Returns:** (startTime, endTime, roundDuration, settled, agents[])

### getFinalScores(uint256 roundId)
**Returns:** (agentsRanked[], scores[], prizes[])

### getAgentVault(uint256 roundId, address agent)
**Returns:** vaultId

### isRoundActive(uint256 roundId)
**Returns:** bool (startTime > 0 && block.timestamp < endTime)

---

## Events

```solidity
event RoundRegistered(uint256 indexed roundId, address[] agents);
event RoundStarted(uint256 indexed roundId, uint256 duration);
event RoundSettled(
  uint256 indexed roundId,
  address[] winners,
  uint256[] prizes,
  uint256[] finalScores
);
event AgentRegistered(uint256 indexed roundId, address agent, uint256 vaultId);
event ActionsExecuted(uint256 indexed roundId, address agent, bytes[] actions);
```

---

## Access Control

**Owner-only functions:**
- `register()`
- `startRound()`
- `settle()`

**Public functions:**
- `executeBatch()` — can be called by anyone for registered agents
- All query functions

---

## WOKB→USDC Conversion (FIX #4)

The scoring uses the correct sqrtPriceX96 formula:

```solidity
// Get pool price
uint256 sqrtPriceX96 = pool.sqrtPrice;

// Convert: price = (sqrtPrice / 2^96)^2
uint256 price = (sqrtPriceX96 / (2**96)) ** 2;

// Convert WOKB balance to USDC
uint256 wokbBalance = ...; // from vault
uint256 wokbValueUSDC = wokbBalance * price;
```

**Correct order:**
1. Divide sqrtPrice by 2^96 first
2. Square the result
3. Multiply token balance by final price

**Wrong approach (avoid):**
```solidity
// ❌ WRONG: Loses precision
uint256 price = (sqrtPrice ** 2) / (2 ** 192);
```

---

## Prize Dust Handling (FIX #7)

When dividing prizes unevenly:

```solidity
// Example: 1001 USDC / 3 agents
uint256 totalPrizes = 1001e6;

// Method 1: Winner takes all dust
uint256 basePrize = totalPrizes / agents.length;     // 333e6
uint256 dust = totalPrizes % agents.length;          // 2e6
prizes[0] = basePrize + dust;  // 335e6 (winner)
prizes[1] = basePrize;          // 333e6
prizes[2] = basePrize;          // 333e6

// Method 2: Split 50/25/25 + dust
uint256 firstPrize = totalPrizes / 2;                // 500e6
uint256 secondPrize = totalPrizes / 4;               // 250e6
uint256 thirdPrize = totalPrizes / 4;                // 250e6
uint256 dust = totalPrizes % 4;                      // 1e6

prizes[0] = firstPrize + dust;   // 501e6
prizes[1] = secondPrize;          // 250e6
prizes[2] = thirdPrize;           // 250e6
```

**Rule:** Dust always goes to the highest-ranked agent (1st place).

---

## Edge Cases

### No Agents Registered
- `register()` requires at least 2 agents
- `settle()` reverts if no agents

### Zero Holdings at Settlement
```solidity
// Agent with 0 sL, 0 WOKB, 0 idle
finalScores[agent] = 0
```

### Vault Creation Failure (FIX #1)
If `engine.createVault()` fails:
- `register()` reverts
- No vault is stored
- Round is not created

**This is correct behavior** — ensures 1:1 agent ↔ vault mapping.

### Same Final Score
If two agents have identical scores:
- Sorting is stable (order preserved from registration)
- Ties are broken by agent order

---

## Security Considerations

1. **Access Control:** Owner-only functions prevent unauthorized round manipulation
2. **Solvency:** AEGIS Engine enforces sqrt(K) solvency during borrowing
3. **No Cascade Liquidations:** AEGIS guarantee — agents can't liquidate each other
4. **Vault Per Agent:** Each agent has isolated vault (FIX #1) — prevents cross-agent contamination
5. **Explicit Duration:** Cannot hide round length in endTime (FIX #5) — prevents confusion

---

## Deployment Checklist

- [ ] POSITION_MANAGER address set in AegisDeployConfig
- [ ] Arena.sol compiles without errors
- [ ] Deploy to X Layer (chain ID 196)
- [ ] Verify contract address on block explorer
- [ ] Call `roundCount()` — should return 0
- [ ] Register agents (FIX #1: verify vaults created)
- [ ] Start round (FIX #5: verify duration stored)
- [ ] Execute batches
- [ ] Settle round (FIX #4, #7: verify scoring and prizes)

