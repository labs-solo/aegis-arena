# Scoring Model — WOKB→USDC Conversion (FIX #4)

## Problem: Denomination Blindness

Early scoring treated sL shares and tokens separately without converting to a common denomination. This creates unfair ranking:
- Agent A: 1000 sL shares + 100 USDC
- Agent B: 500 sL shares + 1000 USDC

**Who wins?** Impossible to say without converting everything to USDC.

**Solution:** Convert all holdings to USDC at settlement time, then rank fairly.

---

## Conversion Formulas

### 1. sL Shares → USD₮0

sL shares represent proportional ownership of the OKB/USD₮0 pool's liquidity.

```
Agent's USD₮0 equivalent = (agentSLBalance / totalSLSupply) × pool_usd_t0_reserves
```

**Example:**
- Agent has 1000 sL shares
- Total sL supply: 100,000
- Pool USD₮0 reserves: 10M USD₮0
- **Agent's USD₮0 equivalent:** (1000 / 100,000) × 10M = **100k USD₮0**

### 2. OKB → USD₮0 (CRITICAL: sqrtPriceX96 Conversion)

Uniswap v4 stores prices as `sqrtPriceX96` (96-bit fixed point). To convert correctly:

```
Correct: FullMath.mulDiv(sqrtPriceX96, sqrtPriceX96, 1 << 192) (Solidity)
         or scaled BigInt (TypeScript). See ARENA_CONTRACT.md for full details.
```

**Illustrative example with decimal approximation:**
- OKB held: 10 tokens
- sqrtPriceX96 from pool: 1000000000000000000000000000 (raw)
- sqrtPrice (decimal): 1000000000000000000000000000 / 2^96 ≈ 15259.6
- price: 15259.6^2 ≈ 232,856,640
- OKB → USD₮0: 10 × 232,856,640 ≈ 2,328,566,400 USD₮0

*Note: the above is a decimal illustration. In Solidity uint256 arithmetic, use
`FullMath.mulDiv(sqrtPriceX96, sqrtPriceX96, 1 << 192)` to avoid truncation and overflow.
See ARENA_CONTRACT.md for the complete precision-correct approach.*

(This is an illustrative example; actual prices will vary.)

### 3. Idle USDC

Idle USDC is already in the target denomination:

```
idle_usdc_value = idle_usdc_balance
```

---

## Complete Scoring Example

### Initial Setup
- Pool: OKB/USD₮0 (dynamic fee, AEGIS Hook)
- Total sL supply: 100,000 shares
- Pool reserves: 10M USD₮0, 10k OKB
- sqrtPriceX96: 1583421913... (representative for OKB at ~20 USD₮0)

### Agent Alpha: Conservative (PassiveLP)
**Holdings at settlement:**
- sL shares: 1000
- Idle USD₮0: 50,000
- OKB: 0

**Scoring calculation:**
1. sL → USD₮0: (1000 / 100,000) × 10M = **100,000 USD₮0**
2. OKB → USD₮0: 0 × price = **0 USD₮0**
3. Idle USD₮0: **50,000 USD₮0**
4. **Total score: 150,000 USD₮0**

### Agent Beta: Aggressive (TrendFollower)
**Holdings at settlement:**
- sL shares: 2000
- Idle USD₮0: 0
- OKB: 100 (borrowed capital deployed)

**Scoring calculation:**
1. sL → USD₮0: (2000 / 100,000) × 10M = **200,000 USD₮0**
2. OKB → USD₮0: 100 × 1000 = **100,000 USD₮0** (using price ≈ 1000)
3. Idle USD₮0: **0 USD₮0**
4. **Total score: 300,000 USD₮0**

### Agent Gamma: Market-Neutral (Predator)
**Holdings at settlement:**
- sL shares: 1500
- Idle USD₮0: 25,000
- OKB: 50

**Scoring calculation:**
1. sL → USD₮0: (1500 / 100,000) × 10M = **150,000 USD₮0**
2. OKB → USD₮0: 50 × 1000 = **50,000 USD₮0**
3. Idle USD₮0: **25,000 USD₮0**
4. **Total score: 225,000 USD₮0**

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
- sqrtPrice conversions: use `FullMath.mulDiv(sqrtPriceX96, sqrtPriceX96, 1 << 192)` (Solidity) or scaled BigInt (TypeScript)
  - See ARENA_CONTRACT.md for complete precision-correct approach
  - Avoid: `(balance × (sqrtPrice / 2^96)^2)` — truncates to 0 in integer arithmetic
  - Avoid: `balance × sqrtPrice / 2^96 / 2^96` — loses precision

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

