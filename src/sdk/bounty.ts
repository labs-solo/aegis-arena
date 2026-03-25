/// AEGIS Arena Bounty SDK — Agent-to-Agent USDC Rewards
/// CP-013 Agent 2 Implementation

import { ethers } from "ethers";
import {
  BountyCondition,
  BountyRecord,
  CreateBountyParams,
  ClaimBountyResult,
} from './types.js';

// ================================================================
// Bounty Contract ABI (minimal, for MVP)
// ================================================================

const BOUNTY_ABI = [
  // createBounty(uint256 roundId, uint256 rewardAmount, (uint256,uint256,uint256,uint64) condition)
  {
    inputs: [
      { internalType: "uint256", name: "roundId", type: "uint256" },
      { internalType: "uint256", name: "rewardAmount", type: "uint256" },
      {
        components: [
          { internalType: "uint256", name: "minVolumeUsdc", type: "uint256" },
          { internalType: "uint256", name: "targetPriceMin", type: "uint256" },
          { internalType: "uint256", name: "targetPriceMax", type: "uint256" },
          { internalType: "uint64", name: "windowBlocks", type: "uint64" },
        ],
        internalType: "struct IBounty.BountyCondition",
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
  // verifyAndPay(uint256 bountyId, bytes snapshotProof)
  {
    inputs: [
      { internalType: "uint256", name: "bountyId", type: "uint256" },
      { internalType: "bytes", name: "snapshotProof", type: "bytes" },
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
              { internalType: "uint64", name: "windowBlocks", type: "uint64" },
            ],
            internalType: "struct IBounty.BountyCondition",
            name: "condition",
            type: "tuple",
          },
          { internalType: "uint64", name: "expiresAt", type: "uint64" },
          { internalType: "bool", name: "claimed", type: "bool" },
          { internalType: "address", name: "claimedBy", type: "address" },
          { internalType: "uint256", name: "claimTxBlock", type: "uint256" },
        ],
        internalType: "struct IBounty.Bounty",
        name: "bounty",
        type: "tuple",
      },
    ],
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
  // Standard ERC20 approve for USDC
  {
    inputs: [
      { internalType: "address", name: "spender", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  // Standard ERC20 allowance for USDC
  {
    inputs: [
      { internalType: "address", name: "owner", type: "address" },
      { internalType: "address", name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// ================================================================
// BountyClient Class
// ================================================================

/**
 * BountyClient — TypeScript SDK for AEGIS Bounty Bonds
 *
 * Provides type-safe methods to create, claim, and manage bounties
 * between AI agents in AEGIS Arena.
 */
export class BountyClient {
  private bountyContract: ethers.Contract;
  private usdcContract: ethers.Contract;

  /**
   * Initialize BountyClient with provider, signer, and contract addresses
   *
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
    // Validate addresses
    if (!ethers.isAddress(bountyAddress)) {
      throw new Error("BountyClient: invalid bounty contract address");
    }
    if (!ethers.isAddress(usdcAddress)) {
      throw new Error("BountyClient: invalid USDC address");
    }

    // Initialize contract instances
    this.bountyContract = new ethers.Contract(
      bountyAddress,
      BOUNTY_ABI,
      signer
    );

    // USDC is a standard ERC20 contract
    const usdcAbi = [
      "function approve(address spender, uint256 amount) returns (bool)",
      "function allowance(address owner, address spender) view returns (uint256)",
      "function transfer(address to, uint256 amount) returns (bool)",
      "function transferFrom(address from, address to, uint256 amount) returns (bool)",
    ];
    this.usdcContract = new ethers.Contract(usdcAddress, usdcAbi, signer);
  }

  /**
   * Create a new bounty
   *
   * WHAT: Posts a USDC reward for agents to claim if they meet trading conditions
   * WHY: Enables agent-to-agent payments; PassiveLP creates, others claim
   *
   * @param params CreateBountyParams (roundId, rewardAmount, condition)
   * @returns { txHash, bountyId } Transaction hash and the newly created bounty ID
   * @throws Error if USDC approval fails, condition is invalid, or tx fails
   */
  async createBounty(params: CreateBountyParams): Promise<{
    txHash: string;
    bountyId: bigint;
  }> {
    const { roundId, rewardAmount, condition } = params;

    // Validate inputs
    if (roundId <= 0n) {
      throw new Error("createBounty: roundId must be > 0");
    }
    if (rewardAmount <= 0n) {
      throw new Error("createBounty: rewardAmount must be > 0");
    }
    if (condition.minVolumeUsdc <= 0n) {
      throw new Error("createBounty: minVolumeUsdc must be > 0");
    }
    if (condition.windowBlocks <= 0n) {
      throw new Error("createBounty: windowBlocks must be > 0");
    }
    if (condition.targetPriceMin > condition.targetPriceMax) {
      throw new Error(
        "createBounty: targetPriceMin must be <= targetPriceMax"
      );
    }

    // Check and set USDC allowance
    const signerAddress = await this.signer.getAddress();
    const currentAllowance = (await this.usdcContract.allowance(
      signerAddress,
      this.bountyAddress
    )) as bigint;

    if (currentAllowance < rewardAmount) {
      console.log(
        `[BountySDK] Approving USDC: current allowance ${currentAllowance}, needed ${rewardAmount}`
      );
      const approveTx = await this.usdcContract.approve(
        this.bountyAddress,
        rewardAmount
      );
      await approveTx.wait();
      console.log(`[BountySDK] USDC approval confirmed`);
    }

    // Call createBounty on contract
    const tx = await this.bountyContract.createBounty(roundId, rewardAmount, [
      condition.minVolumeUsdc,
      condition.targetPriceMin,
      condition.targetPriceMax,
      condition.windowBlocks,
    ]);

    const receipt = await tx.wait();
    if (!receipt) {
      throw new Error("createBounty: transaction failed or timed out");
    }

    // Extract bountyId from event logs (BountyCreated event)
    // For now, we'll query the contract after the transaction
    const signerAddr = await this.signer.getAddress();
    const creatorBounties = (await this.bountyContract.getCreatorBounties(
      signerAddr
    )) as bigint[];
    const bountyId = creatorBounties[creatorBounties.length - 1];

    console.log(
      `[BountySDK] Created bounty ${bountyId} in round ${roundId} with reward ${rewardAmount} USDC`
    );

    return {
      txHash: receipt.hash,
      bountyId,
    };
  }

  /**
   * Claim a bounty
   *
   * WHAT: Submit a claim for a specific bounty (before verification)
   * WHY: Marks bounty as claimed; server then verifies conditions and pays out
   *
   * @param bountyId The bounty to claim
   * @returns ClaimBountyResult { txHash, bountyId, claimer, blockNumber }
   * @throws Error if bounty not found, already claimed, expired, or tx fails
   */
  async claimBounty(bountyId: bigint): Promise<ClaimBountyResult> {
    if (bountyId <= 0n) {
      throw new Error("claimBounty: bountyId must be > 0");
    }

    // Get bounty state first (fail fast if not found)
    const bounty = await this.getBounty(bountyId);
    if (!bounty) {
      throw new Error(`claimBounty: bounty ${bountyId} not found`);
    }

    if (bounty.claimed) {
      throw new Error(
        `claimBounty: bounty ${bountyId} already claimed by ${bounty.claimedBy}`
      );
    }

    const currentBlock = await this.provider.getBlockNumber();
    if (currentBlock >= Number(bounty.expiresAt)) {
      throw new Error(`claimBounty: bounty ${bountyId} has expired`);
    }

    // Call claimBounty on contract
    const tx = await this.bountyContract.claimBounty(bountyId);
    const receipt = await tx.wait();

    if (!receipt) {
      throw new Error("claimBounty: transaction failed or timed out");
    }

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
   * Get bounty details
   *
   * WHAT: Query full bounty record
   * WHY: Agents evaluate bounties before claiming
   *
   * @param bountyId The bounty to retrieve
   * @returns BountyRecord or null if not found
   */
  async getBounty(bountyId: bigint): Promise<BountyRecord | null> {
    if (bountyId <= 0n) {
      throw new Error("getBounty: bountyId must be > 0");
    }

    try {
      const bountyTuple = (await this.bountyContract.getBounty(bountyId)) as [
        bigint,
        string,
        bigint,
        bigint,
        string,
        [bigint, bigint, bigint, bigint],
        bigint,
        boolean,
        string,
        bigint
      ];

      const [
        id,
        creator,
        reward,
        roundId,
        conditionHash,
        conditionTuple,
        expiresAt,
        claimed,
        claimedBy,
        claimTxBlock,
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
          windowBlocks: conditionTuple[3],
        },
        expiresAt,
        claimed,
        claimedBy: ethers.getAddress(claimedBy),
        claimTxBlock,
      };

      return bounty;
    } catch (error) {
      // Contract may revert if bounty not found
      console.error(`[BountySDK] Error fetching bounty ${bountyId}:`, error);
      return null;
    }
  }

  /**
   * Get all bounties for a round
   *
   * WHAT: Query all active bounties in a round
   * WHY: Agents discover bounties to claim
   *
   * @param roundId The Arena round
   * @returns Array of bounty IDs
   */
  async getRoundBounties(roundId: bigint): Promise<bigint[]> {
    if (roundId <= 0n) {
      throw new Error("getRoundBounties: roundId must be > 0");
    }

    try {
      const bountyIds = (await this.bountyContract.getRoundBounties(
        roundId
      )) as bigint[];
      return bountyIds || [];
    } catch (error) {
      console.error(
        `[BountySDK] Error fetching bounties for round ${roundId}:`,
        error
      );
      return [];
    }
  }

  /**
   * Get all bounties created by an agent
   *
   * WHAT: Query bounties posted by a specific creator
   * WHY: Agents track their own bounties
   *
   * @param creatorAddress The agent address
   * @returns Array of bounty IDs
   */
  async getCreatorBounties(creatorAddress: string): Promise<bigint[]> {
    if (!creatorAddress || !ethers.isAddress(creatorAddress)) {
      throw new Error("getCreatorBounties: invalid address");
    }

    try {
      const bountyIds = (await this.bountyContract.getCreatorBounties(
        creatorAddress
      )) as bigint[];
      return bountyIds || [];
    } catch (error) {
      console.error(
        `[BountySDK] Error fetching bounties for creator ${creatorAddress}:`,
        error
      );
      return [];
    }
  }

  /**
   * Get escrow balance for a bounty
   *
   * WHAT: Query USDC held in escrow
   * WHY: Verify bounty has funds before claiming
   *
   * @param bountyId The bounty
   * @returns USDC amount (6 decimals)
   */
  async getEscrowBalance(bountyId: bigint): Promise<bigint> {
    if (bountyId <= 0n) {
      throw new Error("getEscrowBalance: bountyId must be > 0");
    }

    try {
      const balance = (await this.bountyContract.getEscrowBalance(
        bountyId
      )) as bigint;
      return balance || 0n;
    } catch (error) {
      console.error(
        `[BountySDK] Error fetching escrow balance for bounty ${bountyId}:`,
        error
      );
      return 0n;
    }
  }

  /**
   * Verify a bounty claim (server-side only)
   *
   * WHAT: Validate proof and trigger payout
   * WHY: Called by server after off-chain condition validation
   *
   * @param bountyId The bounty to verify
   * @param snapshotProof Encoded proof (volume, price)
   * @returns true if verification succeeded and payout executed
   * @throws Error if verification fails
   */
  async verifyAndSettle(
    bountyId: bigint,
    snapshotProof: string
  ): Promise<{
    txHash: string;
    payout: bigint;
  }> {
    if (bountyId <= 0n) {
      throw new Error("verifyAndSettle: bountyId must be > 0");
    }
    if (!snapshotProof) {
      throw new Error("verifyAndSettle: snapshotProof required");
    }

    // Get bounty for payout info
    const bounty = await this.getBounty(bountyId);
    if (!bounty) {
      throw new Error(`verifyAndSettle: bounty ${bountyId} not found`);
    }

    // Call verifyAndPay on contract
    const tx = await this.bountyContract.verifyAndPay(
      bountyId,
      snapshotProof
    );
    const receipt = await tx.wait();

    if (!receipt) {
      throw new Error("verifyAndSettle: transaction failed or timed out");
    }

    console.log(
      `[BountySDK] Verified and paid out bounty ${bountyId} (${bounty.rewardAmount} USDC)`
    );

    return {
      txHash: receipt.hash,
      payout: bounty.rewardAmount,
    };
  }

  /**
   * Expire a bounty and refund the creator
   *
   * WHAT: Refund USDC escrow for unclaimed bounty after window expires
   * WHY: Creator recovers funds if no one claims the bounty
   *
   * @param bountyId The bounty to expire
   * @returns { txHash, refund } Transaction hash and refund amount
   * @throws Error if bounty not found, not yet expired, or tx fails
   */
  async expireBounty(bountyId: bigint): Promise<{
    txHash: string;
    refund: bigint;
  }> {
    if (bountyId <= 0n) {
      throw new Error("expireBounty: bountyId must be > 0");
    }

    // Get bounty info
    const bounty = await this.getBounty(bountyId);
    if (!bounty) {
      throw new Error(`expireBounty: bounty ${bountyId} not found`);
    }

    const currentBlock = await this.provider.getBlockNumber();
    if (currentBlock < Number(bounty.expiresAt)) {
      throw new Error(
        `expireBounty: bounty ${bountyId} has not expired yet`
      );
    }

    // Call expireBounty on contract
    const tx = await this.bountyContract.expireBounty(bountyId);
    const receipt = await tx.wait();

    if (!receipt) {
      throw new Error("expireBounty: transaction failed or timed out");
    }

    console.log(
      `[BountySDK] Expired bounty ${bountyId} (refund: ${bounty.rewardAmount} USDC)`
    );

    return {
      txHash: receipt.hash,
      refund: bounty.rewardAmount,
    };
  }
}

// ================================================================
// Standalone Helper Functions
// ================================================================

/**
 * Create a new bounty (functional wrapper)
 *
 * WHAT: Posts a USDC reward for agents to claim if they meet trading conditions
 * WHY: Enables agent-to-agent payments; PassiveLP creates, others claim
 *
 * @param client Initialized BountyClient
 * @param roundId Arena round ID
 * @param rewardAmountUsdc USDC reward (6 decimals)
 * @param condition BountyCondition with volume/price targets
 * @returns bountyId The newly created bounty ID
 * @throws Error if USDC approval fails or condition is invalid
 */
export async function createBounty(
  client: BountyClient,
  roundId: bigint,
  rewardAmountUsdc: bigint,
  condition: BountyCondition
): Promise<bigint> {
  const result = await client.createBounty({
    roundId,
    rewardAmount: rewardAmountUsdc,
    condition,
  });
  return result.bountyId;
}

/**
 * Claim a bounty (functional wrapper)
 *
 * WHAT: Submit a claim for a specific bounty (before verification)
 * WHY: Marks bounty as claimed; server then verifies conditions and pays out
 *
 * @param client Initialized BountyClient
 * @param bountyId The bounty to claim
 * @throws Error if bounty not found, already claimed, or expired
 */
export async function claimBounty(
  client: BountyClient,
  bountyId: bigint
): Promise<void> {
  await client.claimBounty(bountyId);
}

/**
 * Get bounty details (functional wrapper)
 *
 * WHAT: Query full bounty record
 * WHY: Agents evaluate bounties before claiming
 *
 * @param client Initialized BountyClient
 * @param bountyId The bounty to retrieve
 * @returns BountyRecord or null if not found
 */
export async function getBounty(
  client: BountyClient,
  bountyId: bigint
): Promise<BountyRecord | null> {
  return client.getBounty(bountyId);
}

/**
 * Get all bounties for a round (functional wrapper)
 *
 * WHAT: Query all active bounties in a round
 * WHY: Agents discover bounties to claim
 *
 * @param client Initialized BountyClient
 * @param roundId The Arena round
 * @returns Array of bounty IDs
 */
export async function getRoundBounties(
  client: BountyClient,
  roundId: bigint
): Promise<bigint[]> {
  return client.getRoundBounties(roundId);
}

/**
 * Get all bounties created by an agent (functional wrapper)
 *
 * WHAT: Query bounties posted by a specific creator
 * WHY: Agents track their own bounties
 *
 * @param client Initialized BountyClient
 * @param creatorAddress The agent address
 * @returns Array of bounty IDs
 */
export async function getCreatorBounties(
  client: BountyClient,
  creatorAddress: string
): Promise<bigint[]> {
  return client.getCreatorBounties(creatorAddress);
}

/**
 * Get escrow balance for a bounty (functional wrapper)
 *
 * WHAT: Query USDC held in escrow
 * WHY: Verify bounty has funds before claiming
 *
 * @param client Initialized BountyClient
 * @param bountyId The bounty
 * @returns USDC amount (6 decimals)
 */
export async function getEscrowBalance(
  client: BountyClient,
  bountyId: bigint
): Promise<bigint> {
  return client.getEscrowBalance(bountyId);
}

/**
 * Verify a bounty claim and execute payout (functional wrapper)
 *
 * WHAT: Validate proof and trigger payout
 * WHY: Called by server after off-chain condition validation
 *
 * @param client Initialized BountyClient
 * @param bountyId The bounty to verify
 * @param snapshotProof Encoded proof (volume, price)
 * @returns true if verification succeeded and payout executed
 * @throws Error if verification fails
 */
export async function verifyBountyClaim(
  client: BountyClient,
  bountyId: bigint,
  snapshotProof: string
): Promise<boolean> {
  const result = await client.verifyAndSettle(bountyId, snapshotProof);
  return !!result.txHash;
}
