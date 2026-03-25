# TrendFollower Migration Documentation Index

**Status:** ✅ EXECUTION-READY  
**Version:** 1.0  
**Date:** 2026-03-25  
**Chain:** X Layer (Chain ID 196)  
**Agent:** TrendFollower (`0x7287Ce9c02BeE9615fFBF3A690cd9179E6287bC1`)  
**Vault ID:** 4  

---

## Quick Start

This documentation package contains **everything needed to execute TrendFollower's on-chain migration from initial holdings through final settlement.**

### Two Main Documents

1. **[TRENDFOLLOWER-EXECUTION-RUNBOOK.md](./TRENDFOLLOWER-EXECUTION-RUNBOOK.md)** (948 lines)
   - **Purpose:** Step-by-step operational guide for each migration phase
   - **For:** Operators executing transactions on X Layer
   - **Contains:** Cast commands, ABI encoding, verification scripts, disaster recovery
   - **Status:** Copy-paste ready (`$PRIVATE_KEY` placeholders only)

2. **[TRENDFOLLOWER-TOKEN-FLOW.md](./TRENDFOLLOWER-TOKEN-FLOW.md)** (656 lines)
   - **Purpose:** Visual token movement tracking across all phases
   - **For:** Understanding exactly where tokens go and when
   - **Contains:** ASCII flow diagrams, fee accounting, balance tables
   - **Status:** Complete reference for audit/compliance

---

## Document Structure

### EXECUTION-RUNBOOK Sections

| Section | Purpose | Key Output |
|---------|---------|-----------|
| **Phase 0: Pre-Flight Checks** | Verify initial state | 6 cast commands validating round, vault, balances |
| **Phase 0.5: Token Approvals** | Grant spender permissions | 2 approval transactions (USD₮0, OKB → AegisRouter) |
| **Phase 1: Tap Open** | Open leveraged position | OKX quote → PM_TAKE → arena.executeBatch() |
| **Phase 2: Monitoring** | Track position state | 3 state-check commands (position, execution, status) |
| **Phase 3: Tap Close + Burn** | Exit position & cleanup | OKX exit quote → PM_CLOSE → vault burn |
| **Phase 4: Settlement** | Finalize round & claim bounty | arena.settle() + bounty.claimBounty() |
| **Appendix A** | ABI encoding examples | Solidity pseudocode for PM_TAKE and PM_CLOSE |
| **Appendix B** | Gas estimation | Typical costs per operation (~1.3M gas total, ~$130 on X Layer) |
| **Appendix C** | Disaster recovery | Troubleshooting steps for each failure mode |
| **Appendix D** | Verification script | Bash script for batch state checking |

### TOKEN-FLOW Sections

| Section | Shows |
|---------|-------|
| **Phase 0: Initial State** | Starting balances: 786.97 USD₮0 + 0.016 OKB |
| **Phase 0.5: Approvals** | Allowances set; no token transfer |
| **Phase 1: Tap Open** | USD₮0 swap → OKB, borrow → debt, collateral lock |
| **Phase 2: Maintenance** | Steady state; optional interest/rebalance |
| **Phase 3: Tap Close** | Collateral release → OKB → USD₮0 swap → repay debt |
| **Phase 4: Settlement** | Bounty claim (if eligible) |
| **Summary Table** | All 14 token movements (from→to, token, amount, notes) |
| **Fee Accounting** | Swap fees (~3-5 USD₮0), interest (0.1-1 USD₮0), estimated profit (~4.73 USD₮0) |

---

## Current Holdings (Baseline)

```
TrendFollower Address: 0x7287Ce9c02BeE9615fFBF3A690cd9179E6287bC1
Vault ID: 4

Starting Balances:
  OKB:        0.016 OKB (16,000,000,000,000,000 wei)
  USD₮0:      786.97 USD₮0 (786,970,000 wei, 6 decimals)
  LP Shares:  1,407,624,784,789 (ERC-6909 from pool)

Expected Final Balances (after migration):
  OKB:        0 (all sold back)
  USD₮0:      ~791.7 USD₮0 (initial + ~4.73 profit - fees)
  Vault 4:    BURNED (debt=0, collateral=0)
```

---

## Key Contract Addresses (X Layer)

| Contract | Address | Role |
|----------|---------|------|
| Arena | `0x77189D65156fC82C422F73Ed3c63F4e5F2c00bBA` | Game orchestrator; executeBatch entry point |
| AEGIS Engine | `0x1b0ed1d21b5AB3Db311C1aC386DC874081914935` | Core lending/liquidity |
| AegisRouter | `0xb2830032E19A85e03cDE678FF93Da659C90CAFe5` | Executable routing |
| PositionManager | `0xcF1EAFC6928dC385A342E7C6491d371d2871458b` | Debt/position modifications |
| VaultRegistry | `0xe19414e5C3DB1596f583d18d3Ac5bb43CBabc50D` | Vault tracking |

**RPC:** https://rpc.xlayer.tech

---

## Token Addresses (X Layer)

| Token | Address | Decimals |
|-------|---------|----------|
| OKB (wrapped) | `0xe538905cf8410324e03A5A23C1c177a474D59b2b` | 18 |
| USD₮0 | `0x779Ded0c9e1022225f8E0630b35a9b54bE713736` | 6 |

---

## Execution Checklist (Quick Reference)

