/// Base class for all AEGIS Arena agents

import { Signer } from "ethers";
import { GameState, Action, SimulationResult } from "../sdk/types";
import { GatewayClient } from "../sdk/gateway";

/// Abstract base class for agent strategies
export abstract class BaseAgent {
  protected vaultId: string = "";
  protected agentAddress: string;
  protected initialAllocation: bigint;
  protected arenaAddress: string;
  protected signer: Signer;
  protected name: string;
  protected gatewayClient?: GatewayClient;

  constructor(
    name: string,
    agentAddress: string,
    initialAllocation: bigint,
    arenaAddress: string,
    signer: Signer,
    gatewayClient?: GatewayClient
  ) {
    this.name = name;
    this.agentAddress = agentAddress;
    this.initialAllocation = initialAllocation;
    this.arenaAddress = arenaAddress;
    this.signer = signer;
    this.gatewayClient = gatewayClient;
  }

  /// @notice Get agent name (for logging/identification)
  getName(): string {
    return this.name;
  }

  /// @notice Get agent address
  getAddress(): string {
    return this.agentAddress;
  }

  /// @notice Set vault ID (called after vault creation)
  setVaultId(vaultId: string): void {
    this.vaultId = vaultId;
  }

  /// @notice Get vault ID
  getVaultId(): string {
    return this.vaultId;
  }

  /// @notice Decision logic — subclasses implement strategy
  /// @param state Current game state
  /// @returns Array of actions to execute
  abstract decideAction(state: GameState): Promise<Action[]>;

  /// @notice Execute actions with optional simulation via Gateway
  /// WHAT: Simulate TX before broadcast; fall back to direct execution if gateway unavailable
  /// WHY: Prevent failed TXs and improve safety; graceful degradation if gateway is down
  /// @param encodedActions Encoded action bytes to execute
  /// @param roundId Current round ID
  /// @returns TX hash and simulation flag
  protected async executeWithSimulation(
    encodedActions: string[],
    roundId: bigint
  ): Promise<{ txHash: string; simulated: boolean }> {
    // If gateway is unavailable, use direct execution
    if (!this.gatewayClient) {
      console.log(
        `[${this.name}] Gateway not available, proceeding with direct execution`
      );
      return this.executeDirectly(encodedActions, roundId);
    }

    try {
      // Step 1: Build TX params
      const txParams = await this.buildTxParams(encodedActions, roundId);

      // Step 2: Simulate first
      let simResult: SimulationResult;
      try {
        simResult = await this.gatewayClient.simulate({
          chainId: 196, // X Layer
          from: await this.signer.getAddress(),
          to: this.arenaAddress,
          data: txParams.data,
          value: "0x0",
        });
      } catch (e) {
        console.warn(
          `[${this.name}] Gateway simulation unavailable, proceeding direct:`,
          e
        );
        return this.executeDirectly(encodedActions, roundId);
      }

      // Step 3: Check simulation result
      if (!simResult.success) {
        console.warn(
          `[${this.name}] TX simulation failed — skipping broadcast: ${simResult.revertReason || "Unknown revert"}`
        );
        return { txHash: "", simulated: true };
      }

      const gasUsed = simResult.gasUsed
        ? simResult.gasUsed.toString()
        : "unknown";
      console.log(
        `[${this.name}] TX simulation OK — gas used: ${gasUsed}`
      );

      // Step 4: Broadcast via Gateway
      try {
        const signedTx = await this.buildAndSignTx(encodedActions, roundId);
        const broadcastResult = await this.gatewayClient.broadcast({
          signedTx,
          chainId: 196,
        });

        console.log(
          `[${this.name}] TX broadcast successful: ${broadcastResult.txHash}`
        );
        return { txHash: broadcastResult.txHash, simulated: true };
      } catch (e) {
        console.warn(
          `[${this.name}] Gateway broadcast failed, falling back to direct:`,
          e
        );
        return this.executeDirectly(encodedActions, roundId);
      }
    } catch (e) {
      console.error(`[${this.name}] Unexpected error in executeWithSimulation:`, e);
      // Final fallback to direct execution
      return this.executeDirectly(encodedActions, roundId);
    }
  }

  /// @notice Direct execution fallback (no gateway)
  /// WHAT: Execute actions directly on-chain without simulation
  /// WHY: Graceful degradation when gateway is unavailable
  /// @param encodedActions Encoded action bytes
  /// @param roundId Current round ID
  /// @returns TX hash (empty string if execution failed)
  private async executeDirectly(
    encodedActions: string[],
    roundId: bigint
  ): Promise<{ txHash: string; simulated: boolean }> {
    try {
      console.log(
        `[${this.name}] Direct execution: ${encodedActions.length} action(s) for round ${roundId}`
      );

      // TODO: Implement direct Arena.executeBatch() call
      // For MVP: return mock hash
      // In production: construct TX, sign, and submit to Arena contract
      return {
        txHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
        simulated: false,
      };
    } catch (e) {
      console.error(`[${this.name}] Direct execution failed:`, e);
      return { txHash: "", simulated: false };
    }
  }

  /// @notice Build TX params for simulation/broadcast
  /// WHAT: Construct transaction parameters from encoded actions
  /// WHY: Provide consistent TX format for gateway and direct execution
  /// @param encodedActions Encoded action bytes
  /// @param roundId Current round ID
  /// @returns TX params with data field
  protected async buildTxParams(
    encodedActions: string[],
    roundId: bigint
  ): Promise<{ data: string }> {
    // TODO: Implement Arena.executeBatch encoding
    // For MVP: return stub
    // In production: encode function call + parameters
    return {
      data: "0x", // Stub: empty data
    };
  }

  /// @notice Build and sign a transaction
  /// WHAT: Create signed TX for broadcast
  /// WHY: Required for Gateway broadcast call
  /// @param encodedActions Encoded action bytes
  /// @param roundId Current round ID
  /// @returns Signed TX hex string
  protected async buildAndSignTx(
    encodedActions: string[],
    roundId: bigint
  ): Promise<string> {
    // TODO: Implement full TX signing
    // For MVP: return stub
    // In production: build TX object, sign with signer, return serialized TX
    return "0x"; // Stub: empty signed TX
  }

  /// @notice Execute actions via Arena contract
  /// @param roundId Current round
  /// @param actions Actions to execute
  /// @returns Transaction hash
  protected async executeActions(
    roundId: number,
    actions: Action[]
  ): Promise<string> {
    // Implementation in subclasses
    throw new Error("executeActions must be implemented by subclass");
  }

  /// @notice Update game state (query from Arena)
  /// @param roundId Current round
  /// @returns Current game state
  protected async getGameState(roundId: number): Promise<GameState> {
    // Implementation would query Arena contract
    throw new Error("getGameState must be implemented by subclass");
  }
}
