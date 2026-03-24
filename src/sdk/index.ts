/// AEGIS Arena SDK Main Export

// Types
export * from "./types";

// Opcodes
export * from "./opcodes";

// Router encoding
export * from "./router";

// Borrow flow (3-batch pattern)
export * from "./borrow-flow";

// Bounty SDK (CP-013)
export * from "./bounty";

// Gateway SDK (CP-014)
export * from "./gateway";

// Market Data SDK (CP-015 OKX Market API)
export { MarketClient } from "./market";

// Configuration
export const KNOWN_ADDRESSES = {
  // Uniswap v4 Infrastructure
  POOL_MANAGER: "0x360e68faCcca8cA495c1B759Fd9EEe466db9FB32",
  PERMIT2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
  UNIVERSAL_ROUTER: "0x35029f7AD06B7d62C4511239d65CEbF0f1124338",
  
  // AEGIS Engine Contracts
  AEGIS_ENGINE: "0x1b0ed1d21b5AB3Db311C1aC386DC874081914935",
  AEGIS_HOOK: "0xc54aC33a60BeED0c10C32D8E4434166AF68550cc",
  AEGIS_ROUTER_V1: "0xb2830032E19A85e03cDE678FF93Da659C90CAFe5",
  AEGIS_STATE_VIEW: "0xE962612Dc9dcC3a7666F5Fa6B014b3b1D9287D27",
  VAULT_REGISTRY: "0xe19414e5C3DB1596f583d18d3Ac5bb43CBabc50D",
  ORACLE_MANAGER: "0x355dAd86872DE8248538E487Ef8898e0a4E31f70",
  LIMIT_ORDER_MANAGER: "0xCc7F9dC1C6BA855E2507c9C65910B48A7F6497C1",
  DYNAMIC_FEE_MANAGER: "0xA5571554A47deDEb667f91d60ADCb645a2Ef1780",
  VARIABLE_INTEREST_RATE: "0xCCDECda074d8411651AC1B8FD87c5CA7551f28F6",
  POSITION_MANAGER: "0xcF1EAFC6928dC385A342E7C6491d371d2871458b",
  
  // State and View
  STATE_VIEW: "0x76fd297e2d437cd7f76d50f01afe6160f86e9990",
  
  // Tokens
  WOKB: "0xe538905cf8410324e03A5A23C1c177a474D59b2b",
  USDC: "0x74b7f16337b8972027f6196a17a631ac6de26d22",
  
  // Pool
  LIVE_POOL_ID:
    "0x9072107b33ad70c231602b537d91774a43c1837f9b28040ee9bf8cad0a0ab4a1",
} as const;

export const HACKATHON_POOL = {
  poolId: "0xd5a401023b6ee3ae340bfadb90758385dc9d2463a20dc24e43e913bc7f209cf4",
  name: "OKB / USD₮0",
  token0: "0x0000000000000000000000000000000000000000", // native OKB
  token0Name: "OKB",
  token1: "0x779Ded0c9e1022225f8E0630b35a9b54bE713736", // USD₮0 (6 decimals)
  token1Name: "USD₮0",
  token1Decimals: 6,
  chainId: 196,
  hook: "0xc54aC33a60BeED0c10C32D8E4434166AF68550cc",
  hookName: "AEGIS Hook",
  explorerUrl: "https://app.uniswap.org/explore/pools/xlayer/0xd5a401023b6ee3ae340bfadb90758385dc9d2463a20dc24e43e913bc7f209cf4",
} as const;

export const CHAIN_CONFIG = {
  chainId: 196,
  name: "X Layer",
  rpc: "https://rpc.xlayer.tech",
} as const;
