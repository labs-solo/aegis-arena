/// AEGIS Router Opcode Constants (VERIFIED - DO NOT MODIFY)
/// These must match AegisDeployConfig.sol exactly

export const OPCODES = {
  // ================================================================
  // Swap Opcodes
  // ================================================================
  SWAP_EXACT_IN_SINGLE: 0x06,
  SWAP_EXACT_IN: 0x07,
  SWAP_EXACT_OUT_SINGLE: 0x08,
  SWAP_EXACT_OUT: 0x09,

  // ================================================================
  // AEGIS Core Opcodes
  // ================================================================
  SETTLE_AE: 0x80,
  TAKE_AE: 0x81,
  CLOSE_AE: 0x82,
  AE_CREATE_VAULT: 0x83,
  AE_UNLOCK_VAULT: 0x84,
  AE_LOCK_VAULT: 0x85,
  AE_ATTACH_NFT: 0x86,
  AE_DETACH_NFT: 0x87,
  AE_DONATE_IDLE: 0x88,
  AE_BURN_VAULT: 0x89,
  AE_MODIFY_LIQUIDITY: 0x90,
  AE_MODIFY_DEBT: 0x91,
  AE_MODIFY_IDLE: 0x92,
  AE_PEEL_OR_MICRO_LIQUIDATE: 0x96,

  // ================================================================
  // PositionManager Opcodes
  // ================================================================
  PM_SETTLE_FOR: 0xb0,
  LOM_SETTLE_FOR: 0xb8,
  PM_TAKE: 0xc0,
  LOM_TAKE: 0xc4,
  PM_CLOSE: 0xc2,
  LOM_CLOSE: 0xc6,
} as const;

/// Get opcode name from value
export function getOpcodeName(opcode: number): string {
  const entries = Object.entries(OPCODES);
  const found = entries.find(([_, value]) => value === opcode);
  return found ? found[0] : `UNKNOWN_0x${opcode.toString(16).padStart(2, "0")}`;
}

/// Verify opcode is valid
export function isValidOpcode(opcode: number): boolean {
  return Object.values(OPCODES).includes(opcode as any);
}
