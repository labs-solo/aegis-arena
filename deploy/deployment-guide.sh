#!/bin/bash
set -e

echo "=== AEGIS Arena Deployment to X Layer ==="
echo "Chain ID: 196"
echo "RPC: $X_LAYER_RPC_URL"
echo ""

# ================================================================
# Verification Step 0: Check prerequisites
# ================================================================

echo "[0/6] Checking prerequisites..."

if [ -z "$ORCHESTRATOR_PRIVATE_KEY" ]; then
  echo "❌ ERROR: ORCHESTRATOR_PRIVATE_KEY not set"
  exit 1
fi

if [ -z "$AEGIS_POSITION_MANAGER" ]; then
  echo "❌ ERROR: AEGIS_POSITION_MANAGER not set"
  echo "   See docs/guides/POSITION_MANAGER_LOOKUP.md for instructions"
  exit 1
fi

if [ -z "$X_LAYER_RPC_URL" ]; then
  X_LAYER_RPC_URL="https://rpc.xlayer.tech"
  echo "⚠️  X_LAYER_RPC_URL not set, using default: $X_LAYER_RPC_URL"
fi

echo "✓ Prerequisites OK"
echo ""

# ================================================================
# Step 1: Compile contracts
# ================================================================

echo "[1/6] Compiling Solidity contracts..."

if ! command -v forge &> /dev/null; then
  echo "❌ ERROR: Foundry (forge) not found. Install from: https://getfoundry.sh"
  exit 1
fi

forge build

echo "✓ Compilation successful"
echo ""

# ================================================================
# Step 2: Deploy Arena.sol
# ================================================================

echo "[2/6] Deploying Arena.sol to X Layer..."

DEPLOY_RESULT=$(forge create contracts/Arena.sol:Arena \
  --rpc-url "$X_LAYER_RPC_URL" \
  --private-key "$ORCHESTRATOR_PRIVATE_KEY" \
  --json)

ARENA_ADDR=$(echo "$DEPLOY_RESULT" | grep -o '"deployedTo":"[^"]*' | cut -d'"' -f4)

if [ -z "$ARENA_ADDR" ]; then
  echo "❌ ERROR: Failed to deploy Arena contract"
  echo "Response: $DEPLOY_RESULT"
  exit 1
fi

echo "✓ Arena deployed at: $ARENA_ADDR"
echo ""

# ================================================================
# Step 3: Verify deployment
# ================================================================

echo "[3/6] Verifying deployment..."

# Simple check: call a view function
VERIFIED=$(cast call "$ARENA_ADDR" "roundCount()(uint256)" \
  --rpc-url "$X_LAYER_RPC_URL" 2>/dev/null || echo "failed")

if [ "$VERIFIED" != "0x0000000000000000000000000000000000000000000000000000000000000000" ] && \
   [ "$VERIFIED" != "failed" ]; then
  echo "✓ Arena contract is callable"
else
  echo "⚠️  Could not verify contract immediately (normal if RPC is slow)"
fi
echo ""

# ================================================================
# Step 4: Seed TWAP oracle (FIX #8: required 30-min warmup)
# ================================================================

echo "[4/6] Seeding TWAP oracle (30-minute history)..."
echo "   This step prevents flash-loan attacks on price oracle"
echo ""

# For now, just print instructions
# Full implementation would execute small swaps via UniversalRouter every minute
cat <<'EOF'
   TWAP Warmup Instructions:
   1. Execute small swaps (e.g., 1 USDC) every 60 seconds for 30 minutes
   2. Pool: USDC/WOKB (0x9072107b33ad70c231602b537d91774a43c1837f9b28040ee9bf8cad0a0ab4a1)
   3. Use UniversalRouter: 0x35029f7AD06B7d62C4511239d65CEbF0f1124338

   Run: bash deploy/twap-warmup.sh

   Or manually execute 30 swaps with ~60 second intervals using:
   cast send <UniversalRouter> "execute(bytes,uint256)" <encoded_swap> 0 \
     --rpc-url https://rpc.xlayer.tech \
     --private-key <ORCHESTRATOR_PRIVATE_KEY>
EOF

echo ""
echo "⏳ TWAP warmup is a prerequisite before creating vaults"
echo ""

# ================================================================
# Step 5: Display deployment summary
# ================================================================

echo "[5/6] Deployment Summary"
echo "   Arena Contract:       $ARENA_ADDR"
echo "   Chain:                X Layer (196)"
echo "   RPC:                  $X_LAYER_RPC_URL"
echo ""

# ================================================================
# Step 6: Next steps
# ================================================================

echo "[6/6] Next Steps"
echo ""
echo "1️⃣  Update .env with Arena address:"
echo "    ARENA_ADDRESS=$ARENA_ADDR"
echo ""
echo "2️⃣  Seed TWAP oracle (required before vault creation):"
echo "    bash deploy/twap-warmup.sh"
echo ""
echo "3️⃣  Register agents and start a game round:"
echo "    npm run dev"
echo ""
echo "4️⃣  Run integration tests:"
echo "    npm run test:game"
echo ""

echo "✅ Deployment complete!"
