# AEGIS PositionManager Address Reference

**PositionManager Address:** `0xcF1EAFC6928dC385A342E7C6491d371d2871458b`

This is the confirmed PositionManager address from AEGIS Engine PR #18 (`trail-of-bits-audit-fixes-and-improvements`) deployed on X Layer (Chain 196).

## Why PositionManager Matters

The PositionManager is a critical AEGIS Engine contract that:
- Manages debt modifications safely (with temporary unlock pattern)
- Prevents cascade liquidations via sqrt(K) solvency model
- Must be correctly configured in `AegisDeployConfig.sol` before deployment

## Method 1: Check PR #18 Directly (Fastest)

1. Navigate to: https://github.com/labs-solo/aegis-engine
2. Go to **Pull Requests** tab
3. Find **PR #18**: `trail-of-bits-audit-fixes-and-improvements`
4. Look for:
   - Deployment artifacts in commit messages
   - Contract deployment addresses in comments
   - `addresses.json` or similar config files in `/deployments/` or `/config/`
5. Extract the PositionManager address

Example search in PR:
```
grep -r "PositionManager" .
grep -r "0x" deploy/ deployments/ addresses.json
```

## Method 2: Query X Layer Chain (If PR #18 is Deployed)

If PR #18 has already been deployed to X Layer, query the contract registry:

```bash
# Set your RPC
export X_LAYER_RPC="https://rpc.xlayer.tech"

# Look for AEGIS contracts
cast call 0x360e68faCcca8cA495c1B759Fd9EEe466db9FB32 "positionManager()(address)" \
  --rpc-url $X_LAYER_RPC
```

Or check the StateView contract:

```bash
cast call 0x76fd297e2d437cd7f76d50f01afe6160f86e9990 "positionManager()(address)" \
  --rpc-url $X_LAYER_RPC
```

## Method 3: Clone aegis-engine and Check Artifacts

1. Clone the repo:
   ```bash
   git clone https://github.com/labs-solo/aegis-engine.git
   cd aegis-engine
   ```

2. Checkout the correct branch:
   ```bash
   git checkout trail-of-bits-audit-fixes-and-improvements
   ```

3. Look for deployment artifacts:
   ```bash
   # Foundry deployments
   ls -la broadcast/
   find . -name "*.json" | grep -i address
   
   # Hardhat deployments
   ls -la deployments/
   
   # Check deployment scripts
   find contracts/script -name "*.sol"
   grep -r "PositionManager" .
   ```

4. Check `DeployAegis.s.sol` or similar:
   ```bash
   grep "address.*PositionManager" contracts/script/DeployAegis.s.sol
   ```

## Method 4: Check aegis-arena Documentation

Once AEGIS Arena is deployed, the PositionManager address is documented in:
- `deploy/addresses.json` (updated after deployment)
- `.env.example` (instructions)
- Arena.sol contract deployment notes

## Once You Find the Address

### 1. Update `contracts/AegisDeployConfig.sol`

```solidity
// BEFORE (placeholder)
address public constant POSITION_MANAGER = address(0);

// AFTER (with actual address from PR #18)
address public constant POSITION_MANAGER = 0x1234567890123456789012345678901234567890;
```

### 2. Update `.env`

```bash
AEGIS_POSITION_MANAGER=0x1234567890123456789012345678901234567890
```

### 3. Rebuild and Redeploy

```bash
npm run build:contracts
npm run deploy
```

## Verification

To verify the address is correct:

```bash
export X_LAYER_RPC="https://rpc.xlayer.tech"
export PM_ADDRESS="0x..."  # Your PositionManager address

# Check that it's a contract (has code)
cast code $PM_ADDRESS --rpc-url $X_LAYER_RPC | wc -c

# Should return something > 2 (more than just "0x")
# If it returns 2, the address is wrong (EOA or doesn't exist)
```

## If You're Still Stuck

1. Check the aegis-engine repo's README for deployment instructions
2. Look at CI/CD workflows (`.github/workflows/`) for deployment steps
3. Check the Trail of Bits audit report for referenced addresses
4. Ask in the GitHub issue or discussions

## Common Pitfalls

- ❌ Using PoolManager address (0x360e68...) — that's NOT PositionManager
- ❌ Using an address from a different network (not X Layer)
- ❌ Using an address from an older PR branch
- ✅ Cross-check with `contracts/AegisDeployConfig.sol` comments
- ✅ Verify address is a contract (has bytecode on X Layer)
- ✅ Ensure address is from PR #18 specifically

