/// PassiveLP Agent — Conservative strategy
///
/// Strategy: Provide liquidity and earn fees
/// - Allocates ~50% of capital to USDC/WOKB liquidity provision
/// - Holds remaining 50% as idle USDC
/// - No borrowing; minimal leverage
/// - Low risk, consistent but modest returns
/// - Success metric: Accumulate ≥10% returns from fees

import { Signer } from "ethers";
import { BaseAgent } from "./base-agent";
import { GameState, Action } from "../sdk/types";
import { encodeModifyLiquidity } from "../sdk/router";
import { OPCODES } from "../sdk/opcodes";

export class AgentPassiveLP extends BaseAgent {
  constructor(
    agentAddress: string,
    initialAllocation: bigint,
    arenaAddress: string,
    signer: Signer
  ) {
    super("PassiveLP", agentAddress, initialAllocation, arenaAddress, signer);
  }

  /// @notice PassiveLP strategy: Provide liquidity, earn fees
  async decideAction(state: GameState): Promise<Action[]> {
    const actions: Action[] = [];

    // Allocate ~50% of remaining capital to liquidity
    const liquidityAmount = this.initialAllocation / 2n;

    // Action: Provide liquidity to USDC/WOKB pool
    // Parameters:
    // - vaultId: agent's vault
    // - deltaLiquidity: amount to add (in terms of LP shares)
    // - recipient: agent address (receives LP position NFT)
    // - minDeltaShares: slippage protection
    // - lowerTick, upperTick: full-range liquidity [-887272, 887272]
    const liquidityAction = encodeModifyLiquidity({
      vaultId: this.vaultId,
      deltaLiquidity: liquidityAmount as any,
      recipient: this.agentAddress,
      minDeltaShares: 0n,
      lowerTick: -887272, // Full range lower bound
      upperTick: 887272, // Full range upper bound
    });

    actions.push({
      opcode: OPCODES.AE_MODIFY_LIQUIDITY,
      params: [],
    });

    // Remaining 50% stays as idle USDC (no action required)
    // This provides a conservative fallback if swaps execute unfavorably

    console.log(
      `PassiveLP: providing ${liquidityAmount / 10n ** 6n} USDC as liquidity`
    );

    return actions;
  }

  /// @notice Check performance vs benchmark
  evaluatePerformance(finalScore: bigint, initialCapital: bigint): boolean {
    const returnPercent =
      ((finalScore - initialCapital) * 100n) / initialCapital;
    const meetsTarget = returnPercent >= 10n; // 10% return target

    console.log(
      `PassiveLP performance: ${returnPercent}% return (target: ≥10%)`
    );
    return meetsTarget;
  }
}
