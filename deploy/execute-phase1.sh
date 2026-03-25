#!/bin/bash
set -e

echo "=== AEGIS Arena — Phase 1 Execution ==="
echo "Deploy Arena + Bounty contracts and pre-register agents"
echo ""

# Step 1: Environment Setup
echo "[1/6] Setting up environment..."
export X_LAYER_RPC_URL="https://rpc.xlayer.tech"
export CHAIN_ID="196"
export ORCHESTRATOR_PRIVATE_KEY="$(security find-generic-password -s "aegis-arena-deployer" -a "talos" -w)"

if [ -z "$ORCHESTRATOR_PRIVATE_KEY" ]; then
  echo "❌ Private key not found in Keychain"
  echo "Add it with: security add-generic-password -s aegis-arena-deployer -a talos -w <key>"
  exit 1
fi

# Verify balance
echo "Checking deployer balance..."
BALANCE=$(cast balance 0x71632aA7C30D6A1644e5Db13d245bd195A08b70b --rpc-url "$X_LAYER_RPC_URL")
BALANCE_OKB=$(cast from-wei $BALANCE)
echo "Deployer balance: $BALANCE_OKB OKB"

if (( $(echo "$BALANCE_OKB < 0.1" | bc -l) )); then
  echo "❌ Insufficient balance (need ≥ 0.1 OKB)"
  exit 1
fi

# Step 2: Deploy Arena
echo ""
echo "[2/6] Deploying Arena.sol..."
cd /Users/page/Page/repos/aegis-arena

ARENA_DEPLOY=$(forge create contracts/Arena.sol:Arena \
  --rpc-url "$X_LAYER_RPC_URL" \
  --private-key "$ORCHESTRATOR_PRIVATE_KEY" \
  --json)

ARENA_ADDRESS=$(echo "$ARENA_DEPLOY" | jq -r '.deployedTo')
ARENA_TX=$(echo "$ARENA_DEPLOY" | jq -r '.transactionHash')
echo "✓ Arena deployed: $ARENA_ADDRESS"
echo "  TX: $ARENA_TX"

# Verify Arena
echo "Waiting for confirmation..."
sleep 3
OWNER=$(cast call "$ARENA_ADDRESS" "owner()(address)" --rpc-url "$X_LAYER_RPC_URL")
if [ "$OWNER" = "0x71632aA7C30D6A1644e5Db13d245bd195A08b70b" ]; then
  echo "✓ Arena owner verified"
else
  echo "❌ Arena owner mismatch"
  exit 1
fi

# Step 3: Deploy Bounty
echo ""
echo "[3/6] Deploying Bounty.sol..."
USDC_ADDR="0x779Ded0c9e1022225f8E0630b35a9b54bE713736"

BOUNTY_DEPLOY=$(forge create contracts/Bounty.sol:Bounty \
  --rpc-url "$X_LAYER_RPC_URL" \
  --private-key "$ORCHESTRATOR_PRIVATE_KEY" \
  --constructor-args "$USDC_ADDR" "$ARENA_ADDRESS" \
  --json)

BOUNTY_ADDRESS=$(echo "$BOUNTY_DEPLOY" | jq -r '.deployedTo')
BOUNTY_TX=$(echo "$BOUNTY_DEPLOY" | jq -r '.transactionHash')
echo "✓ Bounty deployed: $BOUNTY_ADDRESS"
echo "  TX: $BOUNTY_TX"

# Verify Bounty
echo "Waiting for confirmation..."
sleep 3
USDC_REF=$(cast call "$BOUNTY_ADDRESS" "usdcToken()(address)" --rpc-url "$X_LAYER_RPC_URL")
ARENA_REF=$(cast call "$BOUNTY_ADDRESS" "arena()(address)" --rpc-url "$X_LAYER_RPC_URL")

if [ "$(echo "$USDC_REF" | tr '[:upper:]' '[:lower:]')" = "$(echo $USDC_ADDR | tr '[:upper:]' '[:lower:]')" ]; then
  echo "✓ Bounty USDC token verified"
else
  echo "❌ Bounty USDC token mismatch"
  exit 1
fi

if [ "$(echo "$ARENA_REF" | tr '[:upper:]' '[:lower:]')" = "$(echo $ARENA_ADDRESS | tr '[:upper:]' '[:lower:]')" ]; then
  echo "✓ Bounty Arena reference verified"
else
  echo "❌ Bounty Arena reference mismatch"
  exit 1
fi

