/// Agent Action Routes
///
/// Handles agent action submission for game rounds.
/// FIX #6: Single endpoint for both individual and batch actions (no route shadowing)

import { Router, Request, Response } from "express";

const router = Router();

interface ActionRequest {
  roundId: number;
  agentId: string;
  actions: any[] | any; // Can be single action or array
}

/// @notice POST /api/agent/action
/// Unified endpoint for both single action and batch submissions
/// FIX #6: Merged duplicate routes (previous: app.get, app.post)
router.post("/action", async (req: Request, res: Response) => {
  try {
    const { roundId, agentId, actions } = req.body as ActionRequest;

    // Validate input
    if (!roundId || !agentId) {
      return res.status(400).json({
        error: "Missing roundId or agentId",
      });
    }

    // Normalize actions to array
    const actionArray = Array.isArray(actions) ? actions : [actions];

    if (actionArray.length === 0) {
      return res.status(400).json({
        error: "No actions provided",
      });
    }

    // Submit to Arena contract
    const txHashes = await submitActionsToArena(
      roundId,
      agentId,
      actionArray,
      req
    );

    return res.json({
      success: true,
      roundId,
      agentId,
      actionCount: actionArray.length,
      txHashes,
    });
  } catch (err) {
    console.error("Action submission error:", err);
    return res.status(400).json({
      error: "Action submission failed",
      details: String(err),
    });
  }
});

/// @notice GET /api/agent/:roundId/:agentId
/// Query action history for an agent in a round
router.get("/:roundId/:agentId", async (req: Request, res: Response) => {
  try {
    const { roundId, agentId } = req.params;

    const history = await getActionHistory(parseInt(roundId), agentId);

    return res.json({
      roundId: parseInt(roundId),
      agentId,
      actionCount: history.length,
      actions: history,
    });
  } catch (err) {
    console.error("History query error:", err);
    return res.status(500).json({
      error: "Failed to query action history",
      details: String(err),
    });
  }
});

/// @notice Submit actions to Arena contract
/// @param roundId Current round
/// @param agentId Agent address
/// @param actions Array of encoded action bytes
/// @param req Express request (for x402 token if present)
/// @returns Array of transaction hashes (one per batch if batched)
async function submitActionsToArena(
  roundId: number,
  agentId: string,
  actions: any[],
  req: Request
): Promise<string[]> {
  // In production:
  // 1. Get Arena contract instance from Web3 provider
  // 2. Call arena.executeBatch(roundId, agentId, actions)
  // 3. Wait for transaction receipt
  // 4. Return tx hash

  // Stub: return mock tx hashes
  return actions.map((_, i) => `0x${(i + 1).toString().padStart(64, "0")}`);
}

/// @notice Query action history for an agent
/// @param roundId Round ID
/// @param agentId Agent address
/// @returns Array of action records
async function getActionHistory(
  roundId: number,
  agentId: string
): Promise<any[]> {
  // In production:
  // 1. Query Arena contract for events
  // 2. Filter ActionsExecuted events for (roundId, agentId)
  // 3. Decode action bytes and return

  // Stub: return empty
  return [];
}

export default router;
