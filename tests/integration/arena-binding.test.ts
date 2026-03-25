import { describe, it, expect } from "vitest";
import { Interface } from "ethers";
import { BaseAgent } from "../../src/agents/base-agent";
import type { GameState, Action } from "../../src/sdk/types";

class TestAgent extends BaseAgent {
  async decideAction(_state: GameState): Promise<Action[]> {
    return [];
  }
}

describe("Arena vault binding", () => {
  it("requires a registered vault ID before building Arena calldata", async () => {
    const agent = new TestAgent(
      "TestAgent",
      "0x1234567890123456789012345678901234567890",
      BigInt(1000),
      "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      {} as any
    );

    await expect(
      (agent as any).buildTxParams(["0x1234"], BigInt(1))
    ).rejects.toThrow("registered vault ID not bound");
  });

  it("encodes executeBatch with the bound agent address and actions", async () => {
    const agent = new TestAgent(
      "TestAgent",
      "0x1234567890123456789012345678901234567890",
      BigInt(1000),
      "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      {} as any
    );

    agent.bindRegisteredVaultId("501");

    const { data } = await (agent as any).buildTxParams(
      ["0x1234", "0x5678"],
      BigInt(42)
    );

    const iface = new Interface([
      "function executeBatch(uint256 roundId, address agent, bytes[] actions)",
    ]);
    const decoded = iface.decodeFunctionData("executeBatch", data);

    expect(decoded[0]).toBe(BigInt(42));
    expect(decoded[1]).toBe("0x1234567890123456789012345678901234567890");
    expect(decoded[2]).toEqual(["0x1234", "0x5678"]);
  });

  it("can bind the registered vault ID from Arena instead of local-only state", async () => {
    const agent = new TestAgent(
      "TestAgent",
      "0x1234567890123456789012345678901234567890",
      BigInt(1000),
      "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      {} as any
    );

    const boundVaultId = await agent.bindRegisteredVaultIdFromArena(11n, {
      async getAgentVault(roundId, agentAddress) {
        expect(roundId).toBe(11n);
        expect(agentAddress).toBe(
          "0x1234567890123456789012345678901234567890"
        );
        return 901n;
      },
    });

    expect(boundVaultId).toBe("901");
    expect(agent.getVaultId()).toBe("901");
  });
});
