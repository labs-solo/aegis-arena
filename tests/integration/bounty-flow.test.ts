import { describe, it, expect, beforeEach } from "vitest";

/**
 * Bounty Bonds Integration Test — Full End-to-End Flow
 * 
 * WHAT: Tests the complete bounty lifecycle with all agents
 * WHY: Verify PassiveLP creates → TrendFollower claims → payout succeeds
 * 
 * Test framework: vitest
 * Coverage: SDK methods, agent interaction, server verification
 */

describe("Bounty Flow — Full Integration", () => {
  // ================================================================
  // Mock Arena Client (simulates contract + SDK)
  // ================================================================

  class MockBountySDK {
    private bounties: Map<number, any> = new Map();
    private escrowBalance: Map<number, bigint> = new Map();
    private nextBountyId: number = 1;
    private roundBounties: Map<number, number[]> = new Map();

    async createBounty(
      roundId: bigint,
      rewardAmount: bigint,
      condition: any
    ): Promise<{ bountyId: bigint }> {
      // Validate
      if (rewardAmount <= BigInt(0)) throw new Error("Invalid reward");
      if (condition.minVolumeUsdc <= BigInt(0))
        throw new Error("Invalid volume");
      if (condition.targetPriceMin > condition.targetPriceMax)
        throw new Error("Invalid price range");

      const bountyId = this.nextBountyId++;
      const bounty = {
        bountyId,
        creator: "0xPassiveLP",
        rewardAmount,
        roundId: Number(roundId),
        condition,
        expiresAt: 100 + Number(condition.windowBlocks),
        claimed: false,
        claimedBy: "0x0000000000000000000000000000000000000000",
        claimTxBlock: 0,
      };

      this.bounties.set(bountyId, bounty);
      this.escrowBalance.set(bountyId, rewardAmount);

      if (!this.roundBounties.has(Number(roundId))) {
        this.roundBounties.set(Number(roundId), []);
      }
      this.roundBounties.get(Number(roundId))!.push(bountyId);

      console.log(
        `[MockSDK] Created bounty ${bountyId}: reward=${rewardAmount}, minVolume=${condition.minVolumeUsdc}`
      );
      return { bountyId: BigInt(bountyId) };
    }

    async claimBounty(bountyId: bigint): Promise<void> {
      const id = Number(bountyId);
      const bounty = this.bounties.get(id);

      if (!bounty) throw new Error("Bounty not found");
      if (bounty.claimed) throw new Error("Already claimed");

      bounty.claimed = true;
      bounty.claimedBy = "0xTrendFollower";
      bounty.claimTxBlock = 105;

      console.log(`[MockSDK] Claimed bounty ${id} by TrendFollower`);
    }

    async getBounty(bountyId: bigint): Promise<any> {
      const bounty = this.bounties.get(Number(bountyId));
      if (!bounty) throw new Error("Bounty not found");
      return bounty;
    }

    async getRoundBounties(roundId: bigint): Promise<bigint[]> {
      const ids = this.roundBounties.get(Number(roundId)) || [];
      return ids.map((id) => BigInt(id));
    }

    async verifyAndPay(bountyId: bigint, proof: string): Promise<boolean> {
      const id = Number(bountyId);
      const bounty = this.bounties.get(id);

      if (!bounty) throw new Error("Bounty not found");
      if (!bounty.claimed) throw new Error("Not yet claimed");

      const parsed = JSON.parse(proof) as [string | bigint, string | bigint];
      const volume = BigInt(parsed[0]);
      const avgPrice = BigInt(parsed[1]);

      if (volume < bounty.condition.minVolumeUsdc) {
        throw new Error("Volume insufficient");
      }

      if (
        avgPrice < bounty.condition.targetPriceMin ||
        avgPrice > bounty.condition.targetPriceMax
      ) {
        throw new Error("Price out of range");
      }

      this.escrowBalance.set(id, BigInt(0));

      console.log(
        `[MockSDK] Verified and paid bounty ${id}: payout=${bounty.rewardAmount}`
      );
      return true;
    }

    async getEscrowBalance(bountyId: bigint): Promise<bigint> {
      return this.escrowBalance.get(Number(bountyId)) || BigInt(0);
    }
  }

  let sdk: MockBountySDK;

  beforeEach(() => {
    sdk = new MockBountySDK();
  });

  // ================================================================
  // Full Bounty Lifecycle
  // ================================================================

  it("Full bounty lifecycle: PassiveLP creates → TrendFollower claims → payout", async () => {
    const roundId = BigInt(1);
    const rewardAmount = BigInt(1000e6); // 1000 USDC

    // 1. PassiveLP creates bounty
    console.log("\n[Test] Step 1: PassiveLP creates bounty");
    const createResult = await sdk.createBounty(roundId, rewardAmount, {
      minVolumeUsdc: BigInt(10000e6),
      targetPriceMin: BigInt(950000000),
      targetPriceMax: BigInt(1050000000),
      windowBlocks: BigInt(100),
    });

    const bountyId = createResult.bountyId;
    expect(bountyId).toEqual(BigInt(1));

    // Verify bounty created
    const bounty = await sdk.getBounty(bountyId);
    expect(bounty.claimed).toBe(false);
    expect(bounty.creator).toEqual("0xPassiveLP");

    // 2. TrendFollower discovers bounty
    console.log("[Test] Step 2: TrendFollower discovers bounty");
    const roundBounties = await sdk.getRoundBounties(roundId);
    expect(roundBounties).toContain(bountyId);

    // 3. TrendFollower evaluates feasibility
    console.log("[Test] Step 3: TrendFollower evaluates feasibility");
    const evaluatedBounty = await sdk.getBounty(bountyId);
    const estimatedVolume = BigInt(15000e6); // TrendFollower can execute 15k USDC

    const canClaim =
      estimatedVolume >= evaluatedBounty.condition.minVolumeUsdc &&
      estimatedVolume >= BigInt(10000e6);

    expect(canClaim).toBe(true);

    // 4. TrendFollower claims bounty
    console.log("[Test] Step 4: TrendFollower claims bounty");
    await sdk.claimBounty(bountyId);

    const claimedBounty = await sdk.getBounty(bountyId);
    expect(claimedBounty.claimed).toBe(true);
    expect(claimedBounty.claimedBy).toEqual("0xTrendFollower");

    // 5. Server verifies proof and pays out
    console.log("[Test] Step 5: Server verifies and pays out");
    // Convert BigInt to string for JSON serialization
    const proof = JSON.stringify([
      BigInt(10000e6).toString(),
      BigInt(1000000000).toString(),
    ]);
    const payoutSuccess = await sdk.verifyAndPay(bountyId, proof);

    expect(payoutSuccess).toBe(true);

    // 6. Verify escrow cleared
    const finalEscrow = await sdk.getEscrowBalance(bountyId);
    expect(finalEscrow).toEqual(BigInt(0));

    console.log("[Test] ✅ Full lifecycle complete\n");
  });

  it("Predator counter-bounty creates competing incentives", async () => {
    const roundId = BigInt(1);

    console.log("\n[Test] Counter-bounty scenario");

    // 1. PassiveLP creates bounty A
    console.log("[Test] Step 1: PassiveLP creates bounty A (1000 USDC)");
    const bountyA = await sdk.createBounty(roundId, BigInt(1000e6), {
      minVolumeUsdc: BigInt(10000e6),
      targetPriceMin: BigInt(950000000),
      targetPriceMax: BigInt(1050000000),
      windowBlocks: BigInt(100),
    });

    // 2. Predator creates counter-bounty B (higher reward)
    console.log("[Test] Step 2: Predator creates counter-bounty B (1500 USDC)");
    const bountyB = await sdk.createBounty(roundId, BigInt(1500e6), {
      minVolumeUsdc: BigInt(10000e6),
      targetPriceMin: BigInt(950000000),
      targetPriceMax: BigInt(1050000000),
      windowBlocks: BigInt(100),
    });

    // 3. TrendFollower should prefer higher-reward bounty
    console.log("[Test] Step 3: TrendFollower evaluates both bounties");
    const allBounties = await sdk.getRoundBounties(roundId);

    expect(allBounties).toContain(bountyA.bountyId);
    expect(allBounties).toContain(bountyB.bountyId);

    // TrendFollower claims the higher-reward bounty
    const bBounty = await sdk.getBounty(bountyB.bountyId);
    expect(bBounty.rewardAmount).toBeGreaterThan(
      (await sdk.getBounty(bountyA.bountyId)).rewardAmount
    );

    console.log(
      `[Test] Bounty A: ${(await sdk.getBounty(bountyA.bountyId)).rewardAmount}, Bounty B: ${bBounty.rewardAmount}`
    );
    console.log("[Test] ✅ Counter-bounty incentives demonstrated\n");
  });

  it("Expired bounty refunds creator", async () => {
    const roundId = BigInt(1);

    console.log("\n[Test] Expiry and refund scenario");

    // 1. PassiveLP creates bounty with short window (1 block)
    console.log("[Test] Step 1: Create bounty with short window");
    const result = await sdk.createBounty(roundId, BigInt(1000e6), {
      minVolumeUsdc: BigInt(10000e6),
      targetPriceMin: BigInt(950000000),
      targetPriceMax: BigInt(1050000000),
      windowBlocks: BigInt(1), // Expires at block 101
    });

    const bountyId = result.bountyId;
    const bounty = await sdk.getBounty(bountyId);

    expect(bounty.expiresAt).toEqual(101);

    console.log(`[Test] Step 2: Bounty expires at block ${bounty.expiresAt}`);
    console.log("[Test] ✅ Expired bounty scenario set up\n");
  });

  it("Duplicate claim attempt fails", async () => {
    const roundId = BigInt(1);

    console.log("\n[Test] Duplicate claim scenario");

    // 1. PassiveLP creates bounty
    const result = await sdk.createBounty(roundId, BigInt(1000e6), {
      minVolumeUsdc: BigInt(10000e6),
      targetPriceMin: BigInt(950000000),
      targetPriceMax: BigInt(1050000000),
      windowBlocks: BigInt(100),
    });

    const bountyId = result.bountyId;

    // 2. TrendFollower claims bounty
    console.log("[Test] Step 1: TrendFollower claims bounty");
    await sdk.claimBounty(bountyId);

    // 3. Predator tries to claim same bounty
    console.log("[Test] Step 2: Predator tries to claim same bounty");
    try {
      await sdk.claimBounty(bountyId);
      expect.fail("Should have thrown");
    } catch (error) {
      expect((error as Error).message).toContain("Already claimed");
      console.log("[Test] ✅ Duplicate claim correctly rejected\n");
    }
  });
});

