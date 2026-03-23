/// Bounty Bonds HTTP Routes
/// CP-013 Agent 4 Implementation
/// 
/// Handles bounty creation, claiming, verification, and status queries
/// /api/bounties/* endpoints with x402 integration on claim route

import { Router, Request, Response } from "express";
import { ethers } from "ethers";
import { x402Middleware } from "../middleware/x402";

const router = Router();

// ================================================================
// GET /api/bounties/:roundId
// List active bounties for a round
// ================================================================

/**
 * WHAT: Query all active bounties in a round
 * WHY: Agents discover bounties to claim
 * 
 * @route GET /api/bounties/:roundId
 * @returns { roundId, bounties[], count }
 */
router.get("/:roundId", async (req: Request, res: Response) => {
  try {
    const { roundId } = req.params;

    // Validate input
    if (!roundId || isNaN(Number(roundId))) {
      return res.status(400).json({
        error: "Invalid roundId",
        code: "INVALID_ROUND_ID",
      });
    }

    // Call contract: getRoundBounties(roundId)
    // In production: would call contract via ethers
    // For MVP: return mock bounties
    
    const bountyId = parseInt(roundId) * 100 + Math.floor(Math.random() * 10);
    const bounties = [
      {
        bountyId,
        creator: "0x1234567890123456789012345678901234567890",
        rewardAmount: "1000000000", // 1000 USDC (6 decimals)
        roundId: parseInt(roundId),
        condition: {
          minVolumeUsdc: "10000000000", // 10k USDC
          targetPriceMin: "950000000",
          targetPriceMax: "1050000000",
          windowBlocks: 100,
        },
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
        claimed: false,
        claimedBy: "0x0000000000000000000000000000000000000000",
        claimTxBlock: 0,
      },
    ];

    res.json({
      success: true,
      data: {
        roundId: parseInt(roundId),
        bounties,
        count: bounties.length,
      },
    });
  } catch (error) {
    console.error("[BountyServer] GET /bounties/:roundId error:", error);
    res.status(500).json({
      error: "Failed to list bounties",
      code: "LIST_BOUNTIES_FAILED",
    });
  }
});

// ================================================================
// POST /api/bounties/create
// Create a new bounty (agent posts reward)
// ================================================================

/**
 * WHAT: Create bounty by posting USDC reward
 * WHY: PassiveLP creates bounties for other agents to claim
 * 
 * @route POST /api/bounties/create
 * @body { roundId, rewardAmount, condition: { minVolumeUsdc, targetPriceMin, targetPriceMax, windowBlocks } }
 * @returns { success, data: { bountyId, roundId, rewardAmount, message } }
 */
router.post("/create", async (req: Request, res: Response) => {
  try {
    const { roundId, rewardAmount, condition } = req.body;

    // Validate required fields
    if (!roundId || !rewardAmount || !condition) {
      return res.status(400).json({
        error: "Missing required fields: roundId, rewardAmount, condition",
        code: "MISSING_REQUIRED_FIELDS",
      });
    }

    // Validate condition structure
    if (
      !condition.minVolumeUsdc ||
      !condition.targetPriceMin ||
      !condition.targetPriceMax ||
      !condition.windowBlocks
    ) {
      return res.status(400).json({
        error: "Invalid bounty condition structure",
        code: "INVALID_CONDITION",
      });
    }

    // In production: verify caller has USDC balance and allowance
    // Call Bounty.createBounty() via ethers
    // For MVP: return mock bounty ID
    const bountyId = Math.floor(Math.random() * 1000000) + 1000;

    console.log(
      `[BountyServer] Created bounty ${bountyId} in round ${roundId} ` +
        `with reward ${rewardAmount} USDC`
    );

    res.json({
      success: true,
      data: {
        bountyId,
        roundId,
        rewardAmount,
        message: "Bounty created successfully",
      },
    });
  } catch (error) {
    console.error("[BountyServer] POST /bounties/create error:", error);
    res.status(500).json({
      error: "Failed to create bounty",
      code: "CREATE_BOUNTY_FAILED",
    });
  }
});

