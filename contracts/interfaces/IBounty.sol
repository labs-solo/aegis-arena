// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IBounty
/// @notice Interface for Bounty Bond contract — agent-to-agent USDC rewards
/// @dev CP-017: Updated to reflect BountyState enum, dual window fields, new struct layout.
///      ABI BREAK from prior version — see CP-017 §5.2 for migration notes.
interface IBounty {
    // ================================================================
    // Type Definitions
    // ================================================================

    /// @notice Lifecycle states for a bounty.
    /// @dev Stored as uint8. Values: 0=Unclaimed, 1=Claimed, 2=Paid, 3=Expired.
    ///      REPLACES bool claimed (CP-017).
    enum BountyState {
        Unclaimed,   // 0
        Claimed,     // 1
        Paid,        // 2
        Expired      // 3
    }

    /// @notice Conditions that must be met for a bounty to pay out.
    /// @dev windowBlocks split into dual windows (CP-017 MED-03 fix).
    struct BountyCondition {
        uint256 minVolumeUsdc;
        uint256 targetPriceMin;
        uint256 targetPriceMax;
        uint256 observationWindowBlocks;   // RENAMED from windowBlocks
        uint256 verificationWindowBlocks;  // NEW — verification deadline post-claim
    }

    /// @notice Complete bounty record.
    /// @dev state replaces bool claimed; claimedAt and createdAt are new fields (CP-017).
    struct BountyRecord {
        uint256 bountyId;
        address creator;
        uint256 rewardAmount;
        uint256 roundId;
        bytes32 conditionHash;
        BountyCondition condition;
        BountyState state;      // REPLACES bool claimed
        address claimedBy;
        uint256 createdAt;      // NEW — block.number at creation
        uint256 claimedAt;      // NEW — block.number when claimed
    }

    // ================================================================
    // Core Functions
    // ================================================================

    /// @notice Create a new bounty with USDC reward and conditions
    /// @param roundId Which Arena round this bounty applies to
    /// @param rewardAmount USDC reward (6 decimals)
    /// @param condition BountyCondition with volume/price targets and dual window blocks
    /// @return bountyId The newly created bounty ID
    function createBounty(
        uint256 roundId,
        uint256 rewardAmount,
        BountyCondition calldata condition
    ) external returns (uint256 bountyId);

    /// @notice Submit a claim for a bounty
    /// @param bountyId The bounty to claim
    function claimBounty(uint256 bountyId) external;

    /// @notice Verify bounty claim and execute payout (owner-only)
    /// @dev Proof must encode (address agentAddress, uint256 roundId, uint256 volume, uint256 avgPrice).
    ///      On-chain Arena.getSnapshots() is called; conditions validated against Arena data.
    /// @param bountyId The bounty to verify
    /// @param proof Encoded proof (agentAddress, roundId, volume, avgPrice)
    /// @return success True if verification succeeded
    function verifyAndPay(uint256 bountyId, bytes calldata proof) external returns (bool);

    /// @notice Expire a bounty and refund the creator
    /// @dev Handles both unclaimed (observation window) and claimed (verification window) paths.
    /// @param bountyId The bounty to expire
    function expireBounty(uint256 bountyId) external;

    // ================================================================
    // View Functions
    // ================================================================

    /// @notice Get bounty details by ID
    /// @param bountyId The bounty to retrieve
    /// @return bounty Full bounty record
    function getBounty(uint256 bountyId) external view returns (BountyRecord memory bounty);

    /// @notice Get all bounties for a round
    /// @param roundId The Arena round
    /// @return bountyIds Array of bounty IDs
    function getRoundBounties(uint256 roundId) external view returns (uint256[] memory bountyIds);

    /// @notice Get all bounties created by an agent
    /// @param creator The creator address
    /// @return bountyIds Array of bounty IDs
    function getCreatorBounties(address creator) external view returns (uint256[] memory bountyIds);

    /// @notice Get escrow balance for a bounty
    /// @param bountyId The bounty
    /// @return balance USDC amount in escrow
    function getEscrowBalance(uint256 bountyId) external view returns (uint256 balance);

    /// @notice Get the current lifecycle state of a bounty
    /// @param bountyId The bounty
    /// @return state Current BountyState enum value
    function getBountyState(uint256 bountyId) external view returns (BountyState state);

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
}
