// src/orchestrator/game-loop.ts
// THE MISSING PIECE — GameOrchestrator is the sole owner of all side effects.
//
// CP-018 CRITICAL: The signer address must be authorized as a relayer in Arena.sol
// via Arena.setRelayer(signerAddress, true) before executeBatch() will succeed.

import { ethers } from "ethers";
import { ArenaClient } from "../contracts/arena.js";
import { BountyClient } from "../contracts/bounty.js";
import {
  OrchestratorConfig,
  TickResult,
  AgentTickResult,
  GameState,
  ReceiptInfo,
} from "./types.js";

export class GameOrchestrator {
  private arenaClient: ArenaClient;
  private bountyClient: BountyClient;
  private agents: OrchestratorConfig["agents"];
  private signer: ethers.Signer;
  private provider: ethers.Provider;
  private gatewayUrl: string;

  constructor(config: OrchestratorConfig) {
    this.signer = config.signer;
    this.provider = config.provider;
    this.gatewayUrl = config.gatewayUrl ?? "https://www.okx.com/web3/build/dev-tools/pre-execution";
    this.agents = config.agents;

    // Orchestrator creates clients — agents never touch these
    this.arenaClient = new ArenaClient(config.arenaAddress, config.signer);
    this.bountyClient = new BountyClient(
      config.provider,
      config.signer,
      config.bountyAddress,
      config.usdTokenAddress
    );
  }

  /**
   * Execute one round tick: for each agent — decide → simulate → submit
   *
   * CP-018 NOTE: executeBatch() will revert if this.signer is not an
   * authorized relayer in Arena.sol. Call Arena.setRelayer(signer.address, true)
   * before running the first tick.
   */
  async tick(roundId: number): Promise<TickResult> {
    const blockNumber = await this.provider.getBlockNumber();
    const result: TickResult = {
      roundId,
      blockNumber,
      agentResults: new Map(),
    };

    // Get round data from Arena
    let roundData: Awaited<ReturnType<ArenaClient["getRoundData"]>>;
    try {
      roundData = await this.arenaClient.getRoundData(roundId);
    } catch (e) {
      console.error(`[Orchestrator] Failed to get round data for round ${roundId}:`, e);
      return result;
    }

    for (const agent of this.agents) {
      const agentAddress = agent.getAddress();
      const agentResult: AgentTickResult = {
        agentAddress,
        encodedActions: [],
        simulated: false,
        executed: false,
      };

      try {
        // Get agent's vault ID from Arena
        const agentVaultId = await this.arenaClient.getAgentVaultId(roundId, agentAddress);

        // Build GameState for this agent
        const gameState: GameState = {
          roundId,
          blockNumber,
          timestamp: roundData.startTime + roundData.roundDuration,
          agentAddress,
          agentVaultId,
          poolState: {
            sqrtPriceX96: 0n, // Phase 2: query pool contract
            tick: 0,
            liquidity: 0n,
          },
          agentBalances: {
            wokb: 0n, // Phase 2: query vault balances
            usdt0: 0n,
            idle: 0n,
          },
          roundEndTime: roundData.endTime,
          roundEndBlock: roundData.endBlock,
        };

        // Agent returns encoded bytes[]
        const encodedActions = await agent.decideActions(gameState);
        agentResult.encodedActions = encodedActions;

        console.log(
          `[Orchestrator] Agent ${agentAddress.slice(0, 8)} decided ${encodedActions.length} actions`
        );

        if (encodedActions.length === 0) {
          result.agentResults.set(agentAddress, agentResult);
          continue;
        }

        // Simulate via Gateway (optional; skip if unavailable)
        const simOk = await this.simulateActions(agentAddress, encodedActions);
        agentResult.simulated = simOk;

        if (!simOk) {
          console.warn(`[Orchestrator] Agent ${agentAddress.slice(0, 8)} simulation failed; skipping`);
          result.agentResults.set(agentAddress, agentResult);
          continue;
        }

        // Submit via Arena.executeBatch() (relayer-authenticated)
        // CP-018: will revert if signer is not authorized relayer
        const submitResult = await this.arenaClient.executeBatch(
          roundId,
          agentAddress,
          encodedActions
        );

        agentResult.executed = true;
        agentResult.txHash = submitResult.txHash;

        console.log(
          `[Orchestrator] Agent ${agentAddress.slice(0, 8)} submitted tx ${submitResult.txHash}`
        );

        // Notify agent
        const receiptInfo: ReceiptInfo = {
          transactionHash: submitResult.txHash,
          blockNumber: await this.provider.getBlockNumber(),
          actions: encodedActions,
        };
        agent.onReceipt(receiptInfo);
      } catch (e) {
        agentResult.error = String(e);
        console.error(`[Orchestrator] Agent ${agentAddress.slice(0, 8)} error:`, e);
      }

      result.agentResults.set(agentAddress, agentResult);
    }

    return result;
  }

  /**
   * Manually submit an action (used by server routes POST /api/agent/action)
   */
  async submitAction(req: {
    roundId: number;
    agentId: string;
    actions: string[];
  }): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      const agent = this.agents.find((a) => a.getAddress() === req.agentId);
      if (!agent) {
        return { success: false, error: `Agent not found: ${req.agentId}` };
      }

      const simOk = await this.simulateActions(req.agentId, req.actions);
      if (!simOk) {
        return { success: false, error: "Simulation failed" };
      }

      // CP-018: will revert if signer is not authorized relayer
      const submitResult = await this.arenaClient.executeBatch(
        req.roundId,
        req.agentId,
        req.actions
      );

      const blockNumber = await this.provider.getBlockNumber();
      agent.onReceipt({
        transactionHash: submitResult.txHash,
        blockNumber,
        actions: req.actions,
      });

      return { success: true, txHash: submitResult.txHash };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  /**
   * Get BountyClient for use by server routes
   */
  getBountyClient(): BountyClient {
    return this.bountyClient;
  }

  /**
   * Simulate encoded actions via OKX Gateway
   * Returns true if simulation passes or gateway is unavailable (fail-open for MVP)
   */
  private async simulateActions(
    agentAddress: string,
    encodedActions: string[]
  ): Promise<boolean> {
    try {
      const signerAddress = await this.signer.getAddress();

      const payload = {
        chainId: "196", // X Layer
        from: signerAddress,
        to: this.arenaClient.getAddress(),
        data: this.arenaClient.encodeExecuteBatch(0, agentAddress, encodedActions),
        value: "0x0",
      };

      const resp = await fetch(this.gatewayUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000),
      });

      if (!resp.ok) {
        console.warn(`[Orchestrator] Gateway returned ${resp.status}; proceeding without simulation`);
        return true; // fail-open for MVP
      }

      const result = await resp.json() as { success?: boolean; revertReason?: string };
      return result.success !== false;
    } catch (e) {
      console.warn("[Orchestrator] Gateway simulation unavailable; proceeding:", String(e).slice(0, 80));
      return true; // fail-open: gateway failure doesn't block execution in MVP
    }
  }
}