# Step 4: Register agents
echo ""
echo "[4/6] Registering agents..."
PASSIVE_LP="0x6E99BcB062846F0a3CaA68855F6bAd6174b1ab02"
TREND_FOLLOWER="0x7287Ce9c02BeE9615fFBF3A690cd9179E6287bC1"
PREDATOR="0xD6bA4D328fA8c8ABb0E64fc51Be8B769D143104D"

REGISTER_DEPLOY=$(cast send "$ARENA_ADDRESS" \
  "register(address[],uint256[])" \
  "[$PASSIVE_LP, $TREND_FOLLOWER, $PREDATOR]" \
  "[501, 777, 999]" \
  --rpc-url "$X_LAYER_RPC_URL" \
  --private-key "$ORCHESTRATOR_PRIVATE_KEY" \
  --json)

REGISTER_TX=$(echo "$REGISTER_DEPLOY" | jq -r '.transactionHash')
echo "✓ Agents registered: TX $REGISTER_TX"

# Verify registrations
echo "Waiting for confirmation..."
sleep 3
for AGENT in "$PASSIVE_LP" "$TREND_FOLLOWER" "$PREDATOR"; do
  VAULT=$(cast call "$ARENA_ADDRESS" "getAgentVault(uint256,address)" "1" "$AGENT" --rpc-url "$X_LAYER_RPC_URL" | tail -1)
  echo "  $AGENT: Vault $VAULT"
done

# Step 5: Update documentation
echo ""
echo "[5/6] Updating documentation..."
jq --arg arena "$ARENA_ADDRESS" --arg bounty "$BOUNTY_ADDRESS" \
  '.deployed = true | .arena.ArenaAddress = $arena | .arena.Bounty = $bounty' \
  deploy/addresses.json > deploy/addresses.json.tmp
mv deploy/addresses.json.tmp deploy/addresses.json
echo "✓ Updated deploy/addresses.json"

cat >> .env << EOF

# Deployed $(date -u +'%Y-%m-%d %H:%M:%S UTC')
ARENA_ADDRESS=$ARENA_ADDRESS
BOUNTY_ADDRESS=$BOUNTY_ADDRESS
ROUND_ID=1
EOF
echo "✓ Updated .env"

# Step 6: Git commit and push
echo ""
echo "[6/6] Committing to GitHub..."
git add deploy/addresses.json .env

git commit -m "deployment(phase1): Arena + Bounty deployed, agents pre-registered

PHASE 1 COMPLETE
- Arena deployed: $ARENA_ADDRESS (TX: $ARENA_TX)
- Bounty deployed: $BOUNTY_ADDRESS (TX: $BOUNTY_TX)
- Agents registered (round 1): passive-lp, trend-follower, predator
- All verifications passed

PHASE 2 TRIGGER:
Bryan must transfer 900 USD₮0 to each agent wallet:
- passive-lp: $PASSIVE_LP
- trend-follower: $TREND_FOLLOWER
- predator: $PREDATOR

USD₮0 token: $USDC_ADDR (6 decimals)
Amount per wallet: 900_000_000 wei (900 USD₮0)
Total: 2,700 USD₮0"

git push origin main
echo "✓ Pushed to GitHub"

echo ""
echo "✅ PHASE 1 COMPLETE — Awaiting Phase 2 Trigger"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "PHASE 2 TRIGGER INSTRUCTIONS FOR BRYAN:"
echo ""
echo "Transfer 900 USD₮0 to each agent wallet (total 2,700):"
echo ""
echo "passive-lp:"
echo "  cast send \\\"$USDC_ADDR\\\" \\\"transfer(address,uint256)\\\" \\\"$PASSIVE_LP\\\" \\\"900000000\\\" \\\\"
echo "  --rpc-url https://rpc.xlayer.tech"
echo ""
echo "trend-follower:"
echo "  cast send \\\"$USDC_ADDR\\\" \\\"transfer(address,uint256)\\\" \\\"$TREND_FOLLOWER\\\" \\\"900000000\\\" \\\\"
echo "  --rpc-url https://rpc.xlayer.tech"
echo ""
echo "predator:"
echo "  cast send \\\"$USDC_ADDR\\\" \\\"transfer(address,uint256)\\\" \\\"$PREDATOR\\\" \\\"900000000\\\" \\\\"
echo "  --rpc-url https://rpc.xlayer.tech"
echo ""
echo "TALOS will monitor balances and auto-start Phase 2 when all funded."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Clean up sensitive data
unset ORCHESTRATOR_PRIVATE_KEY

echo ""
echo "Phase 1 complete. Ready for Phase 2 trigger."
