// src/orchestrator/types.ts

import { ethers } from "ethers";

export interface GameState {
  roundId: number;
  blockNumber: number;
  timestamp: number;
  agentAddress: string;
  agentVaultId: number;
  poolState: {
    sqrtPriceX96: bigint;
    tick: number;
    liquidity: bigint;
  };
  agentBalances: {
    wokb: bigint;
    usdt0: bigint;
    idle: bigint;
  };
  roundEndTime: number;    // Unix timestamp
  roundEndBlock: number;   // block number
}

export interface OrchestratorConfig {
  provider: ethers.Provider;
  signer: ethers.Signer;
  arenaAddress: string;
  bountyAddress: string;
  usdTokenAddress: string;
  agents: {
    getAddress(): string;
    decideActions(state: GameState): Promise<string[]>;
    onReceipt(r: ReceiptInfo): void;
  }[];
  gatewayUrl?: string;
}

export interface ReceiptInfo {
  transactionHash: string;
  blockNumber: number;
  actions: string[];
}

export interface AgentTickResult {
  agentAddress: string;
  encodedActions: string[];
  simulated: boolean;
  executed: boolean;
  txHash?: string;
  error?: string;
}

export interface TickResult {
  roundId: number;
  blockNumber: number;
  agentResults: Map<string, AgentTickResult>;
}
