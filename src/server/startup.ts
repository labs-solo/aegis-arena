// src/server/startup.ts
// Bootstrap: creates provider, signer, agents, orchestrator, server.

import { ethers } from "ethers";
import { GameOrchestrator } from "../orchestrator/game-loop.js";
import { AgentPassiveLP } from "../agents/agent-passive-lp.js";
import { AgentTrendFollower } from "../agents/agent-trend-follower.js";
import { AgentPredator } from "../agents/agent-predator.js";
import { BountyClient } from "../contracts/bounty.js";
import { ArenaClient } from "../contracts/arena.js";
import { CONFIG } from "../config/index.js";
import { createServer } from "./index.js";

export async function createGameLoop(): Promise<GameOrchestrator> {
  const provider = new ethers.JsonRpcProvider(CONFIG.rpcUrl);
  const signer = new ethers.Wallet(CONFIG.privateKey, provider);
  const signerAddress = await signer.getAddress();

  console.log(`[Startup] Signer (relayer) address: ${signerAddress}`);
  console.log(`[Startup] Arena: ${CONFIG.arenaAddress}`);
  console.log(`[Startup] Bounty: ${CONFIG.bountyAddress}`);

  // CP-018 DEPLOYMENT CHECK: verify signer is authorized relayer
  const arenaClient = new ArenaClient(CONFIG.arenaAddress, signer);
  const isRelayer = await arenaClient.isAuthorizedRelayer(signerAddress).catch(() => null);
  if (isRelayer === false) {
    console.warn(
      `[Startup] WARNING: Signer ${signerAddress} is NOT an authorized relayer in Arena.sol.\n` +
      `[Startup] Run: Arena.setRelayer("${signerAddress}", true) before executeBatch() calls will succeed.\n` +
      `[Startup] Continuing startup — executeBatch() will revert until setRelayer() is called.`
    );
  } else if (isRelayer === true) {
    console.log(`[Startup] ✅ Signer is authorized relayer`);
  }

  // Create agents (injecting provider — read-only for balance checks)
  const agents = [
    new AgentPassiveLP(
      process.env.AGENT_PASSIVE_LP_ADDRESS ?? "0x1111111111111111111111111111111111111111",
      provider
    ),
    new AgentTrendFollower(
      process.env.AGENT_TREND_FOLLOWER_ADDRESS ?? "0x2222222222222222222222222222222222222222",
      provider
    ),
    new AgentPredator(
      process.env.AGENT_PREDATOR_ADDRESS ?? "0x3333333333333333333333333333333333333333",
      provider
    ),
  ];

  const bountyClient = new BountyClient(provider, signer, CONFIG.bountyAddress, CONFIG.usdToken);

  const orchestrator = new GameOrchestrator({
    provider,
    signer,
    arenaAddress: CONFIG.arenaAddress,
    bountyAddress: CONFIG.bountyAddress,
    usdTokenAddress: CONFIG.usdToken,
    agents,
  });

  const app = createServer(orchestrator, bountyClient);

  app.listen(CONFIG.port, () => {
    console.log(`[Server] Listening on port ${CONFIG.port}`);
    console.log(`[Server] Health: http://localhost:${CONFIG.port}/health`);
  });

  return orchestrator;
}

if (require.main === module) {
  createGameLoop().catch((e) => {
    console.error("[Startup] Fatal:", e);
    process.exit(1);
  });
}
