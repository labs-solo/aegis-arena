import { describe, it, expect } from "vitest";
import { ethers } from "ethers";
import { ArenaClient } from "../../src/sdk/arena";
import { AegisVaultValidator } from "../../src/sdk/vault-validator";
import { createArenaServiceConfigFromEnv } from "../../src/server/services/arena";

describe("ArenaClient", () => {
  it("registers agents with validated vault IDs and parses RoundRegistered", async () => {
    const iface = new ethers.Interface([
      "event RoundRegistered(uint256 indexed roundId, address[] agents)",
    ]);
    const agents = [
      "0x1234567890123456789012345678901234567890",
      "0x2234567890123456789012345678901234567890",
    ];
    const event = iface.encodeEventLog(
      iface.getEvent("RoundRegistered"),
      [7n, agents]
    );

    const validator = new AegisVaultValidator({
      knownVaultIds: [501n, 777n],
    });

    const arenaClient = new ArenaClient({
      provider: {} as ethers.Provider,
      arenaAddress: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      vaultValidator: validator,
      contract: {
        async register(receivedAgents, receivedVaultIds) {
          expect(receivedAgents).toEqual(agents);
          expect(receivedVaultIds).toEqual([501n, 777n]);

          return {
            hash: "0xtxhash",
            async wait() {
              return {
                hash: "0xtxhash",
                logs: [
                  {
                    topics: event.topics,
                    data: event.data,
                  },
                ],
              };
            },
          };
        },
        async getAgentVault() {
          return 0n;
        },
        async executeBatch() {
          throw new Error("not used");
        },
        async getRoundState() {
          return [0n, 0n, 0n, false, []];
        },
        async getFinalScores() {
          return [[], [], []];
        },
        async getAgentExecutionState() {
          return [0n, 0n, 0n, 0n, 0n, 0n, ethers.ZeroAddress, ethers.ZeroHash, false];
        },
        async getSnapshotCount() {
          return 0n;
        },
        async getSnapshotAt() {
          return [0n, 0n, 0n, 0n, 0n, ethers.ZeroAddress, ethers.ZeroHash, false];
        },
      },
    });

    const result = await arenaClient.registerAgents({
      agents,
      vaultIds: [501n, 777n],
    });

    expect(result.roundId).toBe(7n);
    expect(result.txHash).toBe("0xtxhash");
    expect(result.bindings).toEqual([
      { agent: agents[0], vaultId: 501n },
      { agent: agents[1], vaultId: 777n },
    ]);
    expect(result.validationResults.every((item) => item.valid)).toBe(true);
  });

  it("fails closed when vault validation does not produce positive evidence", async () => {
    const arenaClient = new ArenaClient({
      provider: {} as ethers.Provider,
      arenaAddress: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      vaultValidator: new AegisVaultValidator(),
      contract: {
        async register() {
          throw new Error("should not be called");
        },
        async executeBatch() {
          throw new Error("not used");
        },
        async getAgentVault() {
          return 0n;
        },
        async getRoundState() {
          return [0n, 0n, 0n, false, []];
        },
        async getFinalScores() {
          return [[], [], []];
        },
        async getAgentExecutionState() {
          return [0n, 0n, 0n, 0n, 0n, 0n, ethers.ZeroAddress, ethers.ZeroHash, false];
        },
        async getSnapshotCount() {
          return 0n;
        },
        async getSnapshotAt() {
          return [0n, 0n, 0n, 0n, 0n, ethers.ZeroAddress, ethers.ZeroHash, false];
        },
      },
    });

    await expect(
      arenaClient.registerAgents({
        agents: ["0x1234567890123456789012345678901234567890"],
        vaultIds: [501n],
      })
    ).rejects.toThrow("vault validation failed");
  });

  it("reads authoritative round bindings from the Arena contract", async () => {
    const arenaClient = new ArenaClient({
      provider: {} as ethers.Provider,
      arenaAddress: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      contract: {
        async register() {
          throw new Error("not used");
        },
        async executeBatch() {
          throw new Error("not used");
        },
        async getAgentVault(roundId, agent) {
          expect(roundId).toBe(9n);
          return agent === "0x1234567890123456789012345678901234567890"
            ? 501n
            : 777n;
        },
        async getRoundState() {
          return {
            startTime: 1n,
            endTime: 2n,
            roundDuration: 1n,
            settled: false,
            agents: [
              "0x1234567890123456789012345678901234567890",
              "0x2234567890123456789012345678901234567890",
            ],
          };
        },
        async getFinalScores() {
          return [[], [], []];
        },
        async getAgentExecutionState() {
          return [0n, 0n, 0n, 0n, 0n, 0n, ethers.ZeroAddress, ethers.ZeroHash, false];
        },
        async getSnapshotCount() {
          return 0n;
        },
        async getSnapshotAt() {
          return [0n, 0n, 0n, 0n, 0n, ethers.ZeroAddress, ethers.ZeroHash, false];
        },
      },
    });

    await expect(arenaClient.getRoundBindings(9n)).resolves.toEqual([
      {
        agent: "0x1234567890123456789012345678901234567890",
        vaultId: 501n,
      },
      {
        agent: "0x2234567890123456789012345678901234567890",
        vaultId: 777n,
      },
    ]);
  });

  it("submits a real executeBatch write through the Arena client", async () => {
    const arenaClient = new ArenaClient({
      provider: {} as ethers.Provider,
      arenaAddress: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      contract: {
        async register() {
          throw new Error("not used");
        },
        async executeBatch(roundId, agent, actions) {
          expect(roundId).toBe(3n);
          expect(agent).toBe("0x1234567890123456789012345678901234567890");
          expect(actions).toEqual(["0x1234"]);
          return {
            hash: "0xwrite",
            async wait() {
              return { hash: "0xwrite" };
            },
          };
        },
        async getAgentVault() {
          return 0n;
        },
        async getRoundState() {
          return [0n, 0n, 0n, false, []];
        },
        async getFinalScores() {
          return [[], [], []];
        },
        async getAgentExecutionState() {
          return [0n, 0n, 0n, 0n, 0n, 0n, ethers.ZeroAddress, ethers.ZeroHash, false];
        },
        async getSnapshotCount() {
          return 0n;
        },
        async getSnapshotAt() {
          return [0n, 0n, 0n, 0n, 0n, ethers.ZeroAddress, ethers.ZeroHash, false];
        },
      },
    });

    await expect(
      arenaClient.executeBatch(3n, "0x1234567890123456789012345678901234567890", ["0x1234"])
    ).resolves.toEqual({ txHash: "0xwrite" });
  });

  it("reads action history from ActionsExecuted events", async () => {
    const arenaClient = new ArenaClient({
      provider: {} as ethers.Provider,
      arenaAddress: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      contract: {
        async register() {
          throw new Error("not used");
        },
        async executeBatch() {
          throw new Error("not used");
        },
        async getAgentVault() {
          return 0n;
        },
        async getRoundState() {
          return [0n, 0n, 0n, false, []];
        },
        async getFinalScores() {
          return [[], [], []];
        },
        async getAgentExecutionState() {
          return [0n, 0n, 0n, 0n, 0n, 0n, ethers.ZeroAddress, ethers.ZeroHash, false];
        },
        async getSnapshotCount() {
          return 0n;
        },
        async getSnapshotAt() {
          return [0n, 0n, 0n, 0n, 0n, ethers.ZeroAddress, ethers.ZeroHash, false];
        },
        filters: {
          ActionsExecuted(receivedRoundId, receivedAgent) {
            expect(receivedRoundId).toBe(4n);
            expect(receivedAgent).toBe("0x1234567890123456789012345678901234567890");
            return {};
          },
        },
        async queryFilter() {
          return [
            {
              transactionHash: "0xhist",
              blockNumber: 99,
              args: {
                actions: ["0x1234", "0x5678"],
              },
            },
          ];
        },
      },
    });

    await expect(
      arenaClient.getActionHistory(4n, "0x1234567890123456789012345678901234567890")
    ).resolves.toEqual([
      {
        roundId: 4n,
        agent: "0x1234567890123456789012345678901234567890",
        transactionHash: "0xhist",
        blockNumber: 99n,
        actionCount: 2,
        actions: ["0x1234", "0x5678"],
      },
    ]);
  });
});

describe("Arena server config", () => {
  it("requires the orchestrator signer for registration writes", () => {
    expect(() =>
      createArenaServiceConfigFromEnv(
        {
          ARENA_ADDRESS: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
        } as NodeJS.ProcessEnv,
        { requireSigner: true }
      )
    ).toThrow("ORCHESTRATOR_PRIVATE_KEY is required");
  });
});
