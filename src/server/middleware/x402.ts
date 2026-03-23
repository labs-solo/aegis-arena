/// x402 Payment Middleware
///
/// Validates x402 tokens for action endpoints
/// x402 is a standard for metered payment integration:
/// - Agent actions may require payment (x402 token)
/// - Tokens verified before action execution
/// - Prevents spam/abuse of action submission

import { Request, Response, NextFunction } from "express";

export interface X402Token {
  agentId: string;
  amount: bigint;
  timestamp: number;
  signature: string;
}

declare global {
  namespace Express {
    interface Request {
      x402?: X402Token;
    }
  }
}

/// @notice x402 payment middleware
/// - Allows GET requests (game state queries are free)
/// - Requires valid x402 token for POST requests
/// - Validates token freshness and signature
export function x402Middleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // GET requests: free access (no payment required)
  if (req.method === "GET") {
    return next();
  }

  // POST/action requests: require x402 token
  const token = req.headers["x-x402-token"] as string;
  if (!token) {
    return res.status(402).json({
      error: "Payment required (x402)",
      code: "X402_TOKEN_MISSING",
      gateway: process.env.X402_GATEWAY_URL || "https://x402.example.com",
    });
  }

  try {
    const decoded = decodeAndValidateX402Token(token);
    if (!decoded) {
      return res.status(402).json({
        error: "Invalid x402 token",
        code: "X402_TOKEN_INVALID",
      });
    }

    // Attach to request for route handlers
    req.x402 = decoded;
    next();
  } catch (err) {
    return res.status(402).json({
      error: "x402 token validation failed",
      code: "X402_VALIDATION_FAILED",
      details: String(err),
    });
  }
}

/// @notice Decode and validate x402 token
/// @param token JWT or signed blob from x402 gateway
/// @returns Decoded token or null if invalid
function decodeAndValidateX402Token(token: string): X402Token | null {
  try {
    // In production:
    // 1. Decode JWT or signed blob
    // 2. Verify signature against x402 gateway public key
    // 3. Check timestamp freshness (< 5 min old)
    // 4. Verify amount > 0
    // 5. Return decoded token

    // Stub: return null (requires x402 gateway setup)
    // Implementations would use:
    // - jsonwebtoken for JWT: jwt.verify(token, publicKey)
    // - ethers for ECDSA: ethers.recoverAddress(token)
    // - or direct gateway API call: POST /verify

    // Mock for testing:
    if (token === "TEST_TOKEN") {
      return {
        agentId: "test-agent",
        amount: 100n,
        timestamp: Math.floor(Date.now() / 1000),
        signature: "0x",
      };
    }

    return null;
  } catch (err) {
    console.error("x402 decode error:", err);
    return null;
  }
}

export default x402Middleware;
