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
// Bounty Types (CP-017: State Machine Overhaul)
// ================================================================

/// @notice CP-017: BountyState enum values mirroring Bounty.sol BountyState.
///         Replaces boolean `claimed` field. SDK consumers must update state checks.
export enum BountyState {
  Unclaimed = 0,   // default — no agent has claimed
  Claimed = 1,     // claimed by agent; awaiting owner verification
  Paid = 2,        // terminal — agent verified and paid
  Expired = 3,     // terminal — observation or verification window elapsed
}

export interface BountyCondition {
  minVolumeUsdc: bigint;              // Minimum USDC volume (6 decimals)
  targetPriceMin: bigint;             // Min sqrtPriceX96
  targetPriceMax: bigint;             // Max sqrtPriceX96
  observationWindowBlocks: bigint;    // CP-017: RENAMED from windowBlocks
  verificationWindowBlocks: bigint;   // CP-017: NEW — verification deadline post-claim
}

export interface BountyRecord {
  bountyId: bigint;
  creator: string;            // 0x-prefixed address (checksummed)
  rewardAmount: bigint;       // USDC (6 decimals)
  roundId: bigint;
  conditionHash: string;      // 0x-prefixed hex string (bytes32)
  condition: BountyCondition;
  state: BountyState;         // CP-017: REPLACES bool claimed
  claimedBy: string;          // 0x-prefixed address
  createdAt: bigint;          // CP-017: NEW — block number at creation
  claimedAt: bigint;          // CP-017: NEW — block number when claimed
}

export interface BountyClaimProof {
  agentAddress: string;       // CP-017: NEW — agent address for proof binding (HIGH-02)
  bountyId: bigint;
  roundId: bigint;            // CP-017: NEW — round ID for proof binding (HIGH-02)
  volume: bigint;             // USDC volume traded (off-chain logging; on-chain data governs)
  avgPrice: bigint;           // sqrtPriceX96 (off-chain logging; on-chain data governs)
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
