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
  address public constant POOL_MANAGER = 0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32;

  /// @notice AEGIS Engine state view contract
  address public constant STATE_VIEW = 0x76Fd297e2D437cd7f76d50F01AfE6160f86e9990;

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
  address public constant USDC = 0x74b7F16337b8972027F6196A17a631aC6dE26d22;

  // ================================================================
  // Pool Configuration
  // ================================================================

  /// @notice USDC/WOKB live pool ID (5 basis points fee)
  bytes32 public constant LIVE_POOL_ID = 0x9072107b33ad70c231602b537d91774a43c1837f9b28040ee9bf8cad0a0ab4a1;

  /// @notice Standard pool fee (500 = 0.05% = 5 bps)
  uint24 public constant POOL_FEE = 500;

  // ================================================================
  // AEGIS Engine Contracts — X Layer (Chain 196) — 2026-03-24
  // ================================================================

  /// @notice AEGIS Engine main contract
  address public constant AEGIS_ENGINE = 0x1b0ed1d21b5AB3Db311C1aC386DC874081914935;

  /// @notice AEGIS Hook (Uniswap v4 hook for AEGIS Engine)
  address public constant AEGIS_HOOK = 0xc54aC33a60BeED0c10C32D8E4434166AF68550cc;

  /// @notice AEGIS Router V1 (routing and swap execution)
  address public constant AEGIS_ROUTER_V1 = 0xb2830032E19A85e03cDE678FF93Da659C90CAFe5;

  /// @notice AEGIS State View contract
  address public constant AEGIS_STATE_VIEW = 0xE962612Dc9dcC3a7666F5Fa6B014b3b1D9287D27;

  /// @notice Vault Registry (position and vault tracking)
  address public constant VAULT_REGISTRY = 0xe19414e5C3DB1596f583d18d3Ac5bb43CBabc50D;

  /// @notice Oracle Manager (price feeds and oracle coordination)
  address public constant ORACLE_MANAGER = 0x355dAd86872DE8248538E487Ef8898e0a4E31f70;

  /// @notice Limit Order Manager (limit order execution)
  address public constant LIMIT_ORDER_MANAGER = 0xCc7F9dC1C6BA855E2507c9C65910B48A7F6497C1;

  /// @notice Dynamic Fee Manager (fee curve management)
  address public constant DYNAMIC_FEE_MANAGER = 0xA5571554A47deDEb667f91d60ADCb645a2Ef1780;

  /// @notice Variable Interest Rate contract (rate calculations)
  address public constant VARIABLE_INTEREST_RATE = 0xCCDECda074d8411651AC1B8FD87c5CA7551f28F6;

  /// @notice PositionManager — manages debt modifications with safe PositionManager unlock
  address public constant POSITION_MANAGER = 0xcF1EAFC6928dC385A342E7C6491d371d2871458b;

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
