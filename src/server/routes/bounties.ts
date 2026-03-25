// src/server/routes/bounties.ts
// CP-020: Wired to BountyClient — no mock data (SRC-HIGH-04)
// CP-020: x402 applied explicitly only on /claim

import express from "express";
import { BountyClient, BountyState } from "../../contracts/bounty.js";
import { x402Middleware } from "../middleware/x402.js";

export function createBountiesRouter(bountyClient: BountyClient) {
  const router = express.Router();

  // GET /api/bounties/:roundId — list bounties (real data)
  router.get("/:roundId", async (req, res) => {
    try {
      const roundId = BigInt(req.params.roundId);
      const bountyIds = await bountyClient.getRoundBounties(roundId);
      const bounties = await Promise.all(bountyIds.map((id) => bountyClient.getBounty(id)));
      res.json({
        success: true,
        data: {
          roundId: Number(roundId),
          bounties: bounties.map((b) => ({
            ...b,
            bountyId: b?.bountyId.toString(),
            rewardAmount: b?.rewardAmount.toString(),
            state: b ? BountyState[b.state] : undefined,
          })),
          count: bounties.length,
        },
      });
    } catch (e) {
      res.status(500).json({ error: "Failed to list bounties", details: String(e) });
    }
  });

  // POST /api/bounties/create
  router.post("/create", async (req, res) => {
    try {
      const { roundId, rewardAmount, condition } = req.body as {
        roundId: string;
        rewardAmount: string;
        condition: {
          minVolumeUsdc: string;
          targetPriceMin: string;
          targetPriceMax: string;
          observationWindowBlocks: string;
          verificationWindowBlocks: string;
        };
      };

      if (!roundId || !rewardAmount || !condition) {
        return res.status(400).json({ error: "Missing required fields: roundId, rewardAmount, condition" });
      }

      const result = await bountyClient.createBounty({
        roundId: BigInt(roundId),
        rewardAmount: BigInt(rewardAmount),
        condition: {
          minVolumeUsdc: BigInt(condition.minVolumeUsdc),
          targetPriceMin: BigInt(condition.targetPriceMin),
          targetPriceMax: BigInt(condition.targetPriceMax),
          observationWindowBlocks: BigInt(condition.observationWindowBlocks),
          verificationWindowBlocks: BigInt(condition.verificationWindowBlocks),
        },
      });
      return res.json({ success: true, data: { bountyId: result.bountyId.toString(), txHash: result.txHash } });
    } catch (e) {
      return res.status(500).json({ error: "Failed to create bounty", details: String(e) });
    }
  });

  // POST /api/bounties/claim — x402 applied explicitly here (not globally)
  router.post("/claim", x402Middleware, async (req, res) => {
    try {
      const { bountyId } = req.body as { bountyId: string };
      if (!bountyId) {
        return res.status(400).json({ error: "Missing bountyId" });
      }
      const result = await bountyClient.claimBounty(BigInt(bountyId));
      return res.json({ success: true, data: { txHash: result.txHash, claimer: result.claimer } });
    } catch (e) {
      return res.status(500).json({ error: "Failed to claim bounty", details: String(e) });
    }
  });

  // POST /api/bounties/verify
  router.post("/verify", async (req, res) => {
    try {
      const { bountyId, proof } = req.body as { bountyId: string; proof: string };
      if (!bountyId || !proof) {
        return res.status(400).json({ error: "Missing bountyId or proof" });
      }
      const result = await bountyClient.verifyAndSettle(BigInt(bountyId), proof);
      return res.json({ success: true, data: { txHash: result.txHash, payout: result.payout.toString() } });
    } catch (e) {
      return res.status(500).json({ error: "Failed to verify bounty", details: String(e) });
    }
  });

  // GET /api/bounties/:bountyId/status
  router.get("/:bountyId/status", async (req, res) => {
    try {
      const bounty = await bountyClient.getBounty(BigInt(req.params.bountyId));
      if (!bounty) return res.status(404).json({ error: "Bounty not found" });
      return res.json({
        success: true,
        data: {
          bountyId: bounty.bountyId.toString(),
          state: BountyState[bounty.state],
          rewardAmount: bounty.rewardAmount.toString(),
          creator: bounty.creator,
          claimedBy: bounty.claimedBy,
        },
      });
    } catch (e) {
      return res.status(500).json({ error: "Failed to fetch bounty status", details: String(e) });
    }
  });

  return router;
}

export default createBountiesRouter;
