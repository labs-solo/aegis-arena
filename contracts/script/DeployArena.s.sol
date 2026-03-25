// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../Arena.sol";

/// @title DeployArenaScript
/// @notice Foundry deployment script for Arena.sol on X Layer
contract DeployArenaScript is Script {
  function run() external {
    uint256 deployerKey = vm.envUint("ORCHESTRATOR_PRIVATE_KEY");
    vm.startBroadcast(deployerKey);

    Arena arena = new Arena();
    console.log("Arena deployed at:", address(arena));
    console.log("Arena owner (deployer):", vm.addr(deployerKey));

    vm.stopBroadcast();
  }
}
