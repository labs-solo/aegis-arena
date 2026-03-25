# AEGIS Arena — Live Game Status

> **Last updated:** 2026-03-24 22:02 EDT  
> **Chain:** X Layer Mainnet (Chain ID: 196)

## 🎮 Current Phase: Agents Registered — Awaiting Full Funding

| Phase | Status |
|---|---|
| ✅ Contracts deployed | Arena.sol + Bounty.sol live on X Layer |
| ✅ Agents registered | All 3 agents registered with Arena contract |
| ✅ Passive-LP active | Full-range LP position live on AegisEngine |
| ✅ Trend-follower funded | OKB + USD₮0 transferred; Permit2 approved; **Vault deposit BLOCKED** |
| ⏳ Predator funding | Awaiting USD₮0 transfer |
| ⬜ Game round start | Blocked pending TrendFollower vault deposit |
| ⬜ Agent competition | Pending game start |
| ⬜ Round settlement | Pending competition |

---

## 📋 Verified On-Chain Activity

### Contract Deployments

| Contract | Address | TX | Status |
|---|---|---|---|
| Arena.sol | `0x1e27EE1aa171845CE2523a867Fc5114318916d61` | [View](https://www.okx.com/explorer/xlayer/tx/0xd95991873a4d8713e14b8b188a9abdb3911a89710ddfbb735152e88556d06ad7) | ✅ Live |
| Bounty.sol | `0xc5150bC44A9CAA51A0D50Ab56266F091Db2f5816` | [View](https://www.okx.com/explorer/xlayer/tx/0x3921546eb3535291d6cd9892132f69dc48e91938c592c8f64e1dbf9a69ee454d) | ✅ Live |

### Agent Registration

**TX:** [`0x9e8536b58be5034ae2254e2543558794f6b8721c141d9675863af1db56709d25`](https://www.okx.com/explorer/xlayer/tx/0x9e8536b58be5034ae2254e2543558794f6b8721c141d9675863af1db56709d25)  
**Block:** 55,635,031 | **Status:** ✅ Confirmed

| Agent | Address | Role | Status |
|---|---|---|---|
| PassiveLP | `0x6E99BcB062846F0a3CaA68855F6bAd6174b1ab02` | Full-range LP | ✅ Active (LP deployed) |
| TrendFollower | `0x7287Ce9c02BeE9615fFBF3A690cd9179E6287bC1` | Trend trading | ⏳ Funded (0.17 OKB, 800 USD₮0); **Vault deposit failed** |
| Predator | `0xD6bA4D328fA8c8ABb0E64fc51Be8B769D143104D` | Liquidation hunter | ⏳ Awaiting funding |

### PassiveLP — Live LP Position

**TX:** [`0x6aef90e9ce3d14a27b102460b9c226fca8f100eca250470609145f6a972c0d95`](https://www.okx.com/explorer/xlayer/tx/0x6aef90e9ce3d14a27b102460b9c226fca8f100eca250470609145f6a972c0d95)  
**Block:** 55,686,134 | **Status:** ✅ Confirmed

| Field | Value |
|---|---|
| OKB deployed | 5.1515 OKB |
| USD₮0 deployed | 441.16 USD₮0 |
| Total value | ~$900 |
| Pool | OKB/USD₮0 via AegisHook |
| Tick range | Full range (-887,272 to +887,272) |
| Earning | Trading fees + borrow interest (live) |

> 📊 **[View pool on Uniswap](https://app.uniswap.org/explore/pools/xlayer/0xd5a401023b6ee3ae340bfadb90758385dc9d2463a20dc24e43e913bc7f209cf4)**

---

## 🔍 Verify On-Chain Yourself

```bash
# 1. Check Arena contract is deployed
cast code 0x1e27EE1aa171845CE2523a867Fc5114318916d61 --rpc-url https://rpc.xlayer.tech | wc -c

# 2. Check PassiveLP wallet (should show <0.3 OKB and <10 USD₮0 remaining after deposit)
cast call 0x779Ded0c9e1022225f8E0630b35a9b54bE713736 \
  "balanceOf(address)(uint256)" \
  0x6E99BcB062846F0a3CaA68855F6bAd6174b1ab02 \
  --rpc-url https://rpc.xlayer.tech

# 3. Check pool liquidity (should show non-zero after LP deposit)
cast call 0x76Fd297e2D437cd7f76d50F01AfE6160f86e9990 \
  "getLiquidity(bytes32)(uint128)" \
  0xd5a401023b6ee3ae340bfadb90758385dc9d2463a20dc24e43e913bc7f209cf4 \
  --rpc-url https://rpc.xlayer.tech
```

---

## 📅 Timeline

| Time (EDT) | Event | TX |
|---|---|---|
| 2026-03-24 ~20:20 | Arena + Bounty deployed | [`0xd959...`](https://www.okx.com/explorer/xlayer/tx/0xd95991873a4d8713e14b8b188a9abdb3911a89710ddfbb735152e88556d06ad7) + [`0x3921...`](https://www.okx.com/explorer/xlayer/tx/0x3921546eb3535291d6cd9892132f69dc48e91938c592c8f64e1dbf9a69ee454d) |
| 2026-03-24 ~21:09 | PassiveLP wallet funded (OKB + USD₮0) | — |
| 2026-03-24 ~21:26 | Full-range LP deposited to AegisEngine | [`0x6aef90e9...`](https://www.okx.com/explorer/xlayer/tx/0x6aef90e9ce3d14a27b102460b9c226fca8f100eca250470609145f6a972c0d95) |
| 2026-03-24 ~22:00 | All 3 agents registered with Arena | [`0x9e8536b5...`](https://www.okx.com/explorer/xlayer/tx/0x9e8536b58be5034ae2254e2543558794f6b8721c141d9675863af1db56709d25) |
| 2026-03-24 22:23 | TrendFollower OKB transferred | [`0x5180b0...`](https://www.okx.com/explorer/xlayer/tx/0x5180b014970d3eab75d87dbae613e78c61e8dc4968ef12532a1ff3adb4e25a43) |
| 2026-03-24 22:23 | TrendFollower USD₮0 transferred | [`0x1143f2...`](https://www.okx.com/explorer/xlayer/tx/0x1143f2f96cefdb2cdddd9d8a60fcabe196907c487818a85d8f40429bd5094e23) |
| 2026-03-24 22:23 | TrendFollower Permit2 setup (2 TXs) | [`0x6374...`](https://www.okx.com/explorer/xlayer/tx/0x63748bd5668709d0c9750b2ba301b17bb9fa11abf514eca1d6becc515d1a1e78) + [`0xd1bf...`](https://www.okx.com/explorer/xlayer/tx/0xd1bff6bb402b8c622f219d6f8a16f20f7cce7ce80e3943d0c96f2906928e77de) |
| 2026-03-24 22:24 | TrendFollower vault deposit attempted (**BLOCKED**) | Reverted on 3 attempts; static call passed |
| Pending | TrendFollower deposit diagnosis & retry | — |
| Pending | Predator funded | — |
| Pending | Game round started | — |
| Pending | Agents compete, round settled | — |

---

## 🔧 TrendFollower Vault Deposit — Troubleshooting

**Status:** ❌ Blocked — Deposit transaction reverts on-chain despite passing static call

### Current State (post-funding)
- **TF Balance:** 0.17 OKB, 800 USD₮0
- **Permit2 Approvals:** ✅ In place
- **Calldata Generation:** ✅ Valid (static call succeeded)
- **On-chain Submission:** ❌ Reverted on 3 attempts

### Attempted Configurations

| Attempt | Value (OKB) | Gas Limit | Result | Note |
|---|---|---|---|---|
| 1 | 0 | 2.5M | Reverted | Assumed OPEN_DELTA would work |
| 2 | amount0 (0.152) | 2.5M | Reverted | Sent collateral as tx.value |
| 3 | amount0 (0.152) | 3.0M | Reverted | Increased gas; still reverted |

### Hypothesis & Next Steps

1. **Router action sequence encoding issue**
   - Actions: `0x908080` (MODIFY_LIQUIDITY → SETTLE_AE[OKB] → SETTLE_AE[USDT0])
   - Parameter encoding may not match router's decoder expectations

2. **Possible root cause candidates**
   - Liquidity delta computation off (MIN/MAX_SQRT math)
   - Amount encoding (should amount0Max/amount1Max be token amounts or deltas?)
   - SETTLE_AE payerIsUser flag interaction with OKB native token

3. **Recovery path**
   - Check SDK version and confirm buildDeposit() API signature (if available)
   - Review AegisRouter v1 contract ABI for execute() parameter order
   - Retry with 0 OKB value and all USDT0 as ERC20 transfer (not tx.value)

### Backout Plan

If vault deposit cannot be resolved:
- Funds remain safe in TF wallet (0.17 OKB, 800 USD₮0)
- Permit2 approvals can be revoked
- Alternative: use simpler deposit path or wait for SDK update

---

## 📎 More Details

- [PASSIVE_LP_POSITION.md](./PASSIVE_LP_POSITION.md) — full position details + verification commands
- [README.md](./README.md) — architecture, agent strategies, Bounty Bonds mechanism
- [deploy/addresses.json](./deploy/addresses.json) — all deployed addresses
