// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin/security/ReentrancyGuard.sol";
import "openzeppelin/token/ERC20/IERC20.sol";
import "openzeppelin/token/ERC20/utils/SafeERC20.sol";
import "./IArena.sol";

// ================================================================
// CP-017: Bounty.sol State Machine Overhaul
// Fixes: CRIT-01, HIGH-01, HIGH-02, MED-01, MED-02, MED-03
// ================================================================

/// @title Bounty
/// @notice Smart contract for agent-to-agent USDC bounty bonds
/// @dev CP-017: Replaces bool claimed with BountyState enum; fixes permanent USDC lock (CRIT-01);
///      adds on-chain Arena verification (HIGH-01); adds proof-agent binding (HIGH-02);
///      adds terminal Paid state (MED-02); splits windowBlocks into dual deadlines (MED-03).
contract Bounty is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ================================================================
    // Type Definitions
    // ================================================================

    /// @notice Lifecycle states for a bounty.
    /// @dev Stored as uint8. Values: 0=Unclaimed, 1=Claimed, 2=Paid, 3=Expired.
    ///      ABI BREAK from prior bool claimed field (CP-017).
    enum BountyState {
        Unclaimed,   // 0 — bounty is live; no agent has claimed it
        Claimed,     // 1 — an agent has claimed; awaiting owner verification
        Paid,        // 2 — terminal; agent was verified and paid
        Expired      // 3 — terminal; bounty expired (observation or verification window)
    }

    /// @notice Conditions that must be met for a bounty to pay out.
    /// @dev windowBlocks has been split into observationWindowBlocks and verificationWindowBlocks.
    ///      ABI BREAK from prior single windowBlocks field (CP-017).
    struct BountyCondition {
        uint256 minVolumeUsdc;              // Minimum USDC volume (6 decimals)
        uint256 targetPriceMin;             // Min acceptable average price (sqrtPriceX96)
        uint256 targetPriceMax;             // Max acceptable average price (sqrtPriceX96)
        uint256 observationWindowBlocks;    // RENAMED from windowBlocks — how long agents can act
        uint256 verificationWindowBlocks;   // NEW — blocks after claim before owner must verify or escrow refunds
    }

    /// @notice Complete bounty record.
    /// @dev state replaces bool claimed (CP-017). claimedAt and createdAt are new fields.
    struct BountyRecord {
        uint256 bountyId;           // Unique ID (auto-incrementing)
        address creator;            // Agent that posted bounty; receives escrow refund on expiry
        uint256 rewardAmount;       // USDC reward in 6 decimals
        uint256 roundId;            // Which Arena round this applies to
        bytes32 conditionHash;      // keccak256 of BountyCondition at creation
        BountyCondition condition;  // Full condition data
        BountyState state;          // REPLACES bool claimed — see BountyState enum
        address claimedBy;          // Which agent claimed it (zero if Unclaimed)
        uint256 createdAt;          // Block number when bounty was created
        uint256 claimedAt;          // NEW — block.number when claimBounty() was called
    }

    // ================================================================
    // State Variables
    // ================================================================

    address public immutable usdcToken;
    address public immutable arena;
    address public owner;

    uint256 public nextBountyId = 1;

    /// @notice All bounties by ID
    mapping(uint256 => BountyRecord) public bounties;

    /// @notice Escrow balance per bounty
    mapping(uint256 => uint256) public escrowBalance;

    /// @notice Bounty IDs per round
    mapping(uint256 => uint256[]) public roundBounties;

    /// @notice Bounty IDs per creator
    mapping(address => uint256[]) public creatorBounties;

    // ================================================================
    // Events
    // ================================================================

    event BountyCreated(
        uint256 indexed bountyId,
        address indexed creator,
        uint256 reward,
        uint256 roundId,
        bytes32 conditionHash
    );

    event BountyClaimed(
        uint256 indexed bountyId,
        address indexed claimedBy,
        uint256 roundId,
        uint256 claimedAt
    );

    event BountyVerified(
        uint256 indexed bountyId,
        address indexed recipient,
        uint256 payout
    );

    event BountyExpired(
        uint256 indexed bountyId,
        address indexed creator,
        uint256 refund
    );

    event EscrowDeposited(
        uint256 indexed bountyId,
        uint256 amount
    );

    event EscrowReleased(
        uint256 indexed bountyId,
        address indexed recipient,
        uint256 amount
    );

    // ================================================================
    // Custom Errors
    // ================================================================

    error BountyNotFound(uint256 bountyId);
    error BountyNotClaimable(uint256 bountyId, BountyState current);
    error BountyNotVerifiable(uint256 bountyId, BountyState current);
    error BountyCannotExpire(uint256 bountyId, BountyState current);
    error BountyTerminal(uint256 bountyId, BountyState current);
    error ProofAgentMismatch(address proofAgent, address claimedBy);
    error ProofRoundMismatch(uint256 proofRound, uint256 claimRound);
    error VolumeConditionNotMet(uint256 onChainVolume, uint256 required);
    error PriceBelowMinimum(uint256 onChainPrice, uint256 minimum);
    error PriceAboveMaximum(uint256 onChainPrice, uint256 maximum);
    error InvalidBountyParams();
    error InsufficientAllowance();
    error TransferFailed();
    error VerificationWindowExpired(uint256 bountyId);
    error ObservationWindowExpired(uint256 bountyId);

    // ================================================================
    // Modifiers
    // ================================================================

    modifier onlyOwner() {
        require(msg.sender == owner, "Bounty: only owner can verify");
        _;
    }

    /// @notice Guard against acting on terminal bounties (defense-in-depth)
    modifier notTerminal(uint256 bountyId) {
        BountyState s = bounties[bountyId].state;
        if (s == BountyState.Paid || s == BountyState.Expired) {
            revert BountyTerminal(bountyId, s);
        }
        _;
    }

    // ================================================================
    // Constructor
    // ================================================================

    /// @notice Initialize Bounty contract with USDC and Arena addresses
    /// @param _usdc USDC token address
    /// @param _arena Arena contract address
    constructor(address _usdc, address _arena) {
        require(_usdc != address(0), "Bounty: invalid USDC address");
        require(_arena != address(0), "Bounty: invalid Arena address");

        usdcToken = _usdc;
        arena = _arena;
        owner = msg.sender;
    }

    // ================================================================
    // Core Functions
    // ================================================================

    /// @notice Create a new bounty with USDC reward and conditions
    /// @param roundId Which Arena round this bounty applies to
    /// @param rewardAmount USDC reward (6 decimals, e.g., 1000e6 = 1000 USDC)
    /// @param condition BountyCondition with volume/price targets and dual window blocks
    /// @return bountyId The newly created bounty ID
    function createBounty(
        uint256 roundId,
        uint256 rewardAmount,
        BountyCondition calldata condition
    ) external nonReentrant returns (uint256 bountyId) {
        // Validate inputs
        if (rewardAmount == 0) revert InvalidBountyParams();
        if (condition.minVolumeUsdc == 0) revert InvalidBountyParams();
        if (condition.observationWindowBlocks == 0) revert InvalidBountyParams();
        if (condition.verificationWindowBlocks == 0) revert InvalidBountyParams();
        if (condition.targetPriceMin > condition.targetPriceMax) revert InvalidBountyParams();

        // Get next bounty ID
        bountyId = nextBountyId;
        nextBountyId++;

        // Compute condition hash for immutable reference
        bytes32 conditionHash = keccak256(abi.encode(condition));

        // Create bounty record
        BountyRecord storage bounty = bounties[bountyId];
        bounty.bountyId = bountyId;
        bounty.creator = msg.sender;
        bounty.rewardAmount = rewardAmount;
        bounty.roundId = roundId;
        bounty.conditionHash = conditionHash;
        bounty.condition = condition;
        bounty.state = BountyState.Unclaimed;
        bounty.claimedBy = address(0);
        bounty.createdAt = block.number;
        bounty.claimedAt = 0;

        // Transfer USDC from creator to this contract (escrow)
        IERC20(usdcToken).safeTransferFrom(msg.sender, address(this), rewardAmount);

        // Record escrow balance
        escrowBalance[bountyId] = rewardAmount;

        // Index bounty by round and creator
        roundBounties[roundId].push(bountyId);
        creatorBounties[msg.sender].push(bountyId);

        emit EscrowDeposited(bountyId, rewardAmount);
        emit BountyCreated(bountyId, msg.sender, rewardAmount, roundId, conditionHash);
    }

    /// @notice Submit a claim for a bounty
    /// @param bountyId The bounty to claim
    function claimBounty(uint256 bountyId) external nonReentrant notTerminal(bountyId) {
        BountyRecord storage bounty = bounties[bountyId];

        // Validate bounty exists
        if (bounty.bountyId == 0) revert BountyNotFound(bountyId);

        // Validate state is Unclaimed
        if (bounty.state != BountyState.Unclaimed) {
            revert BountyNotClaimable(bountyId, bounty.state);
        }

        // Validate observation window has not elapsed
        if (block.number >= bounty.createdAt + bounty.condition.observationWindowBlocks) {
            revert ObservationWindowExpired(bountyId);
        }

        // Transition to Claimed
        bounty.state = BountyState.Claimed;
        bounty.claimedBy = msg.sender;
        bounty.claimedAt = block.number;

        emit BountyClaimed(bountyId, msg.sender, bounty.roundId, block.number);
    }

    /// @notice Verify bounty claim and execute payout (owner-only)
    /// @dev HIGH-01 fix: calls IArena.getSnapshots() for on-chain validation.
    ///      HIGH-02 fix: proof must bind to claimedBy and roundId.
    ///      MED-02 fix: sets terminal Paid state before transfer (CEI).
    /// @param bountyId The bounty to verify
    /// @param proof Encoded proof: (address agentAddress, uint256 roundId, uint256 volume, uint256 avgPrice)
    /// @return success True if verification succeeded and payout executed
    function verifyAndPay(
        uint256 bountyId,
        bytes calldata proof
    ) external nonReentrant onlyOwner notTerminal(bountyId) returns (bool success) {
        BountyRecord storage bounty = bounties[bountyId];

        // Validate bounty exists
        if (bounty.bountyId == 0) revert BountyNotFound(bountyId);

        // State gate: must be Claimed (MED-02 fix — Paid/Expired revert at notTerminal)
        if (bounty.state != BountyState.Claimed) {
            revert BountyNotVerifiable(bountyId, bounty.state);
        }

        // Verification window must not have elapsed
        if (block.number >= bounty.claimedAt + bounty.condition.verificationWindowBlocks) {
            revert VerificationWindowExpired(bountyId);
        }

        // Validate proof binding and on-chain conditions (extracted to avoid stack-too-deep)
        _validateProofAndConditions(bountyId, proof);

        // --- CEI: set terminal Paid state BEFORE transfer (MED-02 fix) ---
        address recipient = bounty.claimedBy;
        bounty.state = BountyState.Paid;
        uint256 payout = escrowBalance[bountyId];
        escrowBalance[bountyId] = 0;

        IERC20(usdcToken).safeTransfer(recipient, payout);

        emit BountyVerified(bountyId, recipient, payout);
        emit EscrowReleased(bountyId, recipient, payout);

        return true;
    }

    /// @notice Internal: validate proof binding and on-chain Arena conditions.
    /// @dev Extracted to reduce stack depth in verifyAndPay().
    ///      HIGH-02: proof agentAddress must match claimedBy; proofRoundId must match roundId.
    ///      HIGH-01: conditions validated against IArena.getSnapshots() on-chain data.
    function _validateProofAndConditions(uint256 bountyId, bytes calldata proof) internal view {
        BountyRecord storage bounty = bounties[bountyId];

        // Decode proof — (agentAddress, roundId, volume, avgPrice)
        // volume and avgPrice are for off-chain logging only; on-chain Arena data governs
        (address agentAddress, uint256 proofRoundId, , ) =
            abi.decode(proof, (address, uint256, uint256, uint256));

        // Agent binding check (HIGH-02)
        if (agentAddress != bounty.claimedBy) {
            revert ProofAgentMismatch(agentAddress, bounty.claimedBy);
        }
        if (proofRoundId != bounty.roundId) {
            revert ProofRoundMismatch(proofRoundId, bounty.roundId);
        }

        // On-chain Arena verification (HIGH-01)
        // All 4 return values explicitly named per B2 NOTE-1 resolution
        (
            uint256 onChainVolume,
            uint256 onChainAvgPrice,
            uint256 snapStartBlock,
            uint256 snapEndBlock
        ) = IArena(arena).getSnapshots(bounty.roundId, agentAddress);

        // snapStartBlock and snapEndBlock are bound per B2 NOTE-1; not used in condition checks
        snapStartBlock;
        snapEndBlock;

        // Validate conditions against on-chain Arena data
        if (onChainVolume < bounty.condition.minVolumeUsdc) {
            revert VolumeConditionNotMet(onChainVolume, bounty.condition.minVolumeUsdc);
        }
        if (onChainAvgPrice < bounty.condition.targetPriceMin) {
            revert PriceBelowMinimum(onChainAvgPrice, bounty.condition.targetPriceMin);
        }
        if (onChainAvgPrice > bounty.condition.targetPriceMax) {
            revert PriceAboveMaximum(onChainAvgPrice, bounty.condition.targetPriceMax);
        }
    }

    /// @notice Expire a bounty and refund the creator.
    /// @dev CRIT-01 fix: two rescue paths:
    ///      Path A — Unclaimed AND observation window elapsed.
    ///      Path B — Claimed AND verification window elapsed (claimed-but-unverified rescue).
    /// @param bountyId The bounty to expire
    function expireBounty(uint256 bountyId) external nonReentrant notTerminal(bountyId) {
        BountyRecord storage bounty = bounties[bountyId];

        // Validate bounty exists
        if (bounty.bountyId == 0) revert BountyNotFound(bountyId);

        // Path A: observation window elapsed on unclaimed bounty
        bool unclaimedExpired = (
            bounty.state == BountyState.Unclaimed &&
            block.number >= bounty.createdAt + bounty.condition.observationWindowBlocks
        );

        // Path B: verification window elapsed on claimed-but-unverified bounty (CRIT-01 fix)
        bool claimedUnverifiedExpired = (
            bounty.state == BountyState.Claimed &&
            block.number >= bounty.claimedAt + bounty.condition.verificationWindowBlocks
        );

        if (!unclaimedExpired && !claimedUnverifiedExpired) {
            revert BountyCannotExpire(bountyId, bounty.state);
        }

        // CEI: set terminal state BEFORE transfer
        bounty.state = BountyState.Expired;
        uint256 refund = escrowBalance[bountyId];
        escrowBalance[bountyId] = 0;

        IERC20(usdcToken).safeTransfer(bounty.creator, refund);

        emit BountyExpired(bountyId, bounty.creator, refund);
        emit EscrowReleased(bountyId, bounty.creator, refund);
    }

    // ================================================================
    // View Functions
    // ================================================================

    /// @notice Get bounty details by ID
    /// @param bountyId The bounty to retrieve
    /// @return bounty Full bounty record
    function getBounty(uint256 bountyId) external view returns (BountyRecord memory bounty) {
        bounty = bounties[bountyId];
        if (bounty.bountyId == 0) revert BountyNotFound(bountyId);
    }

    /// @notice Get all bounties for a round
    /// @param roundId The Arena round
    /// @return bountyIds Array of bounty IDs in this round
    function getRoundBounties(uint256 roundId) external view returns (uint256[] memory bountyIds) {
        bountyIds = roundBounties[roundId];
    }

    /// @notice Get all bounties created by an agent
    /// @param creator The creator address
    /// @return bountyIds Array of bounty IDs created by this agent
    function getCreatorBounties(address creator) external view returns (uint256[] memory bountyIds) {
        bountyIds = creatorBounties[creator];
    }

    /// @notice Get escrow balance for a bounty
    /// @param bountyId The bounty
    /// @return balance USDC amount in escrow (6 decimals)
    function getEscrowBalance(uint256 bountyId) external view returns (uint256 balance) {
        balance = escrowBalance[bountyId];
    }

    /// @notice Get the current state of a bounty
    /// @param bountyId The bounty
    /// @return state Current BountyState enum value
    function getBountyState(uint256 bountyId) external view returns (BountyState state) {
        state = bounties[bountyId].state;
    }
}