// ================================================================
// POST /api/bounties/claim
// Claim a bounty (requires x402 token to prevent spam)
// ================================================================

/**
 * WHAT: Submit claim for a bounty (first step; verification is next)
 * WHY: Agent submits claim before server verifies conditions
 * NOTE: Requires valid x402 token (payment for server verification work)
 * 
 * @route POST /api/bounties/claim
 * @middleware x402Middleware (validates x402 payment token)
 * @body { bountyId }
 * @returns { success, data: { bountyId, claimedBy, message } }
 */
router.post("/claim", x402Middleware, async (req: Request, res: Response) => {
  try {
    const { bountyId } = req.body;

    // Validate input
    if (!bountyId || isNaN(Number(bountyId))) {
      return res.status(400).json({
        error: "Invalid bountyId",
        code: "INVALID_BOUNTY_ID",
      });
    }

    // Get claimer address from x402 context (set by middleware)
    const claimerAddress =
      (req as any).x402?.agentId || "0x0000000000000000000000000000000000000000";

    // In production: verify bounty exists and is unclaimed
    // Call Bounty.claimBounty() via ethers
    // For MVP: return success

    console.log(
      `[BountyServer] Claim submitted for bounty ${bountyId} by ${claimerAddress}`
    );

    res.json({
      success: true,
      data: {
        bountyId,
        claimedBy: claimerAddress,
        message: "Bounty claim submitted; awaiting verification",
      },
    });
  } catch (error) {
    console.error("[BountyServer] POST /bounties/claim error:", error);
    res.status(500).json({
      error: "Failed to submit bounty claim",
      code: "CLAIM_BOUNTY_FAILED",
    });
  }
});

// ================================================================
// POST /api/bounties/verify
// Verify bounty claim and execute payout (server-initiated, owner-only)
// ================================================================

/**
 * WHAT: Validate proof and transfer USDC to claimant
 * WHY: Called by server after off-chain condition verification
 * NOTE: Owner-only for MVP; post-hackathon: signer whitelist
 * 
 * @route POST /api/bounties/verify
 * @body { bountyId, snapshotProof }
 * @returns { success, data: { bountyId, payout, claimedBy, txHash, message } }
 */
