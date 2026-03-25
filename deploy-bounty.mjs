import fs from 'fs';
import { ethers } from 'ethers';
import { execSync } from 'child_process';

const RPC = 'https://rpc.xlayer.tech';
const USDC = '0x779Ded0c9e1022225f8E0630b35a9b54bE713736';
const ARENA = '0x1e27EE1aa171845CE2523a867Fc5114318916d61';

async function deploy() {
  const pk = execSync('security find-generic-password -s "aegis-arena-deployer" -a "talos" -w', {encoding: 'utf-8'}).trim();
  const provider = new ethers.JsonRpcProvider(RPC);
  const signer = new ethers.Wallet(pk, provider);
  
  const artifact = JSON.parse(fs.readFileSync('contracts/out/Bounty.sol/Bounty.json', 'utf-8'));
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode.object, signer);
  
  console.log('Deploying Bounty...');
  const bounty = await factory.deploy(USDC, ARENA);
  console.log(`Deployed: ${bounty.target}`);
  console.log(`TX: ${bounty.deploymentTransaction().hash}`);
  
  await bounty.waitForDeployment();
  console.log('✓ Confirmed');
}

deploy().catch(e => { console.error(e); process.exit(1); });
