// src/agents/base-agent.ts
// CP-020: Type system fix (SRC-HIGH-02)
// - decideAction(state) → decideActions(state): Promise<string[]>
// - Removed: signer, arenaAddress, gatewayClient (orchestrator owns these)
// - Added: onReceipt() callback

import { GameState, ReceiptInfo } from "../orchestrator/types.js";

export abstract class BaseAgent {
  protected name: string;
  protected agentAddress: string;

  constructor(name: string, agentAddress: string) {
    this.name = name;
    this.agentAddress = agentAddress;
  }

  getName(): string { return this.name; }
  getAddress(): string { return this.agentAddress; }

  /**
   * Core agent interface: receive game state, return encoded action bytes.
   *
   * CP-020 FIX (SRC-HIGH-02):
   * - Returns Promise<string[]> (ABI-encoded hex bytes), not Action[]
   * - Encoding happens inside decideActions()
   * - Return empty array to skip this tick
   */
  abstract decideActions(state: GameState): Promise<string[]>;

  /**
   * Called by orchestrator after action execution receipt.
   * Override to update internal agent state.
   */
  onReceipt(receipt: ReceiptInfo): void {
    console.log(
      `[${this.name}] Receipt: tx ${receipt.transactionHash} at block ${receipt.blockNumber} (${receipt.actions.length} actions)`
    );
  }
}