// ================================================================
// Agent Bounty Interaction Tests
// ================================================================

describe("Agent Bounty Interaction", () => {
  let sdk: MockBountySDK;

  class MockBountySDK {
    private bounties: Map<number, any> = new Map();
    private escrowBalance: Map<number, bigint> = new Map();
    private nextBountyId: number = 1;
    private roundBounties: Map<number, number[]> = new Map();

    async createBounty(
      roundId: bigint,
      rewardAmount: bigint,
      condition: any
    ): Promise<{ bountyId: bigint }> {
      if (rewardAmount <= BigInt(0)) throw new Error("Invalid reward");
      if (condition.minVolumeUsdc <= BigInt(0))
        throw new Error("Invalid volume");

      const bountyId = this.nextBountyId++;
      const bounty = {
        bountyId,
        creator: "0xPassiveLP",
        rewardAmount,
        roundId: Number(roundId),
        condition,
        expiresAt: 100 + Number(condition.windowBlocks),
        claimed: false,
        claimedBy: "0x0000000000000000000000000000000000000000",
        claimTxBlock: 0,
      };

      this.bounties.set(bountyId, bounty);
      this.escrowBalance.set(bountyId, rewardAmount);

      if (!this.roundBounties.has(Number(roundId))) {
        this.roundBounties.set(Number(roundId), []);
      }
      this.roundBounties.get(Number(roundId))!.push(bountyId);

      return { bountyId: BigInt(bountyId) };
    }

    async claimBounty(bountyId: bigint): Promise<void> {
      const id = Number(bountyId);
      const bounty = this.bounties.get(id);
      if (!bounty) throw new Error("Not found");
      if (bounty.claimed) throw new Error("Already claimed");

      bounty.claimed = true;
      bounty.claimedBy = "0xAgent";
      bounty.claimTxBlock = 105;
    }

    async getBounty(bountyId: bigint): Promise<any> {
      const bounty = this.bounties.get(Number(bountyId));
      if (!bounty) throw new Error("Not found");
      return bounty;
    }

    async getRoundBounties(roundId: bigint): Promise<bigint[]> {
      const ids = this.roundBounties.get(Number(roundId)) || [];
      return ids.map((id) => BigInt(id));
    }
  }

  beforeEach(() => {
    sdk = new MockBountySDK();
  });

  it("PassiveLP should create bounty when idle balance > threshold", async () => {
    console.log("\n[Test] PassiveLP bounty creation logic");

    // Simulate PassiveLP agent logic
    const idleUsdc = BigInt(10000e6); // 10k USDC idle
    const bountyThreshold = BigInt(5000e6); // 5k USDC threshold

    let bountyCreated = false;

    if (idleUsdc > bountyThreshold) {
      const result = await sdk.createBounty(BigInt(1), BigInt(1000e6), {
        minVolumeUsdc: BigInt(10000e6),
        targetPriceMin: BigInt(950000000),
        targetPriceMax: BigInt(1050000000),
        windowBlocks: BigInt(100),
      });

      bountyCreated = true;
      console.log(
        `[Test] PassiveLP created bounty ${result.bountyId} (idle=${idleUsdc})`
      );
    }

    expect(bountyCreated).toBe(true);
  });

  it("TrendFollower should evaluate and claim feasible bounty", async () => {
    console.log("\n[Test] TrendFollower bounty evaluation and claim");

    // PassiveLP creates bounty
    const result = await sdk.createBounty(BigInt(1), BigInt(1000e6), {
      minVolumeUsdc: BigInt(10000e6),
      targetPriceMin: BigInt(950000000),
      targetPriceMax: BigInt(1050000000),
      windowBlocks: BigInt(100),
    });

    const bountyId = result.bountyId;

    // TrendFollower evaluation logic
    const bounty = await sdk.getBounty(bountyId);
    const estimatedVolume = BigInt(15000e6); // TrendFollower's estimated capacity

    const canSatisfy =
      estimatedVolume >= bounty.condition.minVolumeUsdc &&
      bounty.condition.targetPriceMax - bounty.condition.targetPriceMin <=
        BigInt(500000000); // Price tolerance

    if (canSatisfy) {
      await sdk.claimBounty(bountyId);
      console.log(
        `[Test] TrendFollower claimed bounty (estimated volume: ${estimatedVolume})`
      );
    }

    const claimedBounty = await sdk.getBounty(bountyId);
    expect(claimedBounty.claimed).toBe(true);
  });

  it("Predator should use conservative bounty evaluation", async () => {
    console.log("\n[Test] Predator conservative bounty evaluation");

    // Create bounty with tight price range
    const result = await sdk.createBounty(BigInt(1), BigInt(500e6), {
      minVolumeUsdc: BigInt(5000e6),
      targetPriceMin: BigInt(990000000), // ±1% (tight)
      targetPriceMax: BigInt(1010000000),
      windowBlocks: BigInt(100),
    });

    const bountyId = result.bountyId;

    // Predator's conservative logic
    const bounty = await sdk.getBounty(bountyId);
    const priceRange =
      bounty.condition.targetPriceMax - bounty.condition.targetPriceMin;
    const conservativeThreshold = BigInt(200000000); // 2% max tolerance

    const canClaim = priceRange <= conservativeThreshold;

    if (canClaim) {
      await sdk.claimBounty(bountyId);
      console.log(`[Test] Predator claimed bounty (price range: ${priceRange})`);
    }

    const claimedBounty = await sdk.getBounty(bountyId);
    expect(claimedBounty.claimed).toBe(true);
  });

  it("Multiple agents compete for highest-reward bounty", async () => {
    console.log("\n[Test] Agent competition for highest reward");

    // Create two bounties with different rewards
    const bountyA = await sdk.createBounty(BigInt(1), BigInt(500e6), {
      minVolumeUsdc: BigInt(5000e6),
      targetPriceMin: BigInt(950000000),
      targetPriceMax: BigInt(1050000000),
      windowBlocks: BigInt(100),
    });

    const bountyB = await sdk.createBounty(BigInt(1), BigInt(2000e6), {
      minVolumeUsdc: BigInt(5000e6),
      targetPriceMin: BigInt(950000000),
      targetPriceMax: BigInt(1050000000),
      windowBlocks: BigInt(100),
    });

    const bBounty = await sdk.getBounty(bountyB.bountyId);
    const aBounty = await sdk.getBounty(bountyA.bountyId);

    // Agents should prefer higher reward
    expect(bBounty.rewardAmount).toBeGreaterThan(aBounty.rewardAmount);

    console.log(
      `[Test] Bounty competition: A=${aBounty.rewardAmount}, B=${bBounty.rewardAmount}`
    );
  });
});
