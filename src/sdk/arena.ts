import { ethers } from "ethers";
import type {
  ActionExecutionRecord,
  AgentExecutionState,
  ArenaAgentBinding,
  ArenaExecutionSnapshot,
  ArenaRegistrationParams,
  ArenaRegistrationResult,
  AgentVaultBindingReader,
  FinalScores,
  RoundState,
  VaultValidationResult,
} from './types.js';
import { AegisVaultValidator } from './vault-validator.js';

const ARENA_ABI = [
  "event RoundRegistered(uint256 indexed roundId, address[] agents)",
  "event ActionsExecuted(uint256 indexed roundId, address agent, bytes[] actions)",
  "function register(address[] agents, uint256[] vaultIds) returns (uint256 roundId)",
  "function executeBatch(uint256 roundId, address agent, bytes[] actions)",
  "function getAgentVault(uint256 roundId, address agent) view returns (uint256 vaultId)",
  "function getRoundState(uint256 roundId) view returns (uint256 startTime, uint256 endTime, uint256 roundDuration, bool settled, address[] agents)",
  "function getFinalScores(uint256 roundId) view returns (address[] agentsRanked, uint256[] scores, uint256[] prizes)",
  "function getAgentExecutionState(uint256 roundId, address agent) view returns (uint256 vaultId, uint256 executionCount, uint256 actionCount, uint256 cumulativeVolumeUsdc, uint256 latestAvgPriceX96, uint256 lastExecutionBlock, address lastSurface, bytes32 lastBatchHash, bool lastProofEligible)",
  "function getSnapshotCount(uint256 roundId, address agent) view returns (uint256 count)",
  "function getSnapshotAt(uint256 roundId, address agent, uint256 snapshotIndex) view returns (uint256 blockNumber, uint256 timestamp, uint256 cumulativeVolumeUsdc, uint256 avgPriceX96, uint256 actionCount, address surface, bytes32 batchHash, bool proofEligible)",
] as const;

interface ArenaTransactionReceiptLike {
  hash?: string;
  blockNumber?: number | bigint;
  logs?: Array<{ topics: string[]; data: string }>;
}

interface ArenaTransactionLike {
  hash: string;
  wait(): Promise<ArenaTransactionReceiptLike>;
}

interface ArenaEventLogLike {
  transactionHash?: string;
  blockNumber?: number | bigint;
  args?: {
    roundId?: bigint;
    agent?: string;
    actions?: string[];
  };
}

interface ArenaContractLike {
  register(agents: string[], vaultIds: bigint[]): Promise<ArenaTransactionLike>;
  executeBatch(roundId: bigint, agent: string, actions: string[]): Promise<ArenaTransactionLike>;
  getAgentVault(roundId: bigint, agent: string): Promise<bigint>;
  getRoundState(roundId: bigint): Promise<any>;
  getFinalScores(roundId: bigint): Promise<any>;
  getAgentExecutionState(roundId: bigint, agent: string): Promise<any>;
  getSnapshotCount(roundId: bigint, agent: string): Promise<bigint>;
  getSnapshotAt(roundId: bigint, agent: string, snapshotIndex: bigint): Promise<any>;
  queryFilter?(event: unknown, fromBlock?: number, toBlock?: number | string): Promise<ArenaEventLogLike[]>;
  filters?: {
    ActionsExecuted?(roundId?: bigint | null, agent?: string | null): unknown;
  };
}

export interface ArenaClientConfig {
  provider: ethers.Provider;
  arenaAddress: string;
  signer?: ethers.Signer;
  vaultValidator?: AegisVaultValidator;
  contract?: ArenaContractLike;
}

export class ArenaClient implements AgentVaultBindingReader {
  private readonly arenaContract: ArenaContractLike;
  private readonly iface = new ethers.Interface(ARENA_ABI);
  private readonly vaultValidator?: AegisVaultValidator;

  constructor(config: ArenaClientConfig) {
    if (!ethers.isAddress(config.arenaAddress)) {
      throw new Error("ArenaClient: invalid Arena contract address");
    }

    const runner = config.signer ?? config.provider;
    this.arenaContract =
      config.contract ??
      (new ethers.Contract(config.arenaAddress, ARENA_ABI, runner) as unknown as ArenaContractLike);
    this.vaultValidator = config.vaultValidator;
  }

  async registerAgents(
    params: ArenaRegistrationParams,
    options: { requireOwnerMatch?: boolean } = {}
  ): Promise<ArenaRegistrationResult> {
    if (params.agents.length !== params.vaultIds.length) {
      throw new Error("ArenaClient.registerAgents: agents/vaultIds length mismatch");
    }

    const bindings: ArenaAgentBinding[] = params.agents.map((agent, index) => ({
      agent: ethers.getAddress(agent),
      vaultId: BigInt(params.vaultIds[index]),
    }));

    const validationResults = await this.validateBindings(bindings, options);
    const invalid = validationResults.filter((result) => !result.valid);
    if (invalid.length > 0) {
      const invalidIds = invalid.map((result) => result.vaultId.toString()).join(", ");
      throw new Error(`ArenaClient.registerAgents: vault validation failed for ${invalidIds}`);
    }

    const tx = await this.arenaContract.register(
      bindings.map((binding) => binding.agent),
      bindings.map((binding) => binding.vaultId)
    );
    const receipt = await tx.wait();
    const roundId = this.extractRoundId(receipt.logs || []);

    return {
      roundId,
      txHash: receipt.hash || tx.hash,
      bindings,
      validationResults,
    };
  }

  async executeBatch(roundId: bigint, agent: string, actions: string[]): Promise<{ txHash: string }> {
    if (actions.length === 0) {
      throw new Error("ArenaClient.executeBatch: empty action batch");
    }

    const tx = await this.arenaContract.executeBatch(roundId, ethers.getAddress(agent), actions);
    const receipt = await tx.wait();
    return { txHash: receipt.hash || tx.hash };
  }

