/// Base class for all AEGIS Arena agents

import { Signer } from "ethers";
import { GameState, Action } from "../sdk/types";

/// Abstract base class for agent strategies
export abstract class BaseAgent {
  protected vaultId: string = "";
  protected agentAddress: string;
  protected initialAllocation: bigint;
  protected arenaAddress: string;
  protected signer: Signer;
  protected name: string;

  constructor(
    name: string,
    agentAddress: string,
    initialAllocation: bigint,
    arenaAddress: string,
    signer: Signer
  ) {
    this.name = name;
    this.agentAddress = agentAddress;
    this.initialAllocation = initialAllocation;
    this.arenaAddress = arenaAddress;
    this.signer = signer;
  }

  /// @notice Get agent name
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
