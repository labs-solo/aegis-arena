/// Agent Action Routes
///
/// Handles agent action submission for game rounds.
/// FIX #6: Single endpoint for both individual and batch actions (no route shadowing)

import { Router, Request, Response } from "express";
import { ethers } from "ethers";
import { createArenaClientFromConfig, createArenaServiceConfigFromEnv } from "../services/arena";
import { encodeArenaExecutionMetadata } from "../../sdk/router";

const router = Router();

interface ActionRequest {
  roundId: number;
  agentId: string;
  actions: string[] | string;
  executionMetadata?: {
    surface: string;
    volumeUsdc: string | number | bigint;
    avgPriceX96: string | number | bigint;
  };
}

interface RegisterRequest {
  agents: string[];
  vaultIds: Array<string | number>;
  requireOwnerMatch?: boolean;
}

router.post("/register", async (req: Request, res: Response) => {
  try {
    const { agents, vaultIds, requireOwnerMatch } = req.body as RegisterRequest;

    if (!Array.isArray(agents) || !Array.isArray(vaultIds) || agents.length === 0) {
      return res.status(400).json({
        error: "agents and vaultIds must be non-empty arrays",
      });
    }

    if (agents.length !== vaultIds.length) {
      return res.status(400).json({
        error: "agents and vaultIds length mismatch",
      });
    }

    const config = createArenaServiceConfigFromEnv(process.env, {
      requireSigner: true,
    });
    const arenaClient = createArenaClientFromConfig(config);
    const normalizedAgents = agents.map((agent) => ethers.getAddress(agent));
    const normalizedVaultIds = vaultIds.map((vaultId) => BigInt(vaultId));

    const result = await arenaClient.registerAgents(
      {
        agents: normalizedAgents,
        vaultIds: normalizedVaultIds,
      },
      { requireOwnerMatch: Boolean(requireOwnerMatch) }
    );

    return res.json({
      success: true,
      roundId: result.roundId.toString(),
      txHash: result.txHash,
      bindings: result.bindings.map((binding) => ({
        agent: binding.agent,
        vaultId: binding.vaultId.toString(),
      })),
      validationResults: result.validationResults.map((validation) => ({
        vaultId: validation.vaultId.toString(),
        valid: validation.valid,
        owner: validation.owner,
        evidence: validation.evidence,
        limitations: validation.limitations,
      })),
    });
  } catch (err) {
    console.error("Registration error:", err);
    return res.status(503).json({
      error: "Arena registration unavailable",
      details: String(err),
    });
  }
});

router.get("/bindings/:roundId", async (req: Request, res: Response) => {
  try {
    const roundId = BigInt(req.params.roundId);
    const config = createArenaServiceConfigFromEnv(process.env);
    const arenaClient = createArenaClientFromConfig(config);
    const bindings = await arenaClient.getRoundBindings(roundId);

    return res.json({
      roundId: roundId.toString(),
      bindings: bindings.map((binding) => ({
        agent: binding.agent,
        vaultId: binding.vaultId.toString(),
      })),
    });
  } catch (err) {
    console.error("Binding query error:", err);
    return res.status(503).json({
      error: "Failed to query Arena bindings",
      details: String(err),
    });
  }
});

router.get("/bindings/:roundId/:agentId", async (req: Request, res: Response) => {
  try {
    const roundId = BigInt(req.params.roundId);
    const agentId = ethers.getAddress(req.params.agentId);
    const config = createArenaServiceConfigFromEnv(process.env);
    const arenaClient = createArenaClientFromConfig(config);
    const vaultId = await arenaClient.getAgentVault(roundId, agentId);

    return res.json({
      roundId: roundId.toString(),
      agent: agentId,
      vaultId: vaultId.toString(),
    });
  } catch (err) {
    console.error("Agent binding query error:", err);
    return res.status(503).json({
      error: "Failed to query Arena agent binding",
      details: String(err),
    });
  }
});

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
    const txHashes = await submitActionsToArena(roundId, agentId, actionArray, req);

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
  actions: string[],
  req: Request
): Promise<string[]> {
  const config = createArenaServiceConfigFromEnv(process.env, {
    requireSigner: true,
  });
  const arenaClient = createArenaClientFromConfig(config);

  const normalizedActions = actions.map((action, index) => {
    if (typeof action !== "string" || !ethers.isHexString(action)) {
      throw new Error(`Action at index ${index} must be a hex string`);
    }
    return action;
  });

  const metadata = (req.body as ActionRequest).executionMetadata;
  const batch = metadata
    ? [
        encodeArenaExecutionMetadata({
          surface: ethers.getAddress(metadata.surface),
          volumeUsdc: BigInt(metadata.volumeUsdc),
          avgPriceX96: BigInt(metadata.avgPriceX96),
        }),
        ...normalizedActions,
      ]
    : normalizedActions;

  const result = await arenaClient.executeBatch(
    BigInt(roundId),
    ethers.getAddress(agentId),
    batch
  );

  return [result.txHash];
}

/// @notice Query action history for an agent
/// @param roundId Round ID
/// @param agentId Agent address
/// @returns Array of action records
async function getActionHistory(
  roundId: number,
  agentId: string
): Promise<any[]> {
  const config = createArenaServiceConfigFromEnv(process.env);
  const arenaClient = createArenaClientFromConfig(config);
  return arenaClient.getActionHistory(BigInt(roundId), ethers.getAddress(agentId));
}

export default router;
