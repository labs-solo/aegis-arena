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

// ================================================================
// Bounty Types (CP-013 Agent 2)
// ================================================================

export interface BountyCondition {
  minVolumeUsdc: bigint;      // Minimum USDC volume (6 decimals)
  targetPriceMin: bigint;     // Min sqrtPriceX96
  targetPriceMax: bigint;     // Max sqrtPriceX96
  windowBlocks: bigint;       // Observation window in blocks
}

export interface BountyRecord {
  bountyId: bigint;
  creator: string;            // 0x-prefixed address (checksummed)
  rewardAmount: bigint;       // USDC (6 decimals)
  roundId: bigint;
  conditionHash: string;      // 0x-prefixed hex string (bytes32)
  condition: BountyCondition;
  expiresAt: bigint;          // Block number
  claimed: boolean;
  claimedBy: string;          // 0x-prefixed address
  claimTxBlock: bigint;       // Block number when claimed
}

export interface BountyClaimProof {
  bountyId: bigint;
  volume: bigint;             // USDC volume traded
  avgPrice: bigint;           // sqrtPriceX96
  blockRange: {
    startBlock: bigint;
    endBlock: bigint;
  };
}

export interface CreateBountyParams {
  roundId: bigint;
  rewardAmount: bigint;
  condition: BountyCondition;
}

export interface ClaimBountyResult {
  txHash: string;
  bountyId: bigint;
  claimer: string;            // 0x-prefixed address
  blockNumber: bigint;
}

// ================================================================
// Gateway Types (CP-014 OKX Onchain Gateway Integration)
// ================================================================

export interface SimulateParams {
  chainId: number;
  from: string;
  to: string;
  data: string;
  value?: string;
}

export interface SimulationResult {
  success: boolean;
  gasUsed?: bigint;
  revertReason?: string;
  logs?: unknown[];
}

export interface BroadcastParams {
  signedTx: string;
  chainId: number;
}

export interface BroadcastResult {
  txHash: string;
  status: "pending" | "confirmed" | "failed";
}

export interface GasEstimateParams {
  chainId: number;
  from: string;
  to: string;
  data: string;
  value?: string;
}

// ================================================================
// Market Data Types (CP-015 Market API Integration)
// ================================================================

export interface Kline {
  timestamp: number; // Unix timestamp (ms)
  openPrice: string; // Price as string (from OKX JSON)
  highPrice: string;
  lowPrice: string;
  closePrice: string;
  volume: string; // Base asset volume
  volCcy: string; // Quote asset volume
}

export interface MarketPrice {
  instId: string;
  lastPrice: string;
  bestBid: string;
  bestAsk: string;
  timestamp: number;
}

export interface IndexPrice {
  instId: string;
  idxPx: string;
  timestamp: number;
}

export type TrendDirection = 1 | -1 | 0; // 1 = uptrend, -1 = downtrend, 0 = flat
