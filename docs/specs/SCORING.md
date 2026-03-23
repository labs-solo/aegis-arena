# Scoring Model — WOKB→USDC Conversion (FIX #4)

## Problem: Denomination Blindness

Early scoring treated sL shares and tokens separately without converting to a common denomination. This creates unfair ranking:
- Agent A: 1000 sL shares + 100 USDC
- Agent B: 500 sL shares + 1000 USDC

**Who wins?** Impossible to say without converting everything to USDC.

**Solution:** Convert all holdings to USDC at settlement time, then rank fairly.

---

## Conversion Formulas

### 1. sL Shares → USDC

sL shares represent proportional ownership of the USDC/WOKB pool's liquidity.

```
Agent's USDC equivalent = (agentSLBalance / totalSLSupply) × pool_usdc_reserves
```

**Example:**
- Agent has 1000 sL shares
- Total sL supply: 100,000
- Pool USDC reserves: 10M USDC
- **Agent's USDC equivalent:** (1000 / 100,000) × 10M = **100k USDC**

### 2. WOKB → USDC (CRITICAL: sqrtPriceX96 Conversion)

Uniswap v4 stores prices as `sqrtPriceX96` (96-bit fixed point). To convert:

```
sqrtPrice (as number) = current pool.sqrtPrice
price = (sqrtPrice / 2^96)^2
usdcEquivalent = wokb_balance × price
```

**Example with numbers:**
- WOKB held: 10 tokens
- sqrtPriceX96 from pool: 1000000000000000000000000000 (raw)
- sqrtPrice (decimal): 1000000000000000000000000000 / 2^96 ≈ 15259.6
- price: 15259.6^2 ≈ 232,856,640
- WOKB → USDC: 10 × 232,856,640 ≈ 2,328,566,400 USDC

(This is an illustrative example; actual prices will vary.)

### 3. Idle USDC

Idle USDC is already in the target denomination:

```
idle_usdc_value = idle_usdc_balance
```

---

## Complete Scoring Example

### Initial Setup
- Pool: USDC/WOKB (5 bps fee)
- Total sL supply: 100,000 shares
- Pool reserves: 10M USDC, 10k WOKB
- sqrtPriceX96: 1415394265625 (represents ~1 WOKB = 1000 USDC)

### Agent Alpha: Conservative (PassiveLP)
**Holdings at settlement:**
- sL shares: 1000
- Idle USDC: 50,000
- WOKB: 0

**Scoring calculation:**
1. sL → USDC: (1000 / 100,000) × 10M = **100,000 USDC**
2. WOKB → USDC: 0 × price = **0 USDC**
3. Idle USDC: **50,000 USDC**
4. **Total score: 150,000 USDC**

### Agent Beta: Aggressive (TrendFollower)
**Holdings at settlement:**
- sL shares: 2000
- Idle USDC: 0
- WOKB: 100 (borrowed capital deployed)

**Scoring calculation:**
1. sL → USDC: (2000 / 100,000) × 10M = **200,000 USDC**
2. WOKB → USDC: 100 × 1000 = **100,000 USDC** (using price ≈ 1000)
3. Idle USDC: **0 USDC**
4. **Total score: 300,000 USDC**

### Agent Gamma: Market-Neutral (Predator)
**Holdings at settlement:**
- sL shares: 1500
- Idle USDC: 25,000
- WOKB: 50

**Scoring calculation:**
1. sL → USDC: (1500 / 100,000) × 10M = **150,000 USDC**
2. WOKB → USDC: 50 × 1000 = **50,000 USDC**
3. Idle USDC: **25,000 USDC**
4. **Total score: 225,000 USDC**

### Final Ranking
1. **Beta: 300,000 USDC** 🥇 (Winner)
2. **Gamma: 225,000 USDC** 🥈
3. **Alpha: 150,000 USDC** 🥉

---

## Prize Distribution (FIX #7: Dust Handling)

Total prize pool: 1,000 USDC (1,000,000,000 wei at 6 decimals)

### Standard Distribution: 50% / 25% / 25%
```
1st place: 500 USDC
2nd place: 250 USDC
3rd place: 250 USDC
Total: 1000 USDC ✓
```

### Distribution with Dust (3 agents, 101 USDC pool)
```
Base amounts: 101 / 2 = 50 USDC (integer division)
Remainder: 101 % 2 = 1 USDC (dust)

1st place: 50 + 1 = 51 USDC  (gets dust — FIX #7)
2nd place: 50 USDC
3rd place: 0 USDC (or 25% of remainder)
Total: 101 USDC ✓
```

**Rule:** Dust always goes to the highest-ranked agent (winner).

---

## Edge Cases

### Zero sL Balance
If an agent has 0 sL shares but holds idle USDC:
```
score = 0 + idle_usdc_balance + (wokb_balance × price)
```

### Zero Holdings Across All Positions
```
score = 0
agent ranks last
agent receives no prize
```

### Rounding and Precision
- Use 256-bit integer arithmetic (Solidity `uint256`)
- sL share conversions: use pool reserves directly
- sqrtPrice conversions: multiply before dividing to avoid truncation
  - Correct: `(balance × (sqrtPrice / 2^96)^2)`
  - Avoid: `balance × sqrtPrice / 2^96 / 2^96` (loses precision)

---

## Implementation Checklist

- [ ] Query vault sL balances at settlement
- [ ] Query pool USDC reserves
- [ ] Query pool sqrtPriceX96
- [ ] Convert sL → USDC using formula
- [ ] Convert WOKB → USDC using sqrtPrice^2
- [ ] Sum all components
- [ ] Sort agents by final score (descending)
- [ ] Distribute prizes (50% + dust to winner)
- [ ] Emit RoundSettled with scores and prizes