  async getAgentVault(roundId: bigint, agent: string): Promise<bigint> {
    return BigInt(await this.arenaContract.getAgentVault(roundId, ethers.getAddress(agent)));
  }

  async getRoundBindings(roundId: bigint): Promise<ArenaAgentBinding[]> {
    const roundState = await this.getRoundState(roundId);
    return Promise.all(
      roundState.agents.map(async (agent) => ({
        agent,
        vaultId: await this.getAgentVault(roundId, agent),
      }))
    );
  }

  async getRoundState(roundId: bigint): Promise<RoundState> {
    const state = await this.arenaContract.getRoundState(roundId);
    const startTime = Number(state.startTime ?? state[0]);
    const endTime = Number(state.endTime ?? state[1]);
    const roundDuration = Number(state.roundDuration ?? state[2]);
    const settled = Boolean(state.settled ?? state[3]);
    const agents = [...(state.agents ?? state[4] ?? [])].map((agent) =>
      ethers.getAddress(agent)
    );

    return {
      roundId: Number(roundId),
      startTime,
      endTime,
      roundDuration,
      settled,
      agents,
    };
  }

  async getFinalScores(roundId: bigint): Promise<FinalScores> {
    const result = await this.arenaContract.getFinalScores(roundId);
    return {
      agentsRanked: [...(result.agentsRanked ?? result[0] ?? [])].map((agent) =>
        ethers.getAddress(agent)
      ),
      scores: [...(result.scores ?? result[1] ?? [])].map((value) => BigInt(value)),
      prizes: [...(result.prizes ?? result[2] ?? [])].map((value) => BigInt(value)),
    };
  }

  async getAgentExecutionState(roundId: bigint, agent: string): Promise<AgentExecutionState> {
    const result = await this.arenaContract.getAgentExecutionState(roundId, ethers.getAddress(agent));
    return {
      vaultId: BigInt(result.vaultId ?? result[0]),
      executionCount: BigInt(result.executionCount ?? result[1]),
      actionCount: BigInt(result.actionCount ?? result[2]),
      cumulativeVolumeUsdc: BigInt(result.cumulativeVolumeUsdc ?? result[3]),
      latestAvgPriceX96: BigInt(result.latestAvgPriceX96 ?? result[4]),
      lastExecutionBlock: BigInt(result.lastExecutionBlock ?? result[5]),
      lastSurface: ethers.getAddress(result.lastSurface ?? result[6]),
      lastBatchHash: result.lastBatchHash ?? result[7],
      lastProofEligible: Boolean(result.lastProofEligible ?? result[8]),
    };
  }

  async getAgentSnapshots(roundId: bigint, agent: string): Promise<ArenaExecutionSnapshot[]> {
    const normalizedAgent = ethers.getAddress(agent);
    const count = BigInt(await this.arenaContract.getSnapshotCount(roundId, normalizedAgent));
    const snapshots: ArenaExecutionSnapshot[] = [];

    for (let index = 0n; index < count; index++) {
      const snapshot = await this.arenaContract.getSnapshotAt(roundId, normalizedAgent, index);
      snapshots.push({
        blockNumber: BigInt(snapshot.blockNumber ?? snapshot[0]),
        timestamp: BigInt(snapshot.timestamp ?? snapshot[1]),
        cumulativeVolumeUsdc: BigInt(snapshot.cumulativeVolumeUsdc ?? snapshot[2]),
        avgPriceX96: BigInt(snapshot.avgPriceX96 ?? snapshot[3]),
        actionCount: BigInt(snapshot.actionCount ?? snapshot[4]),
        surface: ethers.getAddress(snapshot.surface ?? snapshot[5]),
        batchHash: snapshot.batchHash ?? snapshot[6],
        proofEligible: Boolean(snapshot.proofEligible ?? snapshot[7]),
      });
    }

    return snapshots;
  }

  async getActionHistory(roundId: bigint, agent: string): Promise<ActionExecutionRecord[]> {
    if (!this.arenaContract.queryFilter || !this.arenaContract.filters?.ActionsExecuted) {
      throw new Error("ArenaClient.getActionHistory: contract runner does not support event queries");
    }

    const normalizedAgent = ethers.getAddress(agent);
    const filter = this.arenaContract.filters.ActionsExecuted(roundId, normalizedAgent);
    const logs = await this.arenaContract.queryFilter(filter, 0, "latest");

    return logs.map((log) => ({
      roundId,
      agent: normalizedAgent,
      transactionHash: log.transactionHash || "",
      blockNumber: BigInt(log.blockNumber || 0),
      actionCount: log.args?.actions?.length || 0,
      actions: log.args?.actions || [],
    }));
  }

  async validateBindings(
    bindings: ArenaAgentBinding[],
    options: { requireOwnerMatch?: boolean } = {}
  ): Promise<VaultValidationResult[]> {
    if (!this.vaultValidator) {
      return bindings.map((binding) => ({
        vaultId: binding.vaultId,
        valid: true,
        evidence: [],
        limitations: [
          "No vault validator configured; bindings are only shape-validated before Arena.register()",
        ],
      }));
    }

    return this.vaultValidator.validateBindings(bindings, options);
  }

  private extractRoundId(logs: Array<{ topics: string[]; data: string }>): bigint {
    for (const log of logs) {
      try {
        const parsed = this.iface.parseLog(log);
        if (parsed && parsed.name === "RoundRegistered") {
          return BigInt(parsed.args.roundId);
        }
      } catch {
        continue;
      }
    }

    throw new Error(
      "ArenaClient.registerAgents: RoundRegistered event missing from transaction receipt"
    );
  }
}
