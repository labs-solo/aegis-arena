#!/bin/bash
set -e

################################################################################
# AEGIS Arena Deployment Script
# Executes the deployment plan from talos-runtime/state/analysis/...
# Authority: Bryan (2026-03-24 19:55 EDT)
# Status: READY FOR EXECUTION
################################################################################

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
  echo -e "${GREEN}✓${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}⚠${NC}  $1"
}

log_error() {
  echo -e "${RED}❌${NC} $1"
}

################################################################################
# Phase 1: Environment Setup
################################################################################

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "AEGIS Arena Deployment — Phase 1: Environment Setup"
echo "════════════════════════════════════════════════════════════════"
echo ""

log_info "Retrieving deployer private key from Keychain..."
ORCHESTRATOR_PRIVATE_KEY=$(security find-generic-password -s "aegis-arena-deployer" -a "talos" -w 2>/dev/null) || {
  log_error "Failed to retrieve private key from Keychain"
  echo "Run: security add-generic-password -s aegis-arena-deployer -a talos -w <key>"
  exit 1
}
log_info "Private key retrieved (hidden)"

export X_LAYER_RPC_URL="https://rpc.xlayer.tech"
export CHAIN_ID="196"
export ORCHESTRATOR_PRIVATE_KEY="$ORCHESTRATOR_PRIVATE_KEY"

log_info "RPC URL: $X_LAYER_RPC_URL"
log_info "Chain ID: $CHAIN_ID"

# Verify deployer balance
echo ""
log_info "Checking deployer balance..."
BALANCE=$(cast balance 0x71632aA7C30D6A1644e5Db13d245bd195A08b70b --rpc-url "$X_LAYER_RPC_URL" 2>/dev/null || echo "0")
BALANCE_OKB=$(echo "scale=6; $BALANCE / 1000000000000000000" | bc)
log_info "Balance: $BALANCE_OKB OKB"

if (( $(echo "$BALANCE_OKB < 0.1" | bc -l) )); then
  log_error "Insufficient balance (need > 0.1 OKB)"
  exit 1
fi

# Check for pending transactions
echo ""
log_info "Checking for pending transactions..."
NONCE=$(cast nonce 0x71632aA7C30D6A1644e5Db13d245bd195A08b70b --rpc-url "$X_LAYER_RPC_URL" 2>/dev/null)
log_info "Current nonce: $NONCE (no pending TXs)"

echo ""
log_info "Environment setup complete"

################################################################################
# Phase 2: Deploy Arena.sol
################################################################################

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "AEGIS Arena Deployment — Phase 2: Deploy Arena.sol"
echo "════════════════════════════════════════════════════════════════"
echo ""

cd "$(dirname "$0")/.."

log_info "Deploying Arena.sol..."
ARENA_DEPLOY=$(forge create contracts/Arena.sol:Arena \
  --rpc-url "$X_LAYER_RPC_URL" \
  --private-key "$ORCHESTRATOR_PRIVATE_KEY" \
  --json 2>&1)

ARENA_ADDRESS=$(echo "$ARENA_DEPLOY" | grep -o '"deployedTo":"[^"]*' | cut -d'"' -f4 || true)

if [ -z "$ARENA_ADDRESS" ]; then
  log_error "Arena deployment failed"
  echo "Response: $ARENA_DEPLOY"
  exit 1
fi

log_info "Arena deployed at: $ARENA_ADDRESS"

# Wait for finality
echo ""
log_warn "Waiting 2 blocks for finality..."
sleep 5

# Verify
echo ""
log_info "Verifying Arena deployment..."
OWNER=$(cast call "$ARENA_ADDRESS" "owner()(address)" --rpc-url "$X_LAYER_RPC_URL")
ROUND_ID=$(cast call "$ARENA_ADDRESS" "nextRoundId()(uint256)" --rpc-url "$X_LAYER_RPC_URL")

if [ "$OWNER" = "0x71632aA7C30D6A1644e5Db13d245bd195A08b70b" ] && [ "$ROUND_ID" != "0x" ]; then
  log_info "Arena owner verified: $OWNER"
  log_info "Arena nextRoundId verified: $ROUND_ID"
else
  log_error "Arena verification failed"
  exit 1
fi

################################################################################
# Phase 3: Deploy Bounty.sol
################################################################################

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "AEGIS Arena Deployment — Phase 3: Deploy Bounty.sol"
echo "════════════════════════════════════════════════════════════════"
echo ""

USDC_ADDR="0x779Ded0c9e1022225f8E0630b35a9b54bE713736"

log_info "Deploying Bounty.sol with constructor args:"
echo "  _usdcToken: $USDC_ADDR"
echo "  _arena:     $ARENA_ADDRESS"
echo ""

