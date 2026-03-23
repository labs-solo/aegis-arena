/// TypeScript type definitions for AEGIS Arena SDK

export interface GameState {
  roundId: number;
  timeRemaining: number; // seconds
  agentVaultId: string;
  currentPortfolioValue: bigint; // in USDC
  currentLiquidity: bigint; // sL shares
  currentDebt: bigint; // borrowed amount
  currentIdle: bigint; // idle token amounts
  poolPrice: bigint; // sqrtPriceX96
}

export interface Action {
  opcode: number;
  params: ActionParam[];
}

export interface ActionParam {
  type: string; // "uint256", "address", "bytes32", etc.
  value: any;
}

export interface BorrowFlowInput {
  vaultId: string;
  principalDelta: bigint; // Amount to borrow (positive) or repay (negative)
  minLiquidityDelta: bigint; // Minimum liquidity received
  minIdleAmount0: bigint; // Min idle token 0
  minIdleAmount1: bigint; // Min idle token 1
  positionManagerAddress: string;
}

export interface BorrowFlowOutput {
  batch0: string[]; // Unlock actions
  batch1: string[]; // Borrow actions (with PM unlock)
  batch2: string[]; // Lock actions
}

export interface RoundState {
  roundId: number;
  startTime: number;
  endTime: number;
  roundDuration: number;
  settled: boolean;
  agents: string[];
}

export interface FinalScores {
  agentsRanked: string[];
  scores: bigint[];
  prizes: bigint[];
}

export interface AgentConfig {
  name: string;
  address: string;
  strategy: "PassiveLP" | "TrendFollower" | "Predator";
  initialAllocation: bigint;
}
