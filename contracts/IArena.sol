// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

/// @title IArena
/// @notice Interface for AEGIS Arena game contract
/// @dev CP-017: Added getSnapshots/getSnapshotTimestamps for on-chain bounty verification.
///      CP-018: Added fundPrize, setRelayer, RelayerUpdated, PrizeFunded.
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

    /// @notice Emitted when a relayer is authorized or deauthorized (CP-018)
    event RelayerUpdated(address indexed relayer, bool authorized);

    /// @notice Emitted when a prize pool is funded for a round (CP-018)
    event PrizeFunded(uint256 indexed roundId, uint256 amount, uint256 totalPool);

    // ================================================================
    // Core Game Functions
    // ================================================================

    /// @notice Register agents for a new round and create their vaults
    /// @param agents Array of agent addresses to participate
    /// @return roundId The ID of the created round
    function register(address[] calldata agents) external returns (uint256 roundId);

    /// @notice Start a round with specified duration
    /// @param roundId The round to start
    /// @param durationSeconds Duration of the round in seconds
    function startRound(uint256 roundId, uint256 durationSeconds) external;

    /// @notice Execute batch of agent actions (authenticated relayer only — CP-018 ARCH-02)
    /// @param roundId The active round
    /// @param agent The agent address executing actions
    /// @param actions Array of encoded action bytes
    function executeBatch(uint256 roundId, address agent, bytes[] calldata actions) external;

    /// @notice Settle a round: compute final scores and distribute prizes via ERC-20 transfer
    /// @param roundId The round to settle
    /// @return winners Agent addresses in registration order
    /// @return prizes Prize amounts in prizeToken decimals
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
    /// @dev CP-018: prizes are read from persisted roundPrizes mapping (real values)
    /// @param roundId The round ID
    /// @return agentsRanked Agents in registration order
    /// @return scores Action counts (activity score proxy)
    /// @return prizes Real prize allocations from settle() in prizeToken decimals
    function getFinalScores(uint256 roundId)
        external
        view
        returns (address[] memory agentsRanked, uint256[] memory scores, uint256[] memory prizes);

    /// @notice Get vault ID for an agent in a round
    /// @param roundId The round ID
    /// @param agent The agent address
    /// @return vaultId The AEGIS vault ID created for this agent
    function getAgentVault(uint256 roundId, address agent) external view returns (uint256 vaultId);

    /// @notice Check if a round is active
    /// @param roundId The round ID
    /// @return active True if round is running
    function isRoundActive(uint256 roundId) external view returns (bool active);

    /// @notice Get total number of rounds created
    /// @return count Total rounds
    function roundCount() external view returns (uint256 count);

    // ================================================================
    // Snapshot Functions (CP-017 / CP-018)
    // ================================================================

    /// @notice Returns accumulated activity snapshot for an agent in a round
    /// @dev Called by Bounty.sol (CP-017) verifyAndPay(). Signature locked by CP-017 APPROVED.
    ///      CP-018 implements real accumulation (not mock). Return type: 4-tuple of uint256.
    /// @param roundId The Arena round identifier.
    /// @param agentAddress The agent whose performance is queried.
    /// @return totalVolumeUsdc Accumulated volume proxy (actionCount * 1e6)
    /// @return avgSqrtPriceX96 Average sqrt price X96 (0 for MVP — no price oracle)
    /// @return startBlock Block number of first executeBatch() call
    /// @return endBlock Block number of most recent executeBatch() call
    function getSnapshots(uint256 roundId, address agentAddress)
        external
        view
        returns (
            uint256 totalVolumeUsdc,
            uint256 avgSqrtPriceX96,
            uint256 startBlock,
            uint256 endBlock
        );

    /// @notice Returns block range for agent snapshot activity
    /// @dev Supplementary context for bounty verification and auditing.
    /// @param roundId The Arena round identifier.
    /// @param agentAddress The agent whose block range is queried.
    /// @return firstActionBlock Block number of first executeBatch() call
    /// @return lastActionBlock Block number of most recent executeBatch() call
    function getSnapshotTimestamps(uint256 roundId, address agentAddress)
        external
        view
        returns (uint256 firstActionBlock, uint256 lastActionBlock);

    // ================================================================
    // Prize Funding (CP-018)
    // ================================================================

    /// @notice Fund the prize pool for a round from caller's token balance
    /// @dev Owner-only. Requires prior ERC-20 approval to this contract.
    /// @param roundId The round to fund
    /// @param amount Token amount in prizeToken decimals
    function fundPrize(uint256 roundId, uint256 amount) external;

    // ================================================================
    // Relayer Management (CP-018)
    // ================================================================

    /// @notice Authorize or deauthorize a relayer address
    /// @dev Owner-only. Relayer must be set before executeBatch() can be called.
    /// @param relayer The address to authorize or revoke
    /// @param authorized True to authorize, false to revoke
    function setRelayer(address relayer, bool authorized) external;
}
