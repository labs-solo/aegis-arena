// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

/// @title AegisDeployConfig
/// @notice Central configuration for all AEGIS Engine and X Layer addresses.
/// @dev **CRITICAL:** All addresses must be verified for X Layer (Chain ID 196)
library AegisDeployConfig {
  // ================================================================
  // AEGIS Engine Addresses (live on X Layer)
  // ================================================================

  /// @notice Uniswap v4 PoolManager
  address public constant POOL_MANAGER = 0x360e68faCcca8cA495c1B759Fd9EEe466db9FB32;

  /// @notice AEGIS Engine state view contract
  address public constant STATE_VIEW = 0x76fd297e2d437cd7f76d50f01afe6160f86e9990;

  /// @notice Permit2 for token approvals
  address public constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;

  /// @notice Uniswap Universal Router
  address public constant UNIVERSAL_ROUTER = 0x35029f7AD06B7d62C4511239d65CEbF0f1124338;

  // ================================================================
  // Token Addresses
  // ================================================================

  /// @notice OKB-X (wrapped native token on X Layer)
  address public constant WOKB = 0xe538905cf8410324e03A5A23C1c177a474D59b2b;

  /// @notice Circle USDC stablecoin
  address public constant USDC = 0x74b7f16337b8972027f6196a17a631ac6de26d22;

  // ================================================================
  // Pool Configuration
  // ================================================================

  /// @notice USDC/WOKB live pool ID (5 basis points fee)
  bytes32 public constant LIVE_POOL_ID = 0x9072107b33ad70c231602b537d91774a43c1837f9b28040ee9bf8cad0a0ab4a1;

  /// @notice Standard pool fee (500 = 0.05% = 5 bps)
  uint24 public constant POOL_FEE = 500;

  // ================================================================
  // AEGIS Engine PositionManager
  // ================================================================

  /// @notice **CRITICAL: Set from aegis-engine PR #18 (trail-of-bits-audit-fixes-and-improvements)**
  /// @dev Instructions: See docs/guides/POSITION_MANAGER_LOOKUP.md
  /// @dev This address enables debt modification with safe PositionManager unlock
  address public constant POSITION_MANAGER = address(0);  // TODO: Update with correct address from PR #18

  // ================================================================
  // AEGIS Router Opcode Constants (VERIFIED - DO NOT MODIFY)
  // ================================================================

  // Swap opcodes
  uint8 public constant OPCODE_SWAP_EXACT_IN_SINGLE = 0x06;
  uint8 public constant OPCODE_SWAP_EXACT_IN = 0x07;
  uint8 public constant OPCODE_SWAP_EXACT_OUT_SINGLE = 0x08;
  uint8 public constant OPCODE_SWAP_EXACT_OUT = 0x09;

  // AEGIS core opcodes
  uint8 public constant OPCODE_SETTLE_AE = 0x80;
  uint8 public constant OPCODE_TAKE_AE = 0x81;
  uint8 public constant OPCODE_CLOSE_AE = 0x82;
  uint8 public constant OPCODE_AE_CREATE_VAULT = 0x83;
  uint8 public constant OPCODE_AE_UNLOCK_VAULT = 0x84;
  uint8 public constant OPCODE_AE_LOCK_VAULT = 0x85;
  uint8 public constant OPCODE_AE_ATTACH_NFT = 0x86;
  uint8 public constant OPCODE_AE_DETACH_NFT = 0x87;
  uint8 public constant OPCODE_AE_DONATE_IDLE = 0x88;
  uint8 public constant OPCODE_AE_BURN_VAULT = 0x89;
  uint8 public constant OPCODE_AE_MODIFY_LIQUIDITY = 0x90;
  uint8 public constant OPCODE_AE_MODIFY_DEBT = 0x91;
  uint8 public constant OPCODE_AE_MODIFY_IDLE = 0x92;
  uint8 public constant OPCODE_AE_PEEL_OR_MICRO_LIQUIDATE = 0x96;

  // PositionManager opcodes
  uint8 public constant OPCODE_PM_SETTLE_FOR = 0xB0;
  uint8 public constant OPCODE_LOM_SETTLE_FOR = 0xB8;
  uint8 public constant OPCODE_PM_TAKE = 0xC0;
  uint8 public constant OPCODE_LOM_TAKE = 0xC4;
  uint8 public constant OPCODE_PM_CLOSE = 0xC2;
  uint8 public constant OPCODE_LOM_CLOSE = 0xC6;

  // ================================================================
  // Chain Configuration
  // ================================================================

  uint256 public constant CHAIN_ID = 196;
  string public constant RPC_URL = "https://rpc.xlayer.tech";
}