### Pre-Flight
- [ ] Round 1 active (`isRoundActive` returns true)
- [ ] TrendFollower registered with vault ID 4
- [ ] Current balances verified (0.016 OKB, 786.97 USD₮0)

### Approvals
- [ ] USD₮0 approved 1,000 to AegisRouter
- [ ] OKB approved 100 to AegisRouter

### Phase 1: Tap Open
- [ ] OKX DEX quote fetched (500 USD₮0 → ~24.85 OKB, 1% slippage)
- [ ] PM_TAKE action encoded
- [ ] executeBatch submitted
- [ ] Balances verified: OKB ≈ 24.866, USD₮0 ≈ 786.97, debt ≈ 500

### Phase 2: Monitoring
- [ ] Position state checked
- [ ] Arena execution state logged

### Phase 3: Tap Close
- [ ] OKX DEX exit quote fetched (24.866 OKB → ~507.23 USD₮0)
- [ ] PM_CLOSE action encoded
- [ ] executeBatch submitted
- [ ] Balances verified: OKB = 0, USD₮0 ≈ 791.7+, debt = 0
- [ ] Vault burned (optional but recommended)

### Phase 4: Settlement
- [ ] Arena.settle() called by owner
- [ ] Final scores queried
- [ ] Bounty claimed (if eligible)

---

## How to Use These Documents

### For First-Time Operators

1. **Read this README** (you are here) — understand the scope and structure
2. **Read EXECUTION-RUNBOOK Phase 0** — verify initial state
3. **Read TOKEN-FLOW: Initial State** — understand starting balances
4. **Execute Phase 0.5 Approvals** — use exact cast commands from runbook
5. **Execute Phase 1** — use OKX quote + runbook PM_TAKE encoding
6. **Monitor Phase 2** — use state-check commands
7. **Execute Phase 3** — mirror Phase 1 but with exit path
8. **Execute Phase 4** — settle round and claim bounty

### For Code Review

1. **Read EXECUTION-RUNBOOK Appendix A** — verify ABI encoding examples
2. **Cross-reference EXECUTION-RUNBOOK with CONTRACT code** — ensure action opcodes match AegisDeployConfig.sol
3. **Review TOKEN-FLOW fee accounting** — validate swap fee assumptions

### For Disaster Recovery

1. **Consult EXECUTION-RUNBOOK Appendix C** — pick your failure mode
2. **Follow troubleshooting steps** — diagnose and resubmit
3. **Reference TOKEN-FLOW** — understand what state should be after each phase

---

## Key Takeaways

### Architecture
- **Arena.executeBatch()** is the entry point for all TrendFollower actions
- **PositionManager** manages vault debt and collateral (opcodes 0xC0, 0xC2)
- **AegisRouter** executes swaps and routing (receives PM opcode payloads)
- **OKX DEX API** provides quote-first swap routing (not Uniswap direct)

### Token Flow
1. **Phase 1:** Borrow USD₮0 → swap to OKB → lock as collateral
2. **Phase 3:** Release collateral → swap OKB to USD₮0 → repay debt
3. **Net:** Arbitrage profit if price moves favorably during position hold

### Critical Sequences
- **Approvals must precede all swaps** (Phase 0.5 before Phase 1)
- **PM_CLOSE repayment must clear full debt + interest** (use exit quote amount)
- **Vault burn only after debt=0 and collateral=0** (state cleanup; no token movement)

---

## Safety Notes

⚠️ **Before Execution:**

1. **Test on testnet first** — don't execute mainnet without dry-run
2. **Verify deployer key is `security find-generic-password -s "aegis-arena-deployer" -a "talos" -w`** — never commit keys
3. **Check round is active** — use cast before submitting actions
4. **Validate OKX quotes are fresh** — quotes expire ~30 seconds; fetch just before use
5. **Use $PRIVATE_KEY placeholder** — substitute only at execution time

⚠️ **During Execution:**

1. **Monitor gas prices** — set reasonable gasPrice parameter
2. **Check slippage tolerance** — 1% default; increase to 2% if swaps keep failing
3. **Verify receipts after each phase** — don't assume success; read balances
4. **Log transaction hashes** — needed for debugging if something goes wrong

---

## Related Documents

- **Arena.sol** — Smart contract source for executeBatch logic
- **IArena.sol** — Interface defining all public Arena functions
- **AegisDeployConfig.sol** — Opcode definitions and contract addresses
- **agent-trend-follower.ts** — SDK-level agent implementation
- **okx-dex.ts** — OKX DEX quote/swap client

---

## Questions & Issues

| Issue | See |
|-------|-----|
| "Round not found" error | Phase 0.2 — verify round ID is correct |
| "Agent not registered" error | Phase 0.3 — verify vault ID 4 is registered for TrendFollower |
| Swap fails with slippage | Phase 1.4 — increase slippage tolerance in quote |
| Vault burn fails | Phase 3.5 — ensure debt=0 and collateral=0 |
| Bounty not claimable | Phase 4.3 — check bounty conditions in Bounty contract |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-03-25 | Initial release; complete runbook + token flow diagrams |

---

## Approval & Authority

- **Authored by:** TALOS Research
- **Authority chain:** Bryan → Page → TALOS → talos-research
- **Scope:** TrendFollower on-chain migration on X Layer (Chain 196)
- **Status:** ✅ EXECUTION-READY

---

**For questions or updates, consult the main `aegis-arena` repository or contact TALOS research team.**

Last updated: 2026-03-25 18:00 UTC
