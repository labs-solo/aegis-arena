/// AEGIS Arena Server
///
/// Express.js orchestration server for:
/// - Agent action submission
/// - Game state queries
/// - x402 payment integration
/// - Scoring endpoints

import express, { Express } from "express";
import agentActionsRoutes from "./routes/agent-actions";
import bountiesRouter from "./routes/bounties";
import x402Middleware from "./middleware/x402";
import { createArenaClientFromConfig, createArenaServiceConfigFromEnv } from "./services/arena";

const app: Express = express();
const PORT = process.env.SERVER_PORT || 3000;
const HOST = process.env.SERVER_HOST || "0.0.0.0";

// ================================================================
// Middleware
// ================================================================

// Parse JSON request bodies
app.use(express.json());

// x402 payment middleware
// - Allows GET requests (free)
// - Requires x402 token for POST requests
app.use(x402Middleware);

// ================================================================
// Routes
// ================================================================

app.use("/api/agent", agentActionsRoutes);
app.use("/api/bounties", bountiesRouter);

// ================================================================
// Health check
// ================================================================

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "AEGIS Arena",
  });
});

// ================================================================
// Game state endpoints (public)
// ================================================================

app.get("/api/game/state/:roundId", async (req, res) => {
  try {
    const roundId = BigInt(req.params.roundId);
    const arenaClient = createArenaClientFromConfig(createArenaServiceConfigFromEnv(process.env));
    const roundState = await arenaClient.getRoundState(roundId);
    const agentStates = await Promise.all(
      roundState.agents.map(async (agent) => ({
        agent,
        execution: await arenaClient.getAgentExecutionState(roundId, agent),
      }))
    );

    res.json({
      ...roundState,
      agents: agentStates.map(({ agent }) => agent),
      agentStates: agentStates.map(({ agent, execution }) => ({
        agent,
        vaultId: execution.vaultId.toString(),
        executionCount: execution.executionCount.toString(),
        actionCount: execution.actionCount.toString(),
        cumulativeVolumeUsdc: execution.cumulativeVolumeUsdc.toString(),
        latestAvgPriceX96: execution.latestAvgPriceX96.toString(),
        lastExecutionBlock: execution.lastExecutionBlock.toString(),
        lastSurface: execution.lastSurface,
        lastBatchHash: execution.lastBatchHash,
        lastProofEligible: execution.lastProofEligible,
      })),
    });
  } catch (err) {
    res.status(500).json({
      error: "Failed to fetch game state",
      details: String(err),
    });
  }
});

// ================================================================
// Scoring endpoints
// ================================================================

app.get("/api/game/scores/:roundId", async (req, res) => {
  try {
    const roundId = BigInt(req.params.roundId);
    const arenaClient = createArenaClientFromConfig(createArenaServiceConfigFromEnv(process.env));
    const roundState = await arenaClient.getRoundState(roundId);

    if (roundState.settled) {
      const finalScores = await arenaClient.getFinalScores(roundId);
      return res.json({
        roundId: roundState.roundId,
        settled: true,
        scoreBasis: "arena_settlement",
        agentsRanked: finalScores.agentsRanked,
        scores: finalScores.scores.map((value) => value.toString()),
        prizes: finalScores.prizes.map((value) => value.toString()),
      });
    }

    const liveStates = await Promise.all(
      roundState.agents.map(async (agent) => ({
        agent,
        state: await arenaClient.getAgentExecutionState(roundId, agent),
      }))
    );
    liveStates.sort((left, right) => {
      if (right.state.cumulativeVolumeUsdc === left.state.cumulativeVolumeUsdc) {
        return 0;
      }
      return right.state.cumulativeVolumeUsdc > left.state.cumulativeVolumeUsdc ? 1 : -1;
    });

    res.json({
      roundId: roundState.roundId,
      settled: false,
      scoreBasis: "arena_reported_execution_volume",
      settlementStatus: "final economic settlement not implemented on-chain; reporting Arena-backed execution volume until settle() is upgraded",
      agentsRanked: liveStates.map(({ agent }) => agent),
      scores: liveStates.map(({ state }) => state.cumulativeVolumeUsdc.toString()),
      prizes: [],
    });
  } catch (err) {
    res.status(500).json({
      error: "Failed to fetch scores",
      details: String(err),
    });
  }
});

// ================================================================
// Error handling
// ================================================================

app.use((err: any, req: express.Request, res: express.Response) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    error: "Internal server error",
    details: String(err.message),
  });
});

// ================================================================
// Start server
// ================================================================

app.listen(PORT, () => {
  console.log(`AEGIS Arena server listening on ${HOST}:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Agent registration: POST http://localhost:${PORT}/api/agent/register`);
  console.log(`Agent actions: POST http://localhost:${PORT}/api/agent/action`);
  console.log(`Arena bindings: GET http://localhost:${PORT}/api/agent/bindings/:roundId`);
  console.log(`Game state: GET http://localhost:${PORT}/api/game/state/:roundId`);
  console.log(`Scoring: GET http://localhost:${PORT}/api/game/scores/:roundId`);
  console.log(`Bounty endpoints: GET|POST http://localhost:${PORT}/api/bounties`);
  console.log(`  - GET /bounties/:roundId — list active bounties`);
  console.log(`  - POST /bounties/create — create a bounty`);
  console.log(`  - POST /bounties/claim — claim a bounty (x402 required)`);
  console.log(`  - POST /bounties/verify — verify and settle claim`);
  console.log(`  - GET /bounties/:bountyId/status — bounty status`);
});

export default app;
