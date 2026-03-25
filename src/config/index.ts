// src/config/index.ts
// Single source of truth for all configuration.
// Eliminates HACKATHON_POOL and scattered address constants.

export const CONFIG = {
  // Network
  rpcUrl: process.env.RPC_URL ?? "http://localhost:8545",
  privateKey: process.env.PRIVATE_KEY ?? "0x" + "0".repeat(64),

  // Contracts (required — will fail at runtime if missing and zero-address)
  arenaAddress: process.env.ARENA_ADDRESS ?? "0x0000000000000000000000000000000000000000",
  bountyAddress: process.env.BOUNTY_ADDRESS ?? "0x0000000000000000000000000000000000000000",

  // Live X Layer Pool: WOKB/USD₮0
  // Corrected from USDC/WOKB (old hackathon addresses)
  pool: {
    address: process.env.POOL_ADDRESS ?? "0x0000000000000000000000000000000000000000",
    token0: "0xe538905cf8410324e03A5A23C1c177a474D59b2b",  // WOKB (Wrapped OKB)
    token1: "0x779Ded0c9e1022225f8E0630b35a9b54bE713736",  // USD₮0
    fee: 3000,  // 0.3%
  },

  // USD token (for bounty rewards)
  usdToken: "0x779Ded0c9e1022225f8E0630b35a9b54bE713736",  // USD₮0

  // OKX Gateway (for simulation)
  gatewayUrl: process.env.GATEWAY_URL ?? "https://www.okx.com/web3/build/dev-tools/pre-execution",

  // Server
  port: parseInt(process.env.PORT ?? "3000"),
} as const;
