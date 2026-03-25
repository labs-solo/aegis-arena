// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import "./IArena.sol";
import "openzeppelin-contracts/token/ERC20/utils/SafeERC20.sol";
import "openzeppelin-contracts/token/ERC20/IERC20.sol";
import "openzeppelin-contracts/security/ReentrancyGuard.sol";

/// @title Arena
/// @notice AEGIS Arena game contract — orchestrates AI agent competition
/// @dev CP-018: game engine hardening — authentication, snapshots, prize distribution
contract Arena is IArena, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ================================================================
    // Constants
    // ================================================================

    /// @notice Volume proxy unit: 1 action = 1 VOLUME_UNIT (1e6)
    /// @dev Activity score only — not real USDC volume. See §5.2 scoring model notes.
    uint256 public constant VOLUME_UNIT = 1e6;

    // ================================================================
    // Type Definitions
    // ================================================================

    /// @notice Per-agent snapshot accumulated from authenticated executeBatch() calls
    /// @dev Activity score proxy. avgSqrtPriceX96 is 0 for MVP (no price oracle).
    struct AgentSnapshot {
        uint256 totalVolumeUsdc;   // actionCount * VOLUME_UNIT
        uint256 avgSqrtPriceX96;   // 0 for MVP — reserved for post-hackathon price oracle
        uint256 startBlock;        // block.number of first executeBatch() call for this agent
        uint256 endBlock;          // block.number of most recent executeBatch() call
        uint256 actionCount;       // raw participation count (scoring primitive)
    }

    /// @notice Round data structure (ARCH-10 + ARCH-13 fixes)
    struct RoundData {
        uint256 roundId;
        uint256 startTime;       // block.timestamp — display/UI
        uint256 endTime;         // block.timestamp + duration — display/UI
        uint256 startBlock;      // ARCH-10: block.number — on-chain logic
        uint256 endBlock;        // ARCH-10: block.number at settle time
        uint256 roundDuration;
        uint256 prizePool;
        address[] agents;
        mapping(address => uint256) agentVaultIds;
        mapping(address => bool) registeredInRound;  // ARCH-13: duplicate guard
        bool settled;
    }

    // ================================================================
    // State Variables
    // ================================================================

    address public owner;
    uint256 public nextRoundId = 1;

    address public immutable prizeToken;  // ERC-20 prize token (USDC on X Layer)

    mapping(uint256 => RoundData) public rounds;
    mapping(uint256 => address[]) public roundAgents;

    /// @notice Per-round per-agent snapshot data accumulated during competition
    mapping(uint256 => mapping(address => AgentSnapshot)) public roundSnapshots;

    /// @notice Persisted prize amounts from settle() — enables correct getFinalScores()
    mapping(uint256 => mapping(address => uint256)) public roundPrizes;

    /// @notice Authorized relayers — only these addresses may call executeBatch() / reportEarnings()
    mapping(address => bool) public authorizedRelayers;

    // ================================================================
    // Events
    // ================================================================

    /// @notice Emitted when an agent reports earnings breakdown
    /// @dev For audit trail; does not affect scoring
    event EarningsReported(
        uint256 indexed roundId,
        address indexed agent,
        uint256 tradingFees,
        uint256 borrowInterest,
        uint256 totalEarnings
    );

    // ================================================================
    // Constructor
    // ================================================================

    /// @param _prizeToken ERC-20 token used for prize distribution (USDC on X Layer)
    constructor(address _prizeToken) {
        require(_prizeToken != address(0), "Arena: zero prize token");
        owner = msg.sender;
        prizeToken = _prizeToken;
    }

    // ================================================================
    // Access Control
    // ================================================================

    modifier onlyOwner() {
        require(msg.sender == owner, "Arena: only owner");
        _;
    }

    /// @notice Only authorized relayers may execute batch actions or report earnings
    modifier onlyRelayer() {
        require(authorizedRelayers[msg.sender], "Arena: not authorized relayer");
        _;
    }

    // ================================================================
    // Admin Functions
    // ================================================================

    function setRelayer(address relayer, bool authorized) external onlyOwner {
        require(relayer != address(0), "Arena: zero relayer");
        authorizedRelayers[relayer] = authorized;
        emit RelayerUpdated(relayer, authorized);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Arena: zero owner");
        owner = newOwner;
    }

    /// @notice Fund the prize pool for a round from caller's token balance
    /// @param roundId The round to fund
    /// @param amount Token amount (in prizeToken decimals)
    /// @dev Owner-only. Requires prior approval: prizeToken.approve(arenaAddress, amount)
    function fundPrize(uint256 roundId, uint256 amount) external onlyOwner nonReentrant {
        require(amount > 0, "Arena: zero amount");
        RoundData storage round = rounds[roundId];
        require(round.roundId != 0, "Arena: round not found");
        require(!round.settled, "Arena: round already settled");
        IERC20(prizeToken).safeTransferFrom(msg.sender, address(this), amount);
        round.prizePool += amount;
        emit PrizeFunded(roundId, amount, round.prizePool);
    }

    // ================================================================
    // Core Game Functions (from IArena)
    // ================================================================

    /// @notice Register agents and create their vaults (ARCH-13: duplicate guard)
    /// @param agents Array of agent addresses
    /// @return roundId The newly created round ID
    function register(address[] calldata agents) external onlyOwner returns (uint256 roundId) {
        require(agents.length >= 2, "Arena: need at least 2 agents");
        require(agents.length <= 10, "Arena: max 10 agents per round");

        roundId = nextRoundId++;

        RoundData storage round = rounds[roundId];
        round.roundId = roundId;
        round.settled = false;

        for (uint256 i = 0; i < agents.length; i++) {
            address agent = agents[i];
            require(agent != address(0), "Arena: invalid agent address");
            // ARCH-13: duplicate guard — per-round, not global
            require(!round.registeredInRound[agent], "Arena: duplicate agent");
            round.registeredInRound[agent] = true;

            uint256 vaultId = roundId * 1000 + i + 1;
            round.agents.push(agent);
            round.agentVaultIds[agent] = vaultId;
            roundAgents[roundId].push(agent);

            emit AgentRegistered(roundId, agent, vaultId);
        }

        emit RoundRegistered(roundId, agents);
        return roundId;
    }

    /// @notice Start a round with explicit duration (ARCH-10: records block.number)
    /// @param roundId The round to start
    /// @param durationSeconds Duration in seconds
    function startRound(uint256 roundId, uint256 durationSeconds) external onlyOwner {
        RoundData storage round = rounds[roundId];
        require(round.roundId != 0, "Arena: round not found");
        require(round.startTime == 0, "Arena: round already started");
        require(durationSeconds > 0, "Arena: invalid duration");

        round.startTime = block.timestamp;          // display/UI
        round.startBlock = block.number;            // ARCH-10: on-chain logic
        round.roundDuration = durationSeconds;
        round.endTime = block.timestamp + durationSeconds;
        // endBlock recorded at settle() time

        emit RoundStarted(roundId, durationSeconds);
    }

    /// @notice Execute batch of agent actions (ARCH-02: onlyRelayer, ARCH-04: snapshot accumulation)
    /// @param roundId The active round
    /// @param agent The agent address
    /// @param actions Array of encoded action bytes
    /// @dev Score proxy: each action increments actionCount by 1.
    ///      ACTIVITY SCORE — measures participation, not PnL.
    function executeBatch(
        uint256 roundId,
        address agent,
        bytes[] calldata actions
    ) external onlyRelayer {
        RoundData storage round = rounds[roundId];
        require(round.startTime > 0 && !round.settled, "Arena: round not active");
        require(block.timestamp < round.endTime, "Arena: round ended");
        require(round.agentVaultIds[agent] != 0, "Arena: agent not registered");

        // ARCH-04: Accumulate snapshot
        AgentSnapshot storage snap = roundSnapshots[roundId][agent];
        snap.actionCount += actions.length;
        snap.totalVolumeUsdc += actions.length * VOLUME_UNIT;
        if (snap.startBlock == 0) snap.startBlock = block.number;  // first call only
        snap.endBlock = block.number;                               // every call
        // avgSqrtPriceX96 remains 0 — no price oracle in MVP (KI-006)

        emit ActionsExecuted(roundId, agent, actions);
    }

    /// @notice Settle a round: proportional distribution + real ERC-20 transfers
    /// @param roundId The round to settle
    /// @return winners Agent addresses
    /// @return prizes Prize amounts
    function settle(uint256 roundId)
        external
        onlyOwner
        nonReentrant
        returns (address[] memory winners, uint256[] memory prizes)
    {
        RoundData storage round = rounds[roundId];
        require(round.roundId != 0, "Arena: round not found");
        require(round.startTime > 0, "Arena: round not started");
        require(block.timestamp >= round.endTime, "Arena: round not ended");
        require(!round.settled, "Arena: already settled");

        // CEI: state writes before interactions
        round.settled = true;
        round.endBlock = block.number;  // ARCH-10

        address[] storage agents = round.agents;
        uint256 n = agents.length;
        uint256 pool = round.prizePool;

        // Zero prizePool case: if prizePool == 0, all prizes[i] == 0, no transfers occur.
        // The round still settles successfully. getFinalScores() returns all zeros.
        // This is correct behavior for unfunded rounds.

        // Compute activity scores
        uint256 totalActions = 0;
        uint256[] memory scores = new uint256[](n);
        for (uint256 i = 0; i < n; i++) {
            scores[i] = roundSnapshots[roundId][agents[i]].actionCount;
            totalActions += scores[i];
        }

        // Proportional distribution; equal split if no activity
        // Dust note: sum(prizes[i]) may be < pool due to integer division truncation.
        // Maximum dust per settle() call = (n-1) tokens (negligible at expected prize scales).
        // Remainder stays in contract; not burned, not redistributed.
        // A follow-on CP may add an owner dust-sweep function.
        winners = new address[](n);
        prizes = new uint256[](n);
        for (uint256 i = 0; i < n; i++) {
            winners[i] = agents[i];
            if (totalActions > 0) {
                prizes[i] = pool * scores[i] / totalActions;
            } else {
                prizes[i] = n > 0 ? pool / n : 0;
            }
            // Persist prize for getFinalScores() (ARCH-05 fix)
            roundPrizes[roundId][agents[i]] = prizes[i];
        }

        // Token transfers (ARCH-05 fix) — after all state writes (CEI)
        for (uint256 i = 0; i < n; i++) {
            if (prizes[i] > 0 && pool > 0) {
                IERC20(prizeToken).safeTransfer(agents[i], prizes[i]);
            }
        }

        emit RoundSettled(roundId, winners, prizes, scores);
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

    /// @notice Get final scores and prizes for a settled round (ARCH-05 fix: reads roundPrizes)
    function getFinalScores(uint256 roundId)
        external
        view
        returns (address[] memory agentsRanked, uint256[] memory scores, uint256[] memory prizes)
    {
        RoundData storage round = rounds[roundId];
        require(round.roundId != 0, "Arena: round not found");
        require(round.settled, "Arena: round not settled");

        address[] storage agents = round.agents;
        uint256 n = agents.length;

        agentsRanked = new address[](n);
        scores = new uint256[](n);
        prizes = new uint256[](n);

        for (uint256 i = 0; i < n; i++) {
            agentsRanked[i] = agents[i];
            scores[i] = roundSnapshots[roundId][agents[i]].actionCount;
            prizes[i] = roundPrizes[roundId][agents[i]];  // real persisted prizes
        }
        // Note: registration order preserved; not sorted by score. Caller sorts if needed.
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

    /// @notice Called by Bounty.sol (CP-017) to verify claim conditions
    /// @dev Return signature locked by CP-017 APPROVED: (uint256, uint256, uint256, uint256)
    function getSnapshots(uint256 roundId, address agentAddress)
        external
        view
        returns (
            uint256 totalVolumeUsdc,
            uint256 avgSqrtPriceX96,
            uint256 startBlock,
            uint256 endBlock
        )
    {
        AgentSnapshot storage snap = roundSnapshots[roundId][agentAddress];
        return (snap.totalVolumeUsdc, snap.avgSqrtPriceX96, snap.startBlock, snap.endBlock);
    }

    /// @notice Returns block range for agent snapshot activity (ARCH-11)
    function getSnapshotTimestamps(uint256 roundId, address agentAddress)
        external
        view
        returns (uint256 firstActionBlock, uint256 lastActionBlock)
    {
        AgentSnapshot storage snap = roundSnapshots[roundId][agentAddress];
        return (snap.startBlock, snap.endBlock);
    }

    // ================================================================
    // Earnings Tracking Functions
    // ================================================================

    /// @notice Report earnings breakdown for an agent (relayer-only, ARCH-08 fix)
    /// @param roundId The round ID
    /// @param agent The agent to report for
    /// @param tradingFees Amount of fees earned from swaps
    /// @param borrowInterest Amount of interest earned from borrow volume
    /// @dev ARCH-08 fix: restricted to onlyRelayer. Values are NOT verified on-chain.
    ///      Do not treat as authoritative audit trail — relayer-reported hints only.
    function reportEarnings(
        uint256 roundId,
        address agent,
        uint256 tradingFees,
        uint256 borrowInterest
    ) external onlyRelayer {
        RoundData storage round = rounds[roundId];
        require(round.roundId != 0, "Arena: round not found");
        require(round.agentVaultIds[agent] != 0, "Arena: agent not registered");
        emit EarningsReported(roundId, agent, tradingFees, borrowInterest, tradingFees + borrowInterest);
    }
}
