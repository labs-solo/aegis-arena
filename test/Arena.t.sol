// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/Arena.sol";

contract ArenaTest is Test {
  Arena internal arena;
  address internal constant DEPLOYER = address(0x71632aA7C30D6A1644e5Db13d245bd195A08b70b);

  address internal constant AGENT_ONE = address(0x1001);
  address internal constant AGENT_TWO = address(0x1002);
  address internal constant AGENT_THREE = address(0x1003);

  function setUp() public {
    vm.prank(DEPLOYER);
    arena = new Arena();
  }

  function _registerRound(address[] memory agents, uint256[] memory vaultIds) internal returns (uint256 roundId) {
    vm.prank(DEPLOYER);
    roundId = arena.register(agents, vaultIds);
  }

  function _configureAndStartRound(uint256 roundId, uint256 duration) internal {
    vm.startPrank(DEPLOYER);
    arena.configureExecutionSurfaces(address(0xBEEF), address(0xCAFE), address(0xD00D), address(0xF00D));
    arena.startRound(roundId, duration);
    vm.stopPrank();
  }

  function _metadataAction(uint256 volume, uint256 avgPrice) internal pure returns (bytes memory) {
    return bytes.concat(
      bytes1(uint8(0xFE)),
      abi.encode(uint8(1), address(0xBEEF), volume, avgPrice)
    );
  }

  function _assertProofEligibleSnapshot(
    uint256 roundId,
    address agent,
    uint256 expectedVolume,
    uint256 expectedPrice
  ) internal {
    (
      uint256 snapshotBlock,
      ,
      uint256 snapshotVolume,
      uint256 snapshotPrice,
      ,
      address snapshotSurface,
      ,
      bool proofEligible
    ) = arena.getSnapshotAt(roundId, agent, 0);

    assertEq(snapshotBlock, block.number);
    assertEq(snapshotVolume, expectedVolume);
    assertEq(snapshotPrice, expectedPrice);
    assertEq(snapshotSurface, address(0xBEEF));
    assertTrue(proofEligible);
  }

  function testRegisterBindsProvidedVaultIds() public {
    address[] memory agents = new address[](3);
    agents[0] = AGENT_ONE;
    agents[1] = AGENT_TWO;
    agents[2] = AGENT_THREE;

    uint256[] memory vaultIds = new uint256[](3);
    vaultIds[0] = 501;
    vaultIds[1] = 777;
    vaultIds[2] = 999999;

    uint256 roundId = _registerRound(agents, vaultIds);

    assertEq(roundId, 1);
    assertEq(arena.getAgentVault(roundId, AGENT_ONE), 501);
    assertEq(arena.getAgentVault(roundId, AGENT_TWO), 777);
    assertEq(arena.getAgentVault(roundId, AGENT_THREE), 999999);
  }

  function testRegisterRevertsOnArrayLengthMismatch() public {
    address[] memory agents = new address[](2);
    agents[0] = AGENT_ONE;
    agents[1] = AGENT_TWO;

    uint256[] memory vaultIds = new uint256[](1);
    vaultIds[0] = 501;

    vm.prank(DEPLOYER);
    vm.expectRevert(Arena.ArrayLengthMismatch.selector);
    arena.register(agents, vaultIds);
  }

  function testRegisterRevertsOnDuplicateVaultId() public {
    address[] memory agents = new address[](2);
    agents[0] = AGENT_ONE;
    agents[1] = AGENT_TWO;

    uint256[] memory vaultIds = new uint256[](2);
    vaultIds[0] = 501;
    vaultIds[1] = 501;

    vm.prank(DEPLOYER);
    vm.expectRevert(abi.encodeWithSelector(Arena.DuplicateVaultId.selector, 501));
    arena.register(agents, vaultIds);
  }

  function testRegisterRevertsOnDuplicateAgent() public {
    address[] memory agents = new address[](2);
    agents[0] = AGENT_ONE;
    agents[1] = AGENT_ONE;

    uint256[] memory vaultIds = new uint256[](2);
    vaultIds[0] = 501;
    vaultIds[1] = 777;

    vm.prank(DEPLOYER);
    vm.expectRevert(abi.encodeWithSelector(Arena.DuplicateAgent.selector, AGENT_ONE));
    arena.register(agents, vaultIds);
  }

  function testExecuteBatchStoresSnapshotFromApprovedSurfaceMetadata() public {
    address[] memory agents = new address[](2);
    agents[0] = AGENT_ONE;
    agents[1] = AGENT_TWO;

    uint256[] memory vaultIds = new uint256[](2);
    vaultIds[0] = 501;
    vaultIds[1] = 777;

    uint256 roundId = _registerRound(agents, vaultIds);
    _configureAndStartRound(roundId, 1 hours);

    bytes[] memory actions = new bytes[](2);
    actions[0] = _metadataAction(1250e6, 999);
    actions[1] = hex"901234";

    vm.prank(AGENT_ONE);
    arena.executeBatch(roundId, AGENT_ONE, actions);

    (
      uint256 vaultId,
      uint256 executionCount,
      uint256 actionCount,
      uint256 cumulativeVolumeUsdc,
      uint256 latestAvgPriceX96,
      uint256 lastExecutionBlock,
      address lastSurface,
      bytes32 lastBatchHash,
      bool lastProofEligible
    ) = arena.getAgentExecutionState(roundId, AGENT_ONE);

    assertEq(vaultId, 501);
    assertEq(executionCount, 1);
    assertEq(actionCount, 2);
    assertEq(cumulativeVolumeUsdc, 1250e6);
    assertEq(latestAvgPriceX96, 999);
    assertEq(lastExecutionBlock, block.number);
    assertEq(lastSurface, address(0xBEEF));
    assertTrue(lastBatchHash != bytes32(0));
    assertTrue(lastProofEligible);

    assertEq(arena.getSnapshotCount(roundId, AGENT_ONE), 1);
    _assertProofEligibleSnapshot(roundId, AGENT_ONE, 1250e6, 999);
  }

  function testSettleUsesArenaBackedExecutionVolumeScores() public {
    address[] memory agents = new address[](2);
    agents[0] = AGENT_ONE;
    agents[1] = AGENT_TWO;

    uint256[] memory vaultIds = new uint256[](2);
    vaultIds[0] = 501;
    vaultIds[1] = 777;

    uint256 roundId = _registerRound(agents, vaultIds);
    _configureAndStartRound(roundId, 1);

    bytes[] memory agentOneActions = new bytes[](1);
    agentOneActions[0] = _metadataAction(2000e6, 1000);

    bytes[] memory agentTwoActions = new bytes[](1);
    agentTwoActions[0] = _metadataAction(500e6, 1000);

    vm.prank(AGENT_ONE);
    arena.executeBatch(roundId, AGENT_ONE, agentOneActions);
    vm.prank(AGENT_TWO);
    arena.executeBatch(roundId, AGENT_TWO, agentTwoActions);

    vm.warp(block.timestamp + 2);
    vm.prank(DEPLOYER);
    arena.settle(roundId);

    (address[] memory ranked, uint256[] memory scores, uint256[] memory prizes) = arena.getFinalScores(roundId);
    assertEq(ranked[0], AGENT_ONE);
    assertEq(scores[0], 2000e6);
    assertEq(scores[1], 500e6);
    assertEq(prizes.length, 2);
  }
}
