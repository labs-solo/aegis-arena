/// AEGIS Arena SDK Main Export

// Types
export * from "./types";

// Opcodes
export * from "./opcodes";

// Router encoding
export * from "./router";

// Borrow flow (3-batch pattern)
export * from "./borrow-flow";

// Configuration
export const KNOWN_ADDRESSES = {
  POOL_MANAGER: "0x360e68faCcca8cA495c1B759Fd9EEe466db9FB32",
  STATE_VIEW: "0x76fd297e2d437cd7f76d50f01afe6160f86e9990",
  PERMIT2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
  WOKB: "0xe538905cf8410324e03A5A23C1c177a474D59b2b",
  USDC: "0x74b7f16337b8972027f6196a17a631ac6de26d22",
  UNIVERSAL_ROUTER: "0x35029f7AD06B7d62C4511239d65CEbF0f1124338",
  LIVE_POOL_ID:
    "0x9072107b33ad70c231602b537d91774a43c1837f9b28040ee9bf8cad0a0ab4a1",
} as const;

export const CHAIN_CONFIG = {
  chainId: 196,
  name: "X Layer",
  rpc: "https://rpc.xlayer.tech",
} as const;
