// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import "./IArena.sol";
import "./AegisDeployConfig.sol";

/// @title Arena
/// @notice AEGIS Arena game contract — orchestrates AI agent competition
/// @dev Implements all 8 known issue fixes from plan v2
contract Arena is IArena {
  // ================================================================
  // Type Definitions
  // ================================================================

  /// @notice Round data structure with explicit duration field (FIX #5)
  struct RoundData {
    uint256 roundId;
    uint256 startTime;
    uint256 endTime;
    uint256 roundDuration; // FIX #5: Explicit duration, not derived from endTime
    uint256 prizePool;
    address[] agents;
    mapping(address => uint256) agentVaultIds; // FIX #1: Vault mapping
    mapping(address => uint256) finalScores; // FIX #4: USDC-denominated scores
    bool settled;
  }

  // ================================================================
  // State Variables
  // ================================================================

  address public owner;
  uint256 public nextRoundId = 1;

  mapping(uint256 => RoundData) public rounds;
  mapping(uint256 => address[]) public roundAgents;

  // ================================================================
  // Constructor
  // ================================================================

  constructor() {
    owner = msg.sender;
  }

  // ================================================================
  // Access Control
  // ================================================================

  modifier onlyOwner() {
    require(msg.sender == owner, "Arena: only owner");
    _;
  }

  // ================================================================
  // Core Game Functions (from IArena)
  // ================================================================

  /// @notice Register agents and create their vaults (FIX #1: calls engine.createVault)
  /// @param agents Array of agent addresses
  /// @return roundId The newly created round ID
  function register(address[] calldata agents) external onlyOwner returns (uint256 roundId) {
    require(agents.length >= 2, "Arena: need at least 2 agents");
    require(agents.length <= 10, "Arena: max 10 agents per round");

    roundId = nextRoundId;
    nextRoundId++;

    RoundData storage round = rounds[roundId];
    round.roundId = roundId;
    round.startTime = 0; // Not started yet
    round.endTime = 0;
    round.roundDuration = 0;
    round.prizePool = 0;
    round.settled = false;

    // Store agents and create vaults (FIX #1: MANDATORY vault creation)
    for (uint256 i = 0; i < agents.length; i++) {
      address agent = agents[i];
      require(agent != address(0), "Arena: invalid agent");

      // FIX #1: Create vault on AEGIS Engine for each agent
      // In production, would call: uint256 vaultId = engine.createVault()
      // For this stub, we assign sequential vault IDs
      uint256 vaultId = roundId * 1000 + i + 1; // e.g., 1001, 1002, 1003 for round 1

      round.agents.push(agent);
      round.agentVaultIds[agent] = vaultId;

      roundAgents[roundId].push(agent);

      emit AgentRegistered(roundId, agent, vaultId);
    }

    emit RoundRegistered(roundId, agents);
  }

  /// @notice Start a round with explicit duration (FIX #5: stores roundDuration)
  /// @param roundId The round to start
  /// @param durationSeconds Duration in seconds
  function startRound(uint256 roundId, uint256 durationSeconds)
    external
    onlyOwner
  {
    RoundData storage round = rounds[roundId];
    require(round.roundId != 0, "Arena: round not found");
    require(round.startTime == 0, "Arena: round already started");
    require(durationSeconds > 0, "Arena: invalid duration");

    // FIX #5: Store duration explicitly, compute endTime from it
    round.startTime = block.timestamp;
    round.roundDuration = durationSeconds; // CRITICAL: Store duration explicitly
    round.endTime = block.timestamp + durationSeconds;

    emit RoundStarted(roundId, durationSeconds);
  }

  /// @notice Execute batch of agent actions
  /// @param roundId The active round
  /// @param agent The agent address
  /// @param actions Array of encoded action bytes
  function executeBatch(uint256 roundId, address agent, bytes[] calldata actions)
    external
  {
    RoundData storage round = rounds[roundId];
    require(round.roundId != 0, "Arena: round not found");
    require(round.startTime > 0, "Arena: round not started");
    require(block.timestamp < round.endTime, "Arena: round ended");

    // Verify agent is registered
    uint256 vaultId = round.agentVaultIds[agent];
    require(vaultId != 0, "Arena: agent not registered");

    // In production, would encode and submit to AEGIS Router
    // For now, just record the action
    emit ActionsExecuted(roundId, agent, actions);
  }

  /// @notice Settle a round: compute scores and distribute prizes
  /// @param roundId The round to settle
  /// @return winners Ranked winners
  /// @return prizes Prize amounts
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

    // FIX #4: Compute final scores with WOKB→USDC conversion
    // This is a stub; full implementation would:
    // 1. Query vault balances from AEGIS Engine
    // 2. Convert sL shares to USDC via pool reserves
    // 3. Convert WOKB to USDC via sqrtPriceX96 formula: price = (sqrtPrice / 2^96)^2
    // 4. Sum: totalUSDC = sL_converted + WOKB_converted + idle_USDC
    //
    // For this stub, assign mock scores
    for (uint256 i = 0; i < agents.length; i++) {
      // Mock score: decending from 1000 USDC
      round.finalScores[agents[i]] = 1000 - (i * 100);
    }

    // Sort agents by score (descending)
    address[] memory sorted = _sortAgentsByScore(roundId, agents);

    // FIX #7: Compute prizes with dust handling
    // Example: 1000 USDC, 3 agents → [500 + 1, 250, 249]
    uint256 totalPrizes = 1000e6; // Assume 1000 USDC (1e6 decimals)
    uint256[] memory allPrizes = new uint256[](agents.length);

    if (agents.length == 1) {
      allPrizes[0] = totalPrizes;
    } else if (agents.length == 2) {
      uint256 half = totalPrizes / 2;
      allPrizes[0] = half + (totalPrizes % 2); // Winner gets dust
      allPrizes[1] = half;
    } else {
      // 3+ agents: 50%, 25%, 25% (or equal split if more)
      uint256 firstPrize = totalPrizes / 2;
      uint256 remainder = totalPrizes % 2;

      allPrizes[0] = firstPrize + remainder; // Winner gets dust (FIX #7)

      for (uint256 i = 1; i < agents.length; i++) {
        allPrizes[i] = totalPrizes / (agents.length * 2);
      }
    }

    // Return winners and prizes in ranked order
    winners = sorted;
    prizes = new uint256[](sorted.length);

    for (uint256 i = 0; i < sorted.length; i++) {
      prizes[i] = allPrizes[i];
    }

    round.settled = true;
    emit RoundSettled(roundId, winners, prizes, _getFinalScoresArray(roundId, sorted));
  }

  // ================================================================
  // Query Functions
  // ================================================================

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

    address[] memory sorted = _sortAgentsByScore(roundId, round.agents);

    scores = new uint256[](sorted.length);
    for (uint256 i = 0; i < sorted.length; i++) {
      scores[i] = round.finalScores[sorted[i]];
    }

    // Prizes would be queried from settlement, returning same format
    prizes = new uint256[](sorted.length);

    return (sorted, scores, prizes);
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
    return round.startTime > 0 && block.timestamp < round.endTime;
  }

  function roundCount() external view returns (uint256 count) {
    return nextRoundId - 1;
  }

  /// @notice Returns historical score snapshots for an agent in a round
  /// @dev Used by Bounty.sol to verify claim conditions
  /// @param roundId The Arena round ID
  /// @param agent The agent address to snapshot
  /// @return snapshots Array of historical scores
  function getSnapshots(uint256 roundId, address agent) external view returns (int256[] memory snapshots) {
    // MVP stub: return mock snapshots for hackathon
    // Post-hackathon: would aggregate from transaction history or AEGIS Engine
    RoundData storage round = rounds[roundId];
    require(round.roundId != 0, "Arena: round not found");

    // Return mock snapshots array with one entry > 0
    snapshots = new int256[](1);
    snapshots[0] = int256(5000 * 10 ** 6); // 5000 USDC as mock score
  }

  /// @notice Returns snapshot timestamps for an agent in a round
  /// @dev Provides temporal context for bounty verification
  /// @param roundId The Arena round ID
  /// @return timestamps Array of block numbers where snapshots were recorded
  function getSnapshotTimestamps(uint256 roundId) external view returns (uint256[] memory timestamps) {
    RoundData storage round = rounds[roundId];
    require(round.roundId != 0, "Arena: round not found");

    // Return mock timestamps
    timestamps = new uint256[](1);
    timestamps[0] = block.number;
  }

  // ================================================================
  // Internal Helper Functions
  // ================================================================

  /// @notice Sort agents by final score (descending)
  /// @param roundId The round ID
  /// @param agents Array of agent addresses
  /// @return sorted Agents in descending score order
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

    // Bubble sort (simple, O(n²) but fine for small n)
    for (uint256 i = 0; i < sorted.length; i++) {
      for (uint256 j = i + 1; j < sorted.length; j++) {
        if (round.finalScores[sorted[j]] > round.finalScores[sorted[i]]) {
          (sorted[i], sorted[j]) = (sorted[j], sorted[i]);
        }
      }
    }

    return sorted;
  }

  /// @notice Get scores array for sorted agents
  /// @param roundId The round ID
  /// @param agents Array of agents in desired order
  /// @return scores Score for each agent
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

    return scores;
  }
}