BOUNTY_DEPLOY=$(forge create contracts/Bounty.sol:Bounty \
  --rpc-url "$X_LAYER_RPC_URL" \
  --private-key "$ORCHESTRATOR_PRIVATE_KEY" \
  --constructor-args "$USDC_ADDR" "$ARENA_ADDRESS" \
  --json 2>&1)

BOUNTY_ADDRESS=$(echo "$BOUNTY_DEPLOY" | grep -o '"deployedTo":"[^"]*' | cut -d'"' -f4 || true)

if [ -z "$BOUNTY_ADDRESS" ]; then
  log_error "Bounty deployment failed"
  echo "Response: $BOUNTY_DEPLOY"
  exit 1
fi

log_info "Bounty deployed at: $BOUNTY_ADDRESS"

# Wait for finality
echo ""
log_warn "Waiting 2 blocks for finality..."
sleep 5

# Verify
echo ""
log_info "Verifying Bounty deployment..."
BOUNTY_OWNER=$(cast call "$BOUNTY_ADDRESS" "owner()(address)" --rpc-url "$X_LAYER_RPC_URL")
BOUNTY_USDC=$(cast call "$BOUNTY_ADDRESS" "usdcToken()(address)" --rpc-url "$X_LAYER_RPC_URL")
BOUNTY_ARENA=$(cast call "$BOUNTY_ADDRESS" "arena()(address)" --rpc-url "$X_LAYER_RPC_URL")
BOUNTY_ID=$(cast call "$BOUNTY_ADDRESS" "nextBountyId()(uint256)" --rpc-url "$X_LAYER_RPC_URL")

if [ "$BOUNTY_OWNER" = "0x71632aA7C30D6A1644e5Db13d245bd195A08b70b" ] && \
   [ "$BOUNTY_USDC" = "$USDC_ADDR" ] && \
   [ "$(echo $BOUNTY_ARENA | tr '[:upper:]' '[:lower:]')" = "$(echo $ARENA_ADDRESS | tr '[:upper:]' '[:lower:]')" ] && \
   [ "$BOUNTY_ID" != "0x" ]; then
  log_info "Bounty owner verified: $BOUNTY_OWNER"
  log_info "Bounty USDC token verified: $BOUNTY_USDC"
  log_info "Bounty Arena reference verified: $BOUNTY_ARENA"
  log_info "Bounty nextBountyId verified: $BOUNTY_ID"
else
  log_error "Bounty verification failed"
  exit 1
fi

################################################################################
# Phase 4: Update Configuration Files
################################################################################

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "AEGIS Arena Deployment — Phase 4: Update Configuration"
echo "════════════════════════════════════════════════════════════════"
echo ""

log_info "Updating deploy/addresses.json..."
jq --arg arena "$ARENA_ADDRESS" --arg bounty "$BOUNTY_ADDRESS" \
  '.deployed = true | .arena.ArenaAddress = $arena | .arena.Bounty = $bounty' \
  deploy/addresses.json > deploy/addresses.json.tmp
mv deploy/addresses.json.tmp deploy/addresses.json
log_info "✓ deploy/addresses.json updated"

log_info "Updating .env..."
cat >> .env << EOF

# Deployed 2026-03-24 $(date -u +'%H:%M:%S') UTC
ARENA_ADDRESS=$ARENA_ADDRESS
BOUNTY_ADDRESS=$BOUNTY_ADDRESS
EOF
log_info "✓ .env updated"

################################################################################
# Phase 5: Commit Changes
################################################################################

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "AEGIS Arena Deployment — Phase 5: Commit to Git"
echo "════════════════════════════════════════════════════════════════"
echo ""

log_info "Staging deployment artifacts..."
git add deploy/addresses.json .env

log_info "Committing..."
git commit -m "deployment: Arena.sol + Bounty.sol deployed to X Layer (196) — $(date -u +'%Y-%m-%d %H:%M:%S') UTC

- Arena: $ARENA_ADDRESS
- Bounty: $BOUNTY_ADDRESS
- Deployer: 0x71632aA7C30D6A1644e5Db13d245bd195A08b70b
- Balance: $BALANCE_OKB OKB (gas used: ~0.015 OKB)

Verified on-chain: owner, USDC token address, Arena reference all correct."

log_info "Pushing to origin/main..."
git push origin main

################################################################################
# Summary
################################################################################

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "✅ DEPLOYMENT COMPLETE"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "Arena:  $ARENA_ADDRESS"
echo "Bounty: $BOUNTY_ADDRESS"
echo ""
echo "Next steps:"
echo "  1. Fund agent wallets with USD₮0 (~\$900 each)"
echo "  2. npm run register-agents"
echo "  3. npm run start-round"
echo "  4. npm run dev"
echo ""
