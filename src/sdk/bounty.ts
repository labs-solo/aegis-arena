/// AEGIS Arena Bounty SDK
/// CP-017: State Machine Overhaul — BountyState enum, dual windows, on-chain proof binding

import { ethers } from "ethers";
import {
  BountyCondition,
  BountyRecord,
  BountyState,
  BountyClaimProof,
  CreateBountyParams,
  ClaimBountyResult,
} from "./types";

// ================================================================
// Bounty Contract ABI (CP-017 updated)
// ================================================================

const BOUNTY_ABI = [
  // createBounty(uint256 roundId, uint256 rewardAmount, (uint256,uint256,uint256,uint256,uint256) condition)
  // NOTE: BountyCondition now has 5 fields (observationWindowBlocks + verificationWindowBlocks)
  {
    inputs: [
      { internalType: "uint256", name: "roundId", type: "uint256" },
      { internalType: "uint256", name: "rewardAmount", type: "uint256" },
      {
        components: [
          { internalType: "uint256", name: "minVolumeUsdc", type: "uint256" },
          { internalType: "uint256", name: "targetPriceMin", type: "uint256" },
          { internalType: "uint256", name: "targetPriceMax", type: "uint256" },
          { internalType: "uint256", name: "observationWindowBlocks", type: "uint256" },
          { internalType: "uint256", name: "verificationWindowBlocks", type: "uint256" },
        ],
        internalType: "struct Bounty.BountyCondition",
        name: "condition",
        type: "tuple",
      },
    ],
    name: "createBounty",
    outputs: [{ internalType: "uint256", name: "bountyId", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  // claimBounty(uint256 bountyId)
  {
    inputs: [{ internalType: "uint256", name: "bountyId", type: "uint256" }],
    name: "claimBounty",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // verifyAndPay(uint256 bountyId, bytes proof)
  // NOTE: proof now encodes (address agentAddress, uint256 roundId, uint256 volume, uint256 avgPrice)
  {
    inputs: [
      { internalType: "uint256", name: "bountyId", type: "uint256" },
      { internalType: "bytes", name: "proof", type: "bytes" },
    ],
    name: "verifyAndPay",
    outputs: [{ internalType: "bool", name: "success", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  // expireBounty(uint256 bountyId)
  {
    inputs: [{ internalType: "uint256", name: "bountyId", type: "uint256" }],
    name: "expireBounty",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // getBounty(uint256 bountyId)
  // NOTE: returns BountyRecord with state (uint8 enum) replacing bool claimed
  {
    inputs: [{ internalType: "uint256", name: "bountyId", type: "uint256" }],
    name: "getBounty",
    outputs: [
      {
        components: [
          { internalType: "uint256", name: "bountyId", type: "uint256" },
          { internalType: "address", name: "creator", type: "address" },
          { internalType: "uint256", name: "rewardAmount", type: "uint256" },
          { internalType: "uint256", name: "roundId", type: "uint256" },
          { internalType: "bytes32", name: "conditionHash", type: "bytes32" },
          {
            components: [
              { internalType: "uint256", name: "minVolumeUsdc", type: "uint256" },
              { internalType: "uint256", name: "targetPriceMin", type: "uint256" },
              { internalType: "uint256", name: "targetPriceMax", type: "uint256" },
              { internalType: "uint256", name: "observationWindowBlocks", type: "uint256" },
              { internalType: "uint256", name: "verificationWindowBlocks", type: "uint256" },
            ],
            internalType: "struct Bounty.BountyCondition",
            name: "condition",
            type: "tuple",
          },
          { internalType: "uint8", name: "state", type: "uint8" },   // BountyState enum
          { internalType: "address", name: "claimedBy", type: "address" },
          { internalType: "uint256", name: "createdAt", type: "uint256" },
          { internalType: "uint256", name: "claimedAt", type: "uint256" },
        ],
        internalType: "struct Bounty.BountyRecord",
        name: "bounty",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  // getBountyState(uint256 bountyId) → uint8 (BountyState enum)
  {
    inputs: [{ internalType: "uint256", name: "bountyId", type: "uint256" }],
    name: "getBountyState",
    outputs: [{ internalType: "uint8", name: "state", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  // getRoundBounties(uint256 roundId)
  {
    inputs: [{ internalType: "uint256", name: "roundId", type: "uint256" }],
    name: "getRoundBounties",
    outputs: [
      { internalType: "uint256[]", name: "bountyIds", type: "uint256[]" },
    ],
    stateMutability: "view",
    type: "function",
  },
  // getCreatorBounties(address creator)
  {
    inputs: [{ internalType: "address", name: "creator", type: "address" }],
    name: "getCreatorBounties",
    outputs: [
      { internalType: "uint256[]", name: "bountyIds", type: "uint256[]" },
    ],
    stateMutability: "view",
    type: "function",
  },
  // getEscrowBalance(uint256 bountyId)
  {
    inputs: [{ internalType: "uint256", name: "bountyId", type: "uint256" }],
    name: "getEscrowBalance",
    outputs: [{ internalType: "uint256", name: "balance", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// ================================================================
// BountyClient Class (CP-017 updated)
// ================================================================

/**
 * BountyClient — TypeScript SDK for AEGIS Bounty Bonds
 *
 * CP-017 changes:
 * - getBounty() returns BountyRecord with `state: BountyState` (enum) not `claimed: boolean`
 * - createBounty() accepts `observationWindowBlocks` + `verificationWindowBlocks` (not `windowBlocks`)
 * - encodeProof() now encodes (agentAddress, roundId, volume, avgPrice) — required for proof binding
 * - isClaimable(), isClaimed(), isPaid(), isExpired() state helpers added
 * - claimBounty() checks state == Unclaimed, not `!claimed`
 * - expireBounty() checks state (both Unclaimed+obs and Claimed+verif paths)
 */
export class BountyClient {
  private bountyContract: ethers.Contract;
  private usdcContract: ethers.Contract;

  /**
   * Initialize BountyClient
   * @param provider ethers.Provider for read-only operations
   * @param signer ethers.Signer for write operations
   * @param bountyAddress Deployed Bounty.sol contract address
   * @param usdcAddress USDC token contract address
   */
  constructor(
    private readonly provider: ethers.Provider,
    private readonly signer: ethers.Signer,
    private readonly bountyAddress: string,
    private readonly usdcAddress: string
  ) {
    if (!ethers.isAddress(bountyAddress)) {
      throw new Error("BountyClient: invalid bounty contract address");
    }
    if (!ethers.isAddress(usdcAddress)) {
      throw new Error("BountyClient: invalid USDC address");
    }

    this.bountyContract = new ethers.Contract(bountyAddress, BOUNTY_ABI, signer);

    const usdcAbi = [
      "function approve(address spender, uint256 amount) returns (bool)",
      "function allowance(address owner, address spender) view returns (uint256)",
      "function transfer(address to, uint256 amount) returns (bool)",
      "function transferFrom(address from, address to, uint256 amount) returns (bool)",
    ];
    this.usdcContract = new ethers.Contract(usdcAddress, usdcAbi, signer);
  }

  // ================================================================
  // State Helpers (CP-017)
  // ================================================================

  /** True if bounty can be claimed (state == Unclaimed) */
  isClaimable(bounty: BountyRecord): boolean {
    return bounty.state === BountyState.Unclaimed;
  }

  /** True if bounty has been claimed (state == Claimed) */
  isClaimed(bounty: BountyRecord): boolean {
    return bounty.state === BountyState.Claimed;
  }

  /** True if bounty was paid out (terminal) */
  isPaid(bounty: BountyRecord): boolean {
    return bounty.state === BountyState.Paid;
  }

  /** True if bounty expired (terminal) */
  isExpired(bounty: BountyRecord): boolean {
    return bounty.state === BountyState.Expired;
  }

  /** True if bounty is in a terminal state (Paid or Expired) */
  isTerminal(bounty: BountyRecord): boolean {
    return bounty.state === BountyState.Paid || bounty.state === BountyState.Expired;
  }

  // ================================================================
  // Proof Encoding Helper (CP-017)
  // ================================================================

  /**
   * Encode a bounty verification proof.
   * CP-017: Proof now includes agentAddress and roundId for on-chain binding (HIGH-02 fix).
   * The volume and avgPrice are for off-chain logging only — on-chain Arena data governs.
   *
   * @param proof BountyClaimProof with agentAddress, roundId, volume, avgPrice
   * @returns ABI-encoded bytes suitable for verifyAndPay()
   */
  encodeProof(proof: BountyClaimProof): string {
    return ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "uint256", "uint256", "uint256"],
      [proof.agentAddress, proof.roundId, proof.volume, proof.avgPrice]
    );
  }

  // ================================================================
  // Core Write Methods
  // ================================================================

  /**
   * Create a new bounty.
   *
   * CP-017: condition now requires `observationWindowBlocks` + `verificationWindowBlocks`
   * instead of the old single `windowBlocks` field.
   *
   * @param params CreateBountyParams (roundId, rewardAmount, condition)
   */
  async createBounty(params: CreateBountyParams): Promise<{
    txHash: string;
    bountyId: bigint;
  }> {
    const { roundId, rewardAmount, condition } = params;

    if (roundId <= 0n) throw new Error("createBounty: roundId must be > 0");
    if (rewardAmount <= 0n) throw new Error("createBounty: rewardAmount must be > 0");
    if (condition.minVolumeUsdc <= 0n) throw new Error("createBounty: minVolumeUsdc must be > 0");
    if (condition.observationWindowBlocks <= 0n) {
      throw new Error("createBounty: observationWindowBlocks must be > 0");
    }
    if (condition.verificationWindowBlocks <= 0n) {
      throw new Error("createBounty: verificationWindowBlocks must be > 0");
    }
    if (condition.targetPriceMin > condition.targetPriceMax) {
      throw new Error("createBounty: targetPriceMin must be <= targetPriceMax");
    }

    // Check and set USDC allowance
    const signerAddress = await this.signer.getAddress();
    const currentAllowance = (await this.usdcContract.allowance(
      signerAddress,
      this.bountyAddress
    )) as bigint;

    if (currentAllowance < rewardAmount) {
      console.log(
        `[BountySDK] Approving USDC: current ${currentAllowance}, needed ${rewardAmount}`
      );
      const approveTx = await this.usdcContract.approve(this.bountyAddress, rewardAmount);
      await approveTx.wait();
    }

    const tx = await this.bountyContract.createBounty(roundId, rewardAmount, [
      condition.minVolumeUsdc,
      condition.targetPriceMin,
      condition.targetPriceMax,
      condition.observationWindowBlocks,
      condition.verificationWindowBlocks,
    ]);

    const receipt = await tx.wait();
    if (!receipt) throw new Error("createBounty: transaction failed or timed out");

    const signerAddr = await this.signer.getAddress();
    const creatorBounties = (await this.bountyContract.getCreatorBounties(signerAddr)) as bigint[];
    const bountyId = creatorBounties[creatorBounties.length - 1];

    console.log(`[BountySDK] Created bounty ${bountyId} in round ${roundId} reward ${rewardAmount}`);

    return { txHash: receipt.hash, bountyId };
  }

  /**
   * Claim a bounty.
   * CP-017: Checks state == Unclaimed (not !claimed boolean).
   *
   * @param bountyId The bounty to claim
   */
  async claimBounty(bountyId: bigint): Promise<ClaimBountyResult> {
    if (bountyId <= 0n) throw new Error("claimBounty: bountyId must be > 0");

    const bounty = await this.getBounty(bountyId);
    if (!bounty) throw new Error(`claimBounty: bounty ${bountyId} not found`);

    if (!this.isClaimable(bounty)) {
      throw new Error(
        `claimBounty: bounty ${bountyId} not claimable (state=${BountyState[bounty.state]})`
      );
    }

    const currentBlock = BigInt(await this.provider.getBlockNumber());
    if (currentBlock >= bounty.createdAt + bounty.condition.observationWindowBlocks) {
      throw new Error(`claimBounty: bounty ${bountyId} observation window elapsed`);
    }

    const tx = await this.bountyContract.claimBounty(bountyId);
    const receipt = await tx.wait();
    if (!receipt) throw new Error("claimBounty: transaction failed or timed out");

    const claimer = await this.signer.getAddress();
    console.log(`[BountySDK] Claimed bounty ${bountyId}`);

    return {
      txHash: receipt.hash,
      bountyId,
      claimer,
      blockNumber: BigInt(receipt.blockNumber),
    };
  }

  /**
   * Verify a bounty claim and execute payout (server/owner only).
   * CP-017: proof must be encoded with encodeProof() — includes agentAddress + roundId.
   *
   * @param bountyId The bounty to verify
   * @param proof ABI-encoded proof from encodeProof()
   */
  async verifyAndSettle(
    bountyId: bigint,
    proof: string
  ): Promise<{ txHash: string; payout: bigint }> {
    if (bountyId <= 0n) throw new Error("verifyAndSettle: bountyId must be > 0");
    if (!proof) throw new Error("verifyAndSettle: proof required");

    const bounty = await this.getBounty(bountyId);
    if (!bounty) throw new Error(`verifyAndSettle: bounty ${bountyId} not found`);

    if (!this.isClaimed(bounty)) {
      throw new Error(
        `verifyAndSettle: bounty ${bountyId} not in Claimed state (state=${BountyState[bounty.state]})`
      );
    }

    const tx = await this.bountyContract.verifyAndPay(bountyId, proof);
    const receipt = await tx.wait();
    if (!receipt) throw new Error("verifyAndSettle: transaction failed or timed out");

    console.log(`[BountySDK] Verified bounty ${bountyId} payout ${bounty.rewardAmount}`);

    return { txHash: receipt.hash, payout: bounty.rewardAmount };
  }

  /**
   * Expire a bounty and refund the creator.
   * CP-017: Works for both Unclaimed (obs window) and Claimed (verif window) states.
   *
   * @param bountyId The bounty to expire
   */
  async expireBounty(bountyId: bigint): Promise<{ txHash: string; refund: bigint }> {
    if (bountyId <= 0n) throw new Error("expireBounty: bountyId must be > 0");

    const bounty = await this.getBounty(bountyId);
    if (!bounty) throw new Error(`expireBounty: bounty ${bountyId} not found`);

    const currentBlock = BigInt(await this.provider.getBlockNumber());

    // Validate: must be in an expirable state
    const unclaimedExpired =
      bounty.state === BountyState.Unclaimed &&
      currentBlock >= bounty.createdAt + bounty.condition.observationWindowBlocks;

    const claimedExpired =
      bounty.state === BountyState.Claimed &&
      currentBlock >= bounty.claimedAt + bounty.condition.verificationWindowBlocks;

    if (!unclaimedExpired && !claimedExpired) {
      throw new Error(
        `expireBounty: bounty ${bountyId} cannot be expired (state=${BountyState[bounty.state]}, block=${currentBlock})`
      );
    }

    const tx = await this.bountyContract.expireBounty(bountyId);
    const receipt = await tx.wait();
    if (!receipt) throw new Error("expireBounty: transaction failed or timed out");

    console.log(`[BountySDK] Expired bounty ${bountyId} refund ${bounty.rewardAmount}`);

    return { txHash: receipt.hash, refund: bounty.rewardAmount };
  }

  // ================================================================
  // View Methods
  // ================================================================

  /**
   * Get bounty details.
   * CP-017: Returns BountyRecord with `state: BountyState` enum, `createdAt`, `claimedAt`.
   *         Old `claimed: boolean`, `expiresAt`, `claimTxBlock` fields are REMOVED.
   */
  async getBounty(bountyId: bigint): Promise<BountyRecord | null> {
    if (bountyId <= 0n) throw new Error("getBounty: bountyId must be > 0");

    try {
      const bountyTuple = (await this.bountyContract.getBounty(bountyId)) as [
        bigint,    // bountyId
        string,    // creator
        bigint,    // rewardAmount
        bigint,    // roundId
        string,    // conditionHash
        [bigint, bigint, bigint, bigint, bigint],  // condition (5 fields)
        bigint,    // state (uint8 → BountyState)
        string,    // claimedBy
        bigint,    // createdAt
        bigint     // claimedAt
      ];

      const [
        id,
        creator,
        reward,
        roundId,
        conditionHash,
        conditionTuple,
        stateRaw,
        claimedBy,
        createdAt,
        claimedAt,
      ] = bountyTuple;

      const bounty: BountyRecord = {
        bountyId: id,
        creator: ethers.getAddress(creator),
        rewardAmount: reward,
        roundId,
        conditionHash,
        condition: {
          minVolumeUsdc: conditionTuple[0],
          targetPriceMin: conditionTuple[1],
          targetPriceMax: conditionTuple[2],
          observationWindowBlocks: conditionTuple[3],
          verificationWindowBlocks: conditionTuple[4],
        },
        state: Number(stateRaw) as BountyState,
        claimedBy: ethers.getAddress(claimedBy),
        createdAt,
        claimedAt,
      };

      return bounty;
    } catch (error) {
      console.error(`[BountySDK] Error fetching bounty ${bountyId}:`, error);
      return null;
    }
  }

  /** Get all bounties for a round */
  async getRoundBounties(roundId: bigint): Promise<bigint[]> {
    if (roundId <= 0n) throw new Error("getRoundBounties: roundId must be > 0");
    try {
      return (await this.bountyContract.getRoundBounties(roundId)) as bigint[];
    } catch (error) {
      console.error(`[BountySDK] Error fetching bounties for round ${roundId}:`, error);
      return [];
    }
  }

  /** Get all bounties created by an agent */
  async getCreatorBounties(creatorAddress: string): Promise<bigint[]> {
    if (!creatorAddress || !ethers.isAddress(creatorAddress)) {
      throw new Error("getCreatorBounties: invalid address");
    }
    try {
      return (await this.bountyContract.getCreatorBounties(creatorAddress)) as bigint[];
    } catch (error) {
      console.error(`[BountySDK] Error fetching bounties for ${creatorAddress}:`, error);
      return [];
    }
  }

  /** Get escrow balance for a bounty */
  async getEscrowBalance(bountyId: bigint): Promise<bigint> {
    if (bountyId <= 0n) throw new Error("getEscrowBalance: bountyId must be > 0");
    try {
      return (await this.bountyContract.getEscrowBalance(bountyId)) as bigint;
    } catch (error) {
      console.error(`[BountySDK] Error fetching escrow for ${bountyId}:`, error);
      return 0n;
    }
  }

  /** Get the raw BountyState enum value for a bounty */
  async getBountyState(bountyId: bigint): Promise<BountyState> {
    if (bountyId <= 0n) throw new Error("getBountyState: bountyId must be > 0");
    const raw = (await this.bountyContract.getBountyState(bountyId)) as bigint;
    return Number(raw) as BountyState;
  }
}

// ================================================================
// Standalone Helper Functions
// ================================================================

/** Create a new bounty */
export async function createBounty(
  client: BountyClient,
  roundId: bigint,
  rewardAmountUsdc: bigint,
  condition: BountyCondition
): Promise<bigint> {
  const result = await client.createBounty({ roundId, rewardAmount: rewardAmountUsdc, condition });
  return result.bountyId;
}

/** Claim a bounty */
export async function claimBounty(
  client: BountyClient,
  bountyId: bigint
): Promise<void> {
  await client.claimBounty(bountyId);
}

/** Get bounty details */
export async function getBounty(
  client: BountyClient,
  bountyId: bigint
): Promise<BountyRecord | null> {
  return client.getBounty(bountyId);
}

/** Get all bounties for a round */
export async function getRoundBounties(
  client: BountyClient,
  roundId: bigint
): Promise<bigint[]> {
  return client.getRoundBounties(roundId);
}

/** Get all bounties created by an agent */
export async function getCreatorBounties(
  client: BountyClient,
  creatorAddress: string
): Promise<bigint[]> {
  return client.getCreatorBounties(creatorAddress);
}

/** Get escrow balance for a bounty */
export async function getEscrowBalance(
  client: BountyClient,
  bountyId: bigint
): Promise<bigint> {
  return client.getEscrowBalance(bountyId);
}

/**
 * Verify a bounty claim and execute payout.
 * CP-017: proof must be encoded with client.encodeProof() — includes agentAddress + roundId.
 */
export async function verifyBountyClaim(
  client: BountyClient,
  bountyId: bigint,
  proof: string
): Promise<boolean> {
  const result = await client.verifyAndSettle(bountyId, proof);
  return !!result.txHash;
}

/** Re-export BountyState for SDK consumers */
export { BountyState };