router.post("/verify", async (req: Request, res: Response) => {
  try {
    const { bountyId, snapshotProof } = req.body;

    // Validate inputs
    if (!bountyId || !snapshotProof) {
      return res.status(400).json({
        error: "Missing bountyId or snapshotProof",
        code: "MISSING_VERIFICATION_FIELDS",
      });
    }

    // Verify caller is authorized (owner-only for MVP)
    const authHeader = req.headers.authorization;
    const isOwner =
      authHeader === `Bearer ${process.env.BOUNTY_VERIFY_SECRET || "owner-secret"}`;

    if (!isOwner) {
      return res.status(403).json({
        error: "Only owner can verify bounties",
        code: "UNAUTHORIZED_VERIFIER",
      });
    }

    // Decode snapshot proof
    let volume: bigint;
    let avgPrice: bigint;

    try {
      if (typeof snapshotProof === "string") {
        // Parse JSON or hex-encoded proof
        if (snapshotProof.startsWith("[")) {
          const [vol, price] = JSON.parse(snapshotProof);
          volume = BigInt(vol);
          avgPrice = BigInt(price);
        } else {
          // Assume ABI-encoded bytes, would need decoding
          return res.status(400).json({
            error: "Snapshot proof format not supported",
            code: "INVALID_PROOF_FORMAT",
          });
        }
      } else {
        return res.status(400).json({
          error: "Snapshot proof must be a string",
          code: "INVALID_PROOF_TYPE",
        });
      }
    } catch (parseError) {
      return res.status(400).json({
        error: "Failed to parse snapshot proof",
        code: "PROOF_PARSE_ERROR",
      });
    }

    // Get bounty from contract (mock for MVP)
    const bounty = {
      bountyId,
      creator: "0x1234567890123456789012345678901234567890",
      rewardAmount: BigInt("1000000000"),
      roundId: 1,
      condition: {
        minVolumeUsdc: BigInt("10000000000"),
        targetPriceMin: BigInt("950000000"),
        targetPriceMax: BigInt("1050000000"),
        windowBlocks: 100n,
      },
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      claimed: true,
      claimedBy: "0xabcd1234567890abcd1234567890abcd12345678",
    };

    // Validate conditions
    if (volume < bounty.condition.minVolumeUsdc) {
      return res.status(400).json({
        error: "Volume insufficient",
        code: "INSUFFICIENT_VOLUME",
        required: bounty.condition.minVolumeUsdc.toString(),
        actual: volume.toString(),
      });
    }

    if (
      avgPrice < bounty.condition.targetPriceMin ||
      avgPrice > bounty.condition.targetPriceMax
    ) {
      return res.status(400).json({
        error: "Price out of range",
        code: "PRICE_OUT_OF_RANGE",
        required: [
          bounty.condition.targetPriceMin.toString(),
          bounty.condition.targetPriceMax.toString(),
        ],
        actual: avgPrice.toString(),
      });
    }

    // In production: call Bounty.verifyAndPay() via ethers
    // This transfers USDC from escrow to claimant
    // For MVP: return mock tx hash
    const txHash =
      "0x" +
      Math.random()
        .toString(16)
        .substring(2)
        .padEnd(64, "0");

    console.log(
      `[BountyServer] Verified and paid bounty ${bountyId} ` +
        `to ${bounty.claimedBy} for ${bounty.rewardAmount.toString()} USDC (txHash: ${txHash})`
    );

    res.json({
      success: true,
      data: {
        bountyId,
        payout: bounty.rewardAmount.toString(),
        claimedBy: bounty.claimedBy,
        txHash,
        message: "Bounty verified and payout executed",
      },
    });
  } catch (error) {
    console.error("[BountyServer] POST /bounties/verify error:", error);
    res.status(500).json({
      error: "Failed to verify bounty",
      code: "VERIFY_BOUNTY_FAILED",
    });
  }
});

// ================================================================
// GET /api/bounties/:bountyId/status
// Query status of a specific bounty
// ================================================================

/**
 * WHAT: Get full bounty details and current state
 * WHY: Agents and server track bounty lifecycle
 * 
 * @route GET /api/bounties/:bountyId/status
 * @returns { success, data: { bountyId, status, bounty } }
 */
router.get("/:bountyId/status", async (req: Request, res: Response) => {
  try {
    const { bountyId } = req.params;

    // Validate input
    if (!bountyId || isNaN(Number(bountyId))) {
      return res.status(400).json({
        error: "Invalid bountyId",
        code: "INVALID_BOUNTY_ID",
      });
    }

    // In production: call Bounty.getBounty() via ethers
    // For MVP: return mock bounty
    const mockBounty = {
      bountyId: parseInt(bountyId),
      creator: "0x1234567890123456789012345678901234567890",
      rewardAmount: "1000000000",
      roundId: 1,
      condition: {
        minVolumeUsdc: "10000000000",
        targetPriceMin: "950000000",
        targetPriceMax: "1050000000",
        windowBlocks: 100,
      },
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      claimed: false,
      claimedBy: "0x0000000000000000000000000000000000000000",
      claimTxBlock: 0,
    };

    if (!mockBounty) {
      return res.status(404).json({
        error: "Bounty not found",
        code: "BOUNTY_NOT_FOUND",
      });
    }

    const status = mockBounty.claimed ? "CLAIMED" : "AVAILABLE";

    res.json({
      success: true,
      data: {
        bountyId: parseInt(bountyId),
        status,
        bounty: mockBounty,
      },
    });
  } catch (error) {
    console.error("[BountyServer] GET /bounties/:bountyId/status error:", error);
    res.status(500).json({
      error: "Failed to fetch bounty status",
      code: "FETCH_STATUS_FAILED",
    });
  }
});

export default router;
