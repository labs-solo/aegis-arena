/// Base class for all AEGIS Arena agents

import { Contract, Interface, Signer } from "ethers";
import { GameState, Action, SimulationResult, AgentVaultBindingReader } from '../sdk/types.js';
import { GatewayClient } from '../sdk/gateway.js';

const arenaInterface = new Interface([
  "function executeBatch(uint256 roundId, address agent, bytes[] actions)",
]);

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

  /// @notice Bind the registered vault ID assigned by the orchestrator
  bindRegisteredVaultId(vaultId: string): void {
    if (!vaultId || vaultId === "0" || vaultId === "0x0") {
      throw new Error(`[${this.name}] invalid registered vault ID`);
    }
    this.vaultId = vaultId;
  }

  /// @notice Set vault ID (backwards-compatible alias)
  setVaultId(vaultId: string): void {
    this.bindRegisteredVaultId(vaultId);
  }

  /// @notice Get vault ID
  getVaultId(): string {
    return this.vaultId;
  }

  /// @notice Read the registered vault ID from Arena and bind it locally
  async bindRegisteredVaultIdFromArena(
    roundId: bigint,
    arenaClient: AgentVaultBindingReader
  ): Promise<string> {
    const vaultId = await arenaClient.getAgentVault(roundId, this.agentAddress);
    if (vaultId <= 0n) {
      throw new Error(
        `[${this.name}] no registered vault ID found on Arena for round ${roundId.toString()}`
      );
    }

    const normalizedVaultId = vaultId.toString();
    this.bindRegisteredVaultId(normalizedVaultId);
    return normalizedVaultId;
  }

  protected requireRegisteredVaultId(): string {
    if (!this.vaultId) {
      throw new Error(
        `[${this.name}] registered vault ID not bound; orchestrator must provision and bind Arena vault IDs first`
      );
    }
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

      this.requireRegisteredVaultId();

      const arenaContract = new Contract(
        this.arenaAddress,
        arenaInterface.fragments,
        this.signer
      );
      const tx = await arenaContract.executeBatch(
        roundId,
        this.agentAddress,
        encodedActions
      );
      const receipt = await tx.wait();

      return {
        txHash: receipt?.hash ?? tx.hash ?? "",
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
    this.requireRegisteredVaultId();

    return {
      data: arenaInterface.encodeFunctionData("executeBatch", [
        roundId,
        this.agentAddress,
        encodedActions,
      ]),
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
    const txParams = await this.buildTxParams(encodedActions, roundId);
    const signerLike = this.signer as Signer & {
      getNonce?: () => Promise<number>;
      provider?: {
        getNetwork?: () => Promise<{ chainId: bigint | number }>;
        getFeeData?: () => Promise<{
          maxFeePerGas?: bigint | null;
          maxPriorityFeePerGas?: bigint | null;
        }>;
      } | null;
    };

    const from = await this.signer.getAddress();
    const nonce = typeof signerLike.getNonce === "function"
      ? await signerLike.getNonce()
      : undefined;
    const network = typeof signerLike.provider?.getNetwork === "function"
      ? await signerLike.provider.getNetwork()
      : undefined;
    const feeData = typeof signerLike.provider?.getFeeData === "function"
      ? await signerLike.provider.getFeeData()
      : undefined;

    const tx = {
      to: this.arenaAddress,
      from,
      data: txParams.data,
      nonce,
      chainId: network ? Number(network.chainId) : 196,
      gasLimit: 1_500_000n,
      maxFeePerGas: feeData?.maxFeePerGas ?? undefined,
      maxPriorityFeePerGas: feeData?.maxPriorityFeePerGas ?? undefined,
      type:
        feeData?.maxFeePerGas != null || feeData?.maxPriorityFeePerGas != null
          ? 2
          : undefined,
    };

    const signedTx = await this.signer.signTransaction(tx);
    return signedTx || "0x";
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
