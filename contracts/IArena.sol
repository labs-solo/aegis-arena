// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

/// @title IArena
/// @notice Interface for AEGIS Arena game contract
interface IArena {
  // ================================================================
  // Events
  // ================================================================

  /// @notice Emitted when a new round is registered with agents
  event RoundRegistered(uint256 indexed roundId, address[] agents);

  /// @notice Emitted when a round starts
  event RoundStarted(uint256 indexed roundId, uint256 duration);

  /// @notice Emitted when a round is settled with winners and prizes
  event RoundSettled(
    uint256 indexed roundId,
    address[] winners,
    uint256[] prizes,
    uint256[] finalScores
  );

  /// @notice Emitted when an agent is registered for a round
  event AgentRegistered(uint256 indexed roundId, address agent, uint256 vaultId);

  /// @notice Emitted when agent actions are executed
  event ActionsExecuted(uint256 indexed roundId, address agent, bytes[] actions);

  /// @notice Emitted when the allowed execution boundary is updated
  event ExecutionSurfacesConfigured(
    address indexed aegisRouter,
    address indexed positionManager,
    address indexed limitOrderManager,
    address stateView
  );

  // ================================================================
  // Core Game Functions
  // ================================================================

  /// @notice Register agents for a new round and bind pre-provisioned vault IDs
  /// @param agents Array of agent addresses to participate
  /// @param vaultIds Array of pre-created AEGIS vault IDs, 1:1 with `agents`
  /// @return roundId The ID of the created round
  function register(address[] calldata agents, uint256[] calldata vaultIds)
    external
    returns (uint256 roundId);

  /// @notice Start a round with specified duration
  /// @param roundId The round to start
  /// @param durationSeconds Duration of the round in seconds
  function startRound(uint256 roundId, uint256 durationSeconds) external;

  /// @notice Execute batch of agent actions (encoded for AEGIS Router)
  /// @param roundId The active round
  /// @param agent The agent address executing actions
  /// @param actions Array of encoded action bytes
  function executeBatch(uint256 roundId, address agent, bytes[] calldata actions) external;

  /// @notice Configure the explicit execution/read boundary to AEGIS surfaces
  /// @dev This defines which downstream surfaces Arena will treat as proof-eligible
  function configureExecutionSurfaces(
    address aegisRouter,
    address positionManager,
    address limitOrderManager,
    address stateView
  ) external;

  /// @notice Settle a round: compute final scores and distribute prizes
  /// @param roundId The round to settle
  /// @return winners Ranked winners (1st, 2nd, 3rd)
  /// @return prizes Prize amounts in USDC
  function settle(uint256 roundId)
    external
    returns (address[] memory winners, uint256[] memory prizes);

  // ================================================================
  // State Query Functions
  // ================================================================

  /// @notice Get current state of a round
  /// @param roundId The round ID
  /// @return startTime Timestamp when round started
  /// @return endTime Timestamp when round ends
  /// @return roundDuration Duration in seconds
  /// @return settled Whether round has been settled
  /// @return agents Array of participating agents
  function getRoundState(uint256 roundId)
    external
    view
    returns (
      uint256 startTime,
      uint256 endTime,
      uint256 roundDuration,
      bool settled,
      address[] memory agents
    );

  /// @notice Get final scores and prizes for a settled round
  /// @param roundId The round ID
  /// @return agentsRanked Agents sorted by score (highest first)
  /// @return scores Final portfolio values in USDC
  /// @return prizes Prize allocations in USDC
  function getFinalScores(uint256 roundId)
    external
    view
    returns (address[] memory agentsRanked, uint256[] memory scores, uint256[] memory prizes);

  /// @notice Get vault ID for an agent in a round
  /// @param roundId The round ID
  /// @param agent The agent address
  /// @return vaultId The AEGIS vault ID bound for this agent
  function getAgentVault(uint256 roundId, address agent) external view returns (uint256 vaultId);

  /// @notice Check if a round is active
  /// @param roundId The round ID
  /// @return active True if round is running
  function isRoundActive(uint256 roundId) external view returns (bool active);

  /// @notice Get total number of rounds created
  /// @return count Total rounds
  function roundCount() external view returns (uint256 count);

  /// @notice Get the stored execution state for an agent in a round
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
    );

  /// @notice Get the number of stored execution snapshots for an agent in a round
  function getSnapshotCount(uint256 roundId, address agent) external view returns (uint256 count);

  /// @notice Read an execution snapshot stored by Arena
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
    );
}
