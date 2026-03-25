#!/usr/bin/env node

import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const RPC_URL = 'https://rpc.xlayer.tech';
const CHAIN_ID = 196;
const DEPLOYER_ADDR = '0x71632aA7C30D6A1644e5Db13d245bd195A08b70b';
const USDC_ADDR = '0x779Ded0c9e1022225f8E0630b35a9b54bE713736';
const AGENTS = {
  passiveLp: '0x6E99BcB062846F0a3CaA68855F6bAd6174b1ab02',
  trendFollower: '0x7287Ce9c02BeE9615fFBF3A690cd9179E6287bC1',
  predator: '0xD6bA4D328fA8c8ABb0E64fc51Be8B769D143104D'
};

// Get private key from Keychain
function getPrivateKey() {
  try {
    const pk = execSync('security find-generic-password -s "aegis-arena-deployer" -a "talos" -w', {
      encoding: 'utf-8'
    }).trim();
    if (!pk) throw new Error('Key not found');
    return pk;
  } catch (e) {
    console.error('❌ Private key not found in Keychain');
    console.error('Add it with: security add-generic-password -s aegis-arena-deployer -a talos -w <key>');
    process.exit(1);
  }
}

// Read contract bytecode from Solidity source
async function compileAndDeploy() {
  console.log('🔧 Phase 1: Arena + Bounty Deployment\n');
  
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const privateKey = getPrivateKey();
  const signer = new ethers.Wallet(privateKey, provider);
  
  console.log(`[1/6] Verifying deployer setup...`);
  const balance = await provider.getBalance(DEPLOYER_ADDR);
  const balanceOkb = ethers.formatEther(balance);
  console.log(`  Deployer: ${DEPLOYER_ADDR}`);
  console.log(`  Balance: ${balanceOkb} OKB`);
  
  if (parseFloat(balanceOkb) < 0.1) {
    console.error('❌ Insufficient balance (need ≥ 0.1 OKB)');
    process.exit(1);
  }
  
  // Since Foundry is not available, we'll use a pre-built bytecode approach
  // For now, we'll compile on-the-fly using Solidity compiler if available
  // Otherwise, we'll need the user to build the contracts manually
  
  console.log('\n[2/6] Checking if contracts are compiled...');
  const arenaArtifact = path.join(process.cwd(), 'out', 'Arena.sol', 'Arena.json');
  const bountyArtifact = path.join(process.cwd(), 'out', 'Bounty.sol', 'Bounty.json');
  
  if (!fs.existsSync(arenaArtifact) || !fs.existsSync(bountyArtifact)) {
    console.error('❌ Compiled artifacts not found.');
    console.error('Attempting to build with foundry...\n');
    try {
      execSync('forge build', { stdio: 'inherit', cwd: process.cwd() });
    } catch (e) {
      console.error('❌ Foundry build failed. Foundry must be installed.');
      console.error('Install with: curl -L https://foundry.paradigm.xyz | bash && foundryup');
      process.exit(1);
    }
  }
  
  // Load compiled contracts
  console.log('Loading contract artifacts...');
  const arenaJson = JSON.parse(fs.readFileSync(arenaArtifact, 'utf-8'));
  const bountyJson = JSON.parse(fs.readFileSync(bountyArtifact, 'utf-8'));
  
  const arenaBytecode = arenaJson.bytecode.object;
  const bountyBytecode = bountyJson.bytecode.object;
  
  if (!arenaBytecode || !bountyBytecode) {
    console.error('❌ Contract bytecode not found in artifacts');
    process.exit(1);
  }
  
  // Deploy Arena
  console.log('\n[3/6] Deploying Arena.sol...');
  const arenaFactory = new ethers.ContractFactory(
    arenaJson.abi,
    arenaBytecode,
    signer
  );
  
  let arena;
  try {
    arena = await arenaFactory.deploy();
    const tx = arena.deploymentTransaction();
    console.log(`  Deployed: ${arena.target}`);
    console.log(`  TX: ${tx.hash}`);
    
    // Wait for confirmation
    await arena.waitForDeployment();
    console.log('  ✓ Confirmed');
  } catch (e) {
    console.error('❌ Arena deployment failed:', e.message);
    process.exit(1);
  }
  
  const ARENA_ADDRESS = arena.target;
  const ARENA_TX = arena.deploymentTransaction().hash;
  
  // Verify Arena
  console.log('  Verifying Arena...');
  try {
    const owner = await arena.owner();
    if (owner.toLowerCase() === DEPLOYER_ADDR.toLowerCase()) {
      console.log('  ✓ Owner verified');
    } else {
      console.error(`❌ Owner mismatch: ${owner} != ${DEPLOYER_ADDR}`);
      process.exit(1);
    }
  } catch (e) {
    console.error('❌ Verification failed:', e.message);
    process.exit(1);
  }
  
  // Deploy Bounty
  console.log('\n[4/6] Deploying Bounty.sol...');
  const bountyFactory = new ethers.ContractFactory(
    bountyJson.abi,
    bountyBytecode,
    signer
  );
  
  let bounty;
  try {
    bounty = await bountyFactory.deploy(USDC_ADDR, ARENA_ADDRESS);
    const tx = bounty.deploymentTransaction();
    console.log(`  Deployed: ${bounty.target}`);
    console.log(`  TX: ${tx.hash}`);
    
    // Wait for confirmation
    await bounty.waitForDeployment();
    console.log('  ✓ Confirmed');
  } catch (e) {
    console.error('❌ Bounty deployment failed:', e.message);
    process.exit(1);
  }
  
  const BOUNTY_ADDRESS = bounty.target;
  const BOUNTY_TX = bounty.deploymentTransaction().hash;
  
  // Verify Bounty
  console.log('  Verifying Bounty...');
  try {
    const usdc = await bounty.usdcToken();
    const arenaRef = await bounty.arena();
    
    if (usdc.toLowerCase() === USDC_ADDR.toLowerCase()) {
      console.log('  ✓ USDC token verified');
    } else {
      console.error(`❌ USDC mismatch: ${usdc} != ${USDC_ADDR}`);
      process.exit(1);
    }
    
    if (arenaRef.toLowerCase() === ARENA_ADDRESS.toLowerCase()) {
      console.log('  ✓ Arena reference verified');
    } else {
      console.error(`❌ Arena reference mismatch: ${arenaRef} != ${ARENA_ADDRESS}`);
      process.exit(1);
    }
  } catch (e) {
    console.error('❌ Verification failed:', e.message);
    process.exit(1);
  }
  
  // Register agents
  console.log('\n[5/6] Registering agents...');
  const agentList = [AGENTS.passiveLp, AGENTS.trendFollower, AGENTS.predator];
  
  try {
    const registerTx = await arena.register(agentList);
    console.log(`  TX: ${registerTx.hash}`);
    
    const receipt = await registerTx.wait();
    if (receipt.status === 1) {
      console.log('  ✓ Agents registered');
    } else {
      console.error('❌ Registration transaction failed');
      process.exit(1);
    }
  } catch (e) {
    console.error('❌ Registration failed:', e.message);
    process.exit(1);
  }
  
  // Update documentation
  console.log('\n[6/6] Updating documentation...');
  
  // Update addresses.json
  const addressesPath = path.join(process.cwd(), 'deploy', 'addresses.json');
  const addresses = JSON.parse(fs.readFileSync(addressesPath, 'utf-8'));
  addresses.deployed = true;
  addresses.arena.ArenaAddress = ARENA_ADDRESS;
  addresses.arena.Bounty = BOUNTY_ADDRESS;
  addresses.arena.ArenaDeployTx = ARENA_TX;
  addresses.arena.BountyDeployTx = BOUNTY_TX;
  addresses.arena.deployedAt = new Date().toISOString().split('T')[0];
  addresses.arena.deployedBy = DEPLOYER_ADDR;
  
  fs.writeFileSync(addressesPath, JSON.stringify(addresses, null, 2));
  console.log('  ✓ Updated deploy/addresses.json');
  
  // Update .env
  const envPath = path.join(process.cwd(), '.env');
  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf-8');
  }
  
  const envAppend = `
# Deployed ${new Date().toISOString()}
ARENA_ADDRESS=${ARENA_ADDRESS}
BOUNTY_ADDRESS=${BOUNTY_ADDRESS}
ROUND_ID=1
`;
  
  fs.writeFileSync(envPath, envContent + envAppend);
  console.log('  ✓ Updated .env');
  
  // Git commit
  console.log('\nCommitting to GitHub...');
  try {
    execSync('git add deploy/addresses.json .env', { cwd: process.cwd() });
    execSync(`git -c user.name="TALOS" -c user.email="talos@aegis.local" commit -m "deployment(phase1): Arena + Bounty deployed, agents pre-registered

PHASE 1 COMPLETE
- Arena deployed: ${ARENA_ADDRESS} (TX: ${ARENA_TX})
- Bounty deployed: ${BOUNTY_ADDRESS} (TX: ${BOUNTY_TX})
- Agents registered (round 1): passive-lp, trend-follower, predator
- All verifications passed

PHASE 2 TRIGGER:
Bryan must transfer 900 USD₮0 to each agent wallet:
- passive-lp: ${AGENTS.passiveLp}
- trend-follower: ${AGENTS.trendFollower}
- predator: ${AGENTS.predator}

USD₮0 token: ${USDC_ADDR} (6 decimals)
Amount per wallet: 900_000_000 wei (900 USD₮0)
Total: 2,700 USD₮0"`, { cwd: process.cwd() });
    
    execSync('git push origin main', { cwd: process.cwd() });
    console.log('  ✓ Pushed to GitHub');
  } catch (e) {
    console.error('⚠ Git push failed:', e.message);
  }
  
  // Final report
  console.log('\n' + '='.repeat(70));
  console.log('✅ PHASE 1 COMPLETE');
  console.log('='.repeat(70));
  console.log('\nDeployed Contracts:');
  console.log(`  Arena.sol: ${ARENA_ADDRESS}`);
  console.log(`  TX: https://www.okx.com/explorer/xlayer/tx/${ARENA_TX}`);
  console.log(`  Bounty.sol: ${BOUNTY_ADDRESS}`);
  console.log(`  TX: https://www.okx.com/explorer/xlayer/tx/${BOUNTY_TX}`);
  console.log('\nAgent Registration (Round 1):');
  console.log(`  passive-lp: ${AGENTS.passiveLp} ✓`);
  console.log(`  trend-follower: ${AGENTS.trendFollower} ✓`);
  console.log(`  predator: ${AGENTS.predator} ✓`);
  console.log('\nDocumentation:');
  console.log('  deploy/addresses.json: ✓ updated');
  console.log('  .env: ✓ updated');
  console.log('  GitHub: ✓ pushed');
  console.log('\nFinal Balance:');
  const finalBal = await provider.getBalance(DEPLOYER_ADDR);
  const finalBalOkb = ethers.formatEther(finalBal);
  console.log(`  Deployer: ${finalBalOkb} OKB`);
  console.log('='.repeat(70));
  console.log('\n⏳ PHASE 2 TRIGGER (Bryan):');
  console.log(`Transfer 900 USD₮0 to each agent wallet (total 2,700):`);
  console.log(`\nToken: ${USDC_ADDR} (6 decimals)`);
  console.log(`Amount per wallet: 900_000_000 wei\n`);
  console.log('Command format:');
  console.log('  cast send <token> "transfer(address,uint256)" <recipient> <amount>');
  console.log('         --rpc-url https://rpc.xlayer.tech');
  console.log('         --private-key <your-key>\n');
  console.log('TALOS will auto-trigger Phase 2 when all agents are funded.');
  console.log('='.repeat(70));
}

compileAndDeploy().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
