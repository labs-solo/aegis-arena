// src/server/index.ts
// CP-020: Fix error handler arity (LOW-01) — 4 params required for Express error middleware
// CP-020: Remove global x402 — applied per-route in routes/bounties.ts
// CP-020: Factory function (accepts orchestrator and bountyClient as params)

import express from "express";
import { GameOrchestrator } from "../orchestrator/game-loop.js";
import { BountyClient } from "../contracts/bounty.js";
import { createAgentActionsRouter } from "./routes/agent-actions.js";
import { createBountiesRouter } from "./routes/bounties.js";

export function createServer(
  orchestrator: GameOrchestrator,
  bountyClient: BountyClient
): express.Express {
  const app = express();
  app.use(express.json());

  // CP-020: x402 middleware NOT applied globally here
  // Applied only on /api/bounties/claim in routes/bounties.ts

  app.use("/api/agent", createAgentActionsRouter(orchestrator));
  app.use("/api/bounties", createBountiesRouter(bountyClient));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString(), service: "AEGIS Arena" });
  });

  // Game state (Phase 2: wire to ArenaClient)
  app.get("/api/game/state/:roundId", async (req, res) => {
    res.json({ roundId: parseInt(req.params.roundId), status: "Phase2: wire to ArenaClient" });
  });

  // CP-020 FIX (LOW-01): Error handler with correct arity — 4 params required.
  // Express identifies error middleware by the 4-parameter signature.
  // With 3 params, Express treats it as regular middleware and errors propagate unhandled.
  app.use(
    (
      err: Error,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction  // required 4th param
    ) => {
      console.error("[Server] Unhandled error:", err);
      res.status(500).json({
        error: "Internal server error",
        message: process.env.NODE_ENV === "development" ? err.message : undefined,
      });
    }
  );

  return app;
}

export default createServer;
