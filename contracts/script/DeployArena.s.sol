// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../Arena.sol";

/// @title DeployArenaScript
/// @notice Foundry deployment script for Arena.sol on X Layer
/// @dev CP-018: Arena constructor now requires prizeToken (ERC-20 for prize distribution)
contract DeployArenaScript is Script {
  function run() external {
    uint256 deployerKey = vm.envUint("ORCHESTRATOR_PRIVATE_KEY");
    // CP-018: prizeToken address — USDC on X Layer (or env override for testnet)
    address prizeToken = vm.envOr("PRIZE_TOKEN", address(0xA8CE8aee21bC2A48a5EF670afCc9274C7bbbC035)); // USDC on X Layer

    vm.startBroadcast(deployerKey);

    Arena arena = new Arena(prizeToken);
    console.log("Arena deployed at:", address(arena));
    console.log("Prize token:", prizeToken);

    vm.stopBroadcast();
  }
}
