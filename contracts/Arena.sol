// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import "./IArena.sol";

/// @title Arena
/// @notice AEGIS Arena game contract — orchestrates AI agent competition
/// @dev Current gameplay slice binds pre-provisioned vault IDs from the orchestrator.
///      `executeBatch()` is now a real write path into Arena state. Actual downstream
///      router execution remains an explicit configured boundary rather than implicit.
contract Arena is IArena {
  uint8 internal constant EXECUTION_METADATA_TAG = 0xFE;
  uint8 internal constant EXECUTION_METADATA_VERSION = 1;

  struct ExecutionSnapshot {
    uint256 blockNumber;
    uint256 timestamp;
    uint256 cumulativeVolumeUsdc;
    uint256 avgPriceX96;
    uint256 actionCount;
    address surface;
    bytes32 batchHash;
    bool proofEligible;
  }

  struct AgentExecutionState {
    uint256 executionCount;
    uint256 actionCount;
    uint256 cumulativeVolumeUsdc;
    uint256 latestAvgPriceX96;
    uint256 lastExecutionBlock;
    address lastSurface;
    bytes32 lastBatchHash;
    bool lastProofEligible;
    ExecutionSnapshot[] snapshots;
  }

  /// @notice Round data structure with explicit duration field (FIX #5)
  struct RoundData {
    uint256 roundId;
    uint256 startTime;
    uint256 endTime;
    uint256 roundDuration;
    uint256 prizePool;
    address[] agents;
    mapping(address => uint256) agentVaultIds;
    mapping(address => uint256) finalScores;
    mapping(address => AgentExecutionState) executionStates;
    address[] settledRanking;
    uint256[] settledPrizes;
    bool settled;
  }

  address public owner;
  uint256 public nextRoundId = 1;

  address public aegisRouter;
  address public positionManager;
  address public limitOrderManager;
  address public stateView;

  mapping(uint256 => RoundData) public rounds;
  mapping(uint256 => address[]) public roundAgents;

  constructor() {
    owner = msg.sender;
  }

  modifier onlyOwner() {
    require(msg.sender == owner, "Arena: only owner");
    _;
  }

  error ArrayLengthMismatch();
  error DuplicateAgent(address agent);
  error DuplicateVaultId(uint256 vaultId);
  error InvalidVaultId();

  function register(address[] calldata agents, uint256[] calldata vaultIds)
    external
    onlyOwner
    returns (uint256 roundId)
  {
    require(agents.length >= 2, "Arena: need at least 2 agents");
    require(agents.length <= 10, "Arena: max 10 agents per round");
    if (agents.length != vaultIds.length) {
      revert ArrayLengthMismatch();
    }

    roundId = nextRoundId;
    nextRoundId++;

    RoundData storage round = rounds[roundId];
    round.roundId = roundId;
    round.startTime = 0;
    round.endTime = 0;
    round.roundDuration = 0;
    round.prizePool = 0;
    round.settled = false;

    for (uint256 i = 0; i < agents.length; i++) {
      address agent = agents[i];
      require(agent != address(0), "Arena: invalid agent");
      uint256 vaultId = vaultIds[i];
      if (vaultId == 0) {
        revert InvalidVaultId();
      }
      if (round.agentVaultIds[agent] != 0) {
        revert DuplicateAgent(agent);
      }

      for (uint256 j = 0; j < i; j++) {
        if (vaultIds[j] == vaultId) {
          revert DuplicateVaultId(vaultId);
        }
      }

      round.agents.push(agent);
      round.agentVaultIds[agent] = vaultId;
      roundAgents[roundId].push(agent);

      emit AgentRegistered(roundId, agent, vaultId);
    }

    emit RoundRegistered(roundId, agents);
  }

  function startRound(uint256 roundId, uint256 durationSeconds)
    external
    onlyOwner
  {
    RoundData storage round = rounds[roundId];
    require(round.roundId != 0, "Arena: round not found");
    require(round.startTime == 0, "Arena: round already started");
    require(durationSeconds > 0, "Arena: invalid duration");

    round.startTime = block.timestamp;
    round.roundDuration = durationSeconds;
    round.endTime = block.timestamp + durationSeconds;

    emit RoundStarted(roundId, durationSeconds);
  }

  function configureExecutionSurfaces(
    address _aegisRouter,
    address _positionManager,
    address _limitOrderManager,
    address _stateView
  ) external onlyOwner {
    aegisRouter = _aegisRouter;
    positionManager = _positionManager;
    limitOrderManager = _limitOrderManager;
    stateView = _stateView;

    emit ExecutionSurfacesConfigured(
      _aegisRouter,
      _positionManager,
      _limitOrderManager,
      _stateView
    );
  }

  function executeBatch(uint256 roundId, address agent, bytes[] calldata actions)
    external
  {
    RoundData storage round = rounds[roundId];
    require(round.roundId != 0, "Arena: round not found");
    require(round.startTime > 0, "Arena: round not started");
    require(block.timestamp < round.endTime, "Arena: round ended");
    require(msg.sender == owner || msg.sender == agent, "Arena: unauthorized executor");

    uint256 vaultId = round.agentVaultIds[agent];
    require(vaultId != 0, "Arena: agent not registered");
    require(actions.length > 0, "Arena: empty action batch");

    AgentExecutionState storage executionState = round.executionStates[agent];
    executionState.executionCount += 1;
    executionState.actionCount += actions.length;
    executionState.lastExecutionBlock = block.number;

    bytes32 batchHash = keccak256(abi.encode(roundId, agent, msg.sender, actions));
    executionState.lastBatchHash = batchHash;

    (address surface, uint256 reportedVolumeUsdc, uint256 avgPriceX96, bool proofEligible) =
      _extractExecutionMetadata(actions);

    executionState.lastSurface = surface;
    executionState.lastProofEligible = proofEligible;

    if (proofEligible) {
      executionState.cumulativeVolumeUsdc += reportedVolumeUsdc;
      executionState.latestAvgPriceX96 = avgPriceX96;
    }

    executionState.snapshots.push(
      ExecutionSnapshot({
        blockNumber: block.number,
        timestamp: block.timestamp,
        cumulativeVolumeUsdc: executionState.cumulativeVolumeUsdc,
        avgPriceX96: executionState.latestAvgPriceX96,
        actionCount: executionState.actionCount,
        surface: surface,
        batchHash: batchHash,
        proofEligible: proofEligible
      })
    );

    emit ActionsExecuted(roundId, agent, actions);
  }

  function settle(uint256 roundId)
    external
    onlyOwner
    returns (address[] memory winners, uint256[] memory prizes)
  {
    RoundData storage round = rounds[roundId];
    require(round.roundId != 0, "Arena: round not found");
    require(round.startTime > 0, "Arena: round started");
    require(block.timestamp >= round.endTime, "Arena: round not ended");
    require(!round.settled, "Arena: round already settled");

    address[] storage agents = round.agents;
    require(agents.length > 0, "Arena: no agents");

    for (uint256 i = 0; i < agents.length; i++) {
      AgentExecutionState storage state = round.executionStates[agents[i]];
      round.finalScores[agents[i]] = state.cumulativeVolumeUsdc;
    }

    address[] memory sorted = _sortAgentsByScore(roundId, agents);
    uint256[] memory computedPrizes = _computePrizes(agents.length);

    for (uint256 i = 0; i < sorted.length; i++) {
      round.settledRanking.push(sorted[i]);
      round.settledPrizes.push(computedPrizes[i]);
    }

    winners = sorted;
    prizes = computedPrizes;
    round.settled = true;

    emit RoundSettled(roundId, winners, prizes, _getFinalScoresArray(roundId, winners));
  }

  function getRoundState(uint256 roundId)
    external
    view
    returns (
      uint256 startTime,
      uint256 endTime,
      uint256 roundDuration,
      bool settled,
      address[] memory agents
    )
  {
    RoundData storage round = rounds[roundId];
    require(round.roundId != 0, "Arena: round not found");

    return (
      round.startTime,
      round.endTime,
      round.roundDuration,
      round.settled,
      round.agents
    );
  }

  function getFinalScores(uint256 roundId)
    external
    view
    returns (address[] memory agentsRanked, uint256[] memory scores, uint256[] memory prizes)
  {
    RoundData storage round = rounds[roundId];
    require(round.roundId != 0, "Arena: round not found");
    require(round.settled, "Arena: round not settled");

    agentsRanked = round.settledRanking;
    prizes = round.settledPrizes;
    scores = new uint256[](agentsRanked.length);

    for (uint256 i = 0; i < agentsRanked.length; i++) {
      scores[i] = round.finalScores[agentsRanked[i]];
    }
  }

  function getAgentVault(uint256 roundId, address agent)
    external
    view
    returns (uint256 vaultId)
  {
    return rounds[roundId].agentVaultIds[agent];
  }

  function isRoundActive(uint256 roundId) external view returns (bool active) {
    RoundData storage round = rounds[roundId];
    return round.startTime > 0 && block.timestamp < round.endTime && !round.settled;
  }

  function roundCount() external view returns (uint256 count) {
    return nextRoundId - 1;
  }

  function getAgentExecutionState(uint256 roundId, address agent)
    external
    view
    returns (
      uint256 vaultId,
      uint256 executionCount,
      uint256 actionCount,
      uint256 cumulativeVolumeUsdc,
      uint256 latestAvgPriceX96,
      uint256 lastExecutionBlock,
      address lastSurface,
      bytes32 lastBatchHash,
      bool lastProofEligible
    )
  {
    RoundData storage round = rounds[roundId];
    require(round.roundId != 0, "Arena: round not found");

    AgentExecutionState storage state = round.executionStates[agent];
    return (
      round.agentVaultIds[agent],
      state.executionCount,
      state.actionCount,
      state.cumulativeVolumeUsdc,
      state.latestAvgPriceX96,
      state.lastExecutionBlock,
      state.lastSurface,
      state.lastBatchHash,
      state.lastProofEligible
    );
  }

  function getSnapshotCount(uint256 roundId, address agent) external view returns (uint256 count) {
    RoundData storage round = rounds[roundId];
    require(round.roundId != 0, "Arena: round not found");
    count = round.executionStates[agent].snapshots.length;
  }

  function getSnapshotAt(uint256 roundId, address agent, uint256 snapshotIndex)
    external
    view
    returns (
      uint256 blockNumber,
      uint256 timestamp,
      uint256 cumulativeVolumeUsdc,
      uint256 avgPriceX96,
      uint256 actionCount,
      address surface,
      bytes32 batchHash,
      bool proofEligible
    )
  {
    RoundData storage round = rounds[roundId];
    require(round.roundId != 0, "Arena: round not found");

    ExecutionSnapshot storage snapshot = round.executionStates[agent].snapshots[snapshotIndex];
    return (
      snapshot.blockNumber,
      snapshot.timestamp,
      snapshot.cumulativeVolumeUsdc,
      snapshot.avgPriceX96,
      snapshot.actionCount,
      snapshot.surface,
      snapshot.batchHash,
      snapshot.proofEligible
    );
  }

  /// @notice Returns historical score snapshots for an agent in a round
  /// @dev Used by legacy callers and bounty verification helpers
  function getSnapshots(uint256 roundId, address agent) external view returns (int256[] memory snapshots) {
    RoundData storage round = rounds[roundId];
    require(round.roundId != 0, "Arena: round not found");

    uint256 count = round.executionStates[agent].snapshots.length;
    snapshots = new int256[](count);
    for (uint256 i = 0; i < count; i++) {
      snapshots[i] = int256(round.executionStates[agent].snapshots[i].cumulativeVolumeUsdc);
    }
  }

  function getSnapshotTimestamps(uint256 roundId) external view returns (uint256[] memory timestamps) {
    RoundData storage round = rounds[roundId];
    require(round.roundId != 0, "Arena: round not found");

    uint256 total;
    for (uint256 i = 0; i < round.agents.length; i++) {
      total += round.executionStates[round.agents[i]].snapshots.length;
    }

    timestamps = new uint256[](total);
    uint256 cursor;
    for (uint256 i = 0; i < round.agents.length; i++) {
      ExecutionSnapshot[] storage agentSnapshots = round.executionStates[round.agents[i]].snapshots;
      for (uint256 j = 0; j < agentSnapshots.length; j++) {
        timestamps[cursor] = agentSnapshots[j].blockNumber;
        cursor++;
      }
    }
  }

  function _sortAgentsByScore(uint256 roundId, address[] storage agents)
    internal
    view
    returns (address[] memory sorted)
  {
    RoundData storage round = rounds[roundId];

    sorted = new address[](agents.length);
    for (uint256 i = 0; i < agents.length; i++) {
      sorted[i] = agents[i];
    }

    for (uint256 i = 0; i < sorted.length; i++) {
      for (uint256 j = i + 1; j < sorted.length; j++) {
        if (round.finalScores[sorted[j]] > round.finalScores[sorted[i]]) {
          (sorted[i], sorted[j]) = (sorted[j], sorted[i]);
        }
      }
    }
  }

  function _getFinalScoresArray(uint256 roundId, address[] memory agents)
    internal
    view
    returns (uint256[] memory scores)
  {
    RoundData storage round = rounds[roundId];
    scores = new uint256[](agents.length);
    for (uint256 i = 0; i < agents.length; i++) {
      scores[i] = round.finalScores[agents[i]];
    }
  }

  function _computePrizes(uint256 numAgents) internal pure returns (uint256[] memory prizes) {
    prizes = new uint256[](numAgents);
    uint256 totalPrizes = 1000e6;

    if (numAgents == 1) {
      prizes[0] = totalPrizes;
      return prizes;
    }

    if (numAgents == 2) {
      uint256 half = totalPrizes / 2;
      prizes[0] = half + (totalPrizes % 2);
      prizes[1] = half;
      return prizes;
    }

    uint256 firstPrize = totalPrizes / 2;
    uint256 allocated = firstPrize;
    prizes[0] = firstPrize;

    uint256 remainder = totalPrizes - firstPrize;
    uint256 sharedPrize = remainder / (numAgents - 1);
    for (uint256 i = 1; i < numAgents; i++) {
      prizes[i] = sharedPrize;
      allocated += sharedPrize;
    }

    if (allocated < totalPrizes) {
      prizes[0] += (totalPrizes - allocated);
    }
  }

  function _extractExecutionMetadata(bytes[] calldata actions)
    internal
    view
    returns (address surface, uint256 reportedVolumeUsdc, uint256 avgPriceX96, bool proofEligible)
  {
    bytes calldata firstAction = actions[0];
    if (firstAction.length < 1 || uint8(firstAction[0]) != EXECUTION_METADATA_TAG) {
      return (address(0), 0, 0, false);
    }

    (
      uint8 version,
      address declaredSurface,
      uint256 volumeUsdc,
      uint256 declaredAvgPriceX96
    ) = abi.decode(firstAction[1:], (uint8, address, uint256, uint256));

    if (version != EXECUTION_METADATA_VERSION) {
      return (address(0), 0, 0, false);
    }

    if (!_isApprovedSurface(declaredSurface)) {
      return (declaredSurface, 0, 0, false);
    }

    return (declaredSurface, volumeUsdc, declaredAvgPriceX96, true);
  }

  function _isApprovedSurface(address surface) internal view returns (bool) {
    if (surface == address(0)) {
      return false;
    }

    return
      surface == aegisRouter ||
      surface == positionManager ||
      surface == limitOrderManager ||
      surface == stateView;
  }
}
