// src/contracts/arena.ts
// ArenaClient — wrapper for Arena.sol with CP-018 ABI (onlyRelayer executeBatch)
//
// CP-018 DEPLOYMENT REQUIREMENT:
// The signer passed to this client MUST be authorized as a relayer in Arena.sol.
// Call: Arena.setRelayer(await signer.getAddress(), true)
// Failure to do this causes ALL executeBatch() calls to revert.

import { ethers } from "ethers";

// CP-018 Arena ABI (relevant functions only)
const ARENA_ABI = [
  // executeBatch(uint256 roundId, address agent, bytes[] actions) — onlyRelayer
  {
    inputs: [
      { internalType: "uint256", name: "roundId", type: "uint256" },
      { internalType: "address", name: "agent", type: "address" },
      { internalType: "bytes[]", name: "actions", type: "bytes[]" },
    ],
    name: "executeBatch",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // getSnapshots(uint256 roundId, address agent) — returns 4 uint256 values
  {
    inputs: [
      { internalType: "uint256", name: "roundId", type: "uint256" },
      { internalType: "address", name: "agent", type: "address" },
    ],
    name: "getSnapshots",
    outputs: [
      { internalType: "uint256", name: "totalVolumeUsdc", type: "uint256" },
      { internalType: "uint256", name: "avgSqrtPriceX96", type: "uint256" },
      { internalType: "uint256", name: "startBlock", type: "uint256" },
      { internalType: "uint256", name: "endBlock", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  // setRelayer(address relayer, bool authorized) — onlyOwner
  {
    inputs: [
      { internalType: "address", name: "relayer", type: "address" },
      { internalType: "bool", name: "authorized", type: "bool" },
    ],
    name: "setRelayer",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // authorizedRelayers(address) — view
  {
    inputs: [{ internalType: "address", name: "", type: "address" }],
    name: "authorizedRelayers",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  // register(address[] agents) returns (uint256 roundId)
  {
    inputs: [{ internalType: "address[]", name: "agents", type: "address[]" }],
    name: "register",
    outputs: [{ internalType: "uint256", name: "roundId", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  // startRound(uint256 roundId, uint256 durationSeconds)
  {
    inputs: [
      { internalType: "uint256", name: "roundId", type: "uint256" },
      { internalType: "uint256", name: "durationSeconds", type: "uint256" },
    ],
    name: "startRound",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // rounds(uint256) — partial struct
  {
    inputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    name: "rounds",
    outputs: [
      { internalType: "uint256", name: "roundId", type: "uint256" },
      { internalType: "uint256", name: "startTime", type: "uint256" },
      { internalType: "uint256", name: "endTime", type: "uint256" },
      { internalType: "uint256", name: "startBlock", type: "uint256" },
      { internalType: "uint256", name: "endBlock", type: "uint256" },
      { internalType: "uint256", name: "roundDuration", type: "uint256" },
      { internalType: "uint256", name: "prizePool", type: "uint256" },
      { internalType: "bool", name: "settled", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },
  // roundAgents(uint256 roundId, uint256 index) — public array getter
  {
    inputs: [
      { internalType: "uint256", name: "", type: "uint256" },
      { internalType: "uint256", name: "", type: "uint256" },
    ],
    name: "roundAgents",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  // getFinalScores(uint256 roundId)
  {
    inputs: [{ internalType: "uint256", name: "roundId", type: "uint256" }],
    name: "getFinalScores",
    outputs: [
      { internalType: "address[]", name: "agentsRanked", type: "address[]" },
      { internalType: "uint256[]", name: "scores", type: "uint256[]" },
      { internalType: "uint256[]", name: "prizes", type: "uint256[]" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

export interface RoundData {
  roundId: number;
  startTime: number;
  endTime: number;
  startBlock: number;
  endBlock: number;
  roundDuration: number;
  prizePool: bigint;
  settled: boolean;
}

export class ArenaClient {
  private contract: ethers.Contract;
  private signer: ethers.Signer;
  private arenaAddress: string;

  constructor(arenaAddress: string, signer: ethers.Signer) {
    if (!ethers.isAddress(arenaAddress)) {
      throw new Error(`ArenaClient: invalid address: ${arenaAddress}`);
    }
    this.arenaAddress = arenaAddress;
    this.signer = signer;
    this.contract = new ethers.Contract(arenaAddress, ARENA_ABI, signer);
  }

  getAddress(): string {
    return this.arenaAddress;
  }

  /**
   * Submit a batch of encoded actions for an agent.
   *
   * CP-018 REQUIREMENT: signer must be authorized relayer.
   * Call Arena.setRelayer(signerAddress, true) before this succeeds.
   */
  async executeBatch(
    roundId: number,
    agentAddress: string,
    encodedActions: string[]
  ): Promise<{ txHash: string }> {
    const tx = await (this.contract as any).executeBatch(
      roundId,
      agentAddress,
      encodedActions
    );
    const receipt = await tx.wait();
    if (!receipt) throw new Error("ArenaClient.executeBatch: tx failed");
    return { txHash: receipt.hash };
  }

  /**
   * ABI-encode executeBatch call for simulation (does not submit)
   */
  encodeExecuteBatch(
    roundId: number,
    agentAddress: string,
    encodedActions: string[]
  ): string {
    return this.contract.interface.encodeFunctionData("executeBatch", [
      roundId,
      agentAddress,
      encodedActions,
    ]);
  }

  /**
   * Get round data from Arena.sol
   */
  async getRoundData(roundId: number): Promise<RoundData> {
    const result = await (this.contract as any).rounds(roundId);
    return {
      roundId: Number(result.roundId),
      startTime: Number(result.startTime),
      endTime: Number(result.endTime),
      startBlock: Number(result.startBlock),
      endBlock: Number(result.endBlock),
      roundDuration: Number(result.roundDuration),
      prizePool: result.prizePool as bigint,
      settled: result.settled as boolean,
    };
  }

  /**
   * Get a specific agent's vault ID for a round.
   * Derives vault ID by scanning registered agents array.
   */
  async getAgentVaultId(roundId: number, agentAddress: string): Promise<number> {
    for (let i = 0; i < 10; i++) {
      try {
        const addr = await (this.contract as any).roundAgents(roundId, i);
        if ((addr as string).toLowerCase() === agentAddress.toLowerCase()) {
          return roundId * 1000 + i + 1;
        }
      } catch {
        break; // array index out of bounds — no more agents
      }
    }
    return 0; // not registered
  }

  /**
   * Get on-chain snapshot data for an agent in a round.
   */
  async getSnapshots(roundId: number, agentAddress: string): Promise<{
    totalVolumeUsdc: bigint;
    avgSqrtPriceX96: bigint;
    startBlock: number;
    endBlock: number;
  }> {
    const [vol, avg, start, end] = await (this.contract as any).getSnapshots(roundId, agentAddress);
    return {
      totalVolumeUsdc: vol as bigint,
      avgSqrtPriceX96: avg as bigint,
      startBlock: Number(start),
      endBlock: Number(end),
    };
  }

  /**
   * Check if an address is an authorized relayer.
   */
  async isAuthorizedRelayer(address: string): Promise<boolean> {
    return (await (this.contract as any).authorizedRelayers(address)) as boolean;
  }

  /**
   * Get final scores for a settled round.
   */
  async getFinalScores(roundId: number): Promise<{
    agentsRanked: string[];
    scores: bigint[];
    prizes: bigint[];
  }> {
    const [agents, scores, prizes] = await (this.contract as any).getFinalScores(roundId);
    return {
      agentsRanked: agents as string[],
      scores: scores as bigint[],
      prizes: prizes as bigint[],
    };
  }
}
