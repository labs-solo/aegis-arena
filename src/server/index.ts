/// AEGIS Arena Server
///
/// Express.js orchestration server for:
/// - Agent action submission
/// - Game state queries
/// - x402 payment integration
/// - Scoring endpoints

import express, { Express } from "express";
import agentActionsRoutes from "./routes/agent-actions";
import x402Middleware from "./middleware/x402";

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
    const roundId = parseInt(req.params.roundId);

    // In production: query Arena contract
    // Arena.getRoundState(roundId) returns:
    // - startTime, endTime, roundDuration, settled, agents[]

    const mockState = {
      roundId,
      startTime: Math.floor(Date.now() / 1000),
      endTime: Math.floor(Date.now() / 1000) + 3600,
      roundDuration: 3600,
      settled: false,
      agents: [
        "0x1111111111111111111111111111111111111111",
        "0x2222222222222222222222222222222222222222",
        "0x3333333333333333333333333333333333333333",
      ],
    };

    res.json(mockState);
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
    const roundId = parseInt(req.params.roundId);

    // In production: query Arena.getFinalScores(roundId)
    // Returns: agentsRanked[], scores[], prizes[]

    const mockScores = {
      roundId,
      settled: false,
      agentsRanked: [],
      scores: [],
      prizes: [],
    };

    res.json(mockScores);
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
  console.log(`Agent actions: POST http://localhost:${PORT}/api/agent/action`);
  console.log(`Game state: GET http://localhost:${PORT}/api/game/state/:roundId`);
  console.log(`Scoring: GET http://localhost:${PORT}/api/game/scores/:roundId`);
});

export default app;
