// src/server/routes/agent-actions.ts
// CP-020: Wired to orchestrator.submitAction() — no mock tx hashes (SRC-HIGH-04)

import express from "express";
import { GameOrchestrator } from "../../orchestrator/game-loop.js";

export function createAgentActionsRouter(orchestrator: GameOrchestrator) {
  const router = express.Router();

  // POST /api/agent/action
  router.post("/action", async (req, res) => {
    try {
      const { roundId, agentId, actions } = req.body as {
        roundId: number;
        agentId: string;
        actions: string | string[];
      };

      if (!roundId || !agentId) {
        return res.status(400).json({ error: "Missing roundId or agentId" });
      }

      const actionArray: string[] = Array.isArray(actions) ? actions : [actions];
      if (actionArray.length === 0) {
        return res.status(400).json({ error: "No actions provided" });
      }

      // CP-020: real orchestrator.submitAction() — no mock hashes
      const result = await orchestrator.submitAction({ roundId, agentId, actions: actionArray });

      return res.json({
        success: result.success,
        txHash: result.txHash,
        error: result.error,
        roundId,
        agentId,
        actionCount: actionArray.length,
      });
    } catch (e) {
      return res.status(500).json({ error: "Action submission failed", details: String(e) });
    }
  });

  // GET /api/agent/:roundId/:agentId
  router.get("/:roundId/:agentId", async (_req, res) => {
    res.json({ actions: [], note: "Phase 2: query Arena event logs" });
  });

  return router;
}

export default createAgentActionsRouter;
