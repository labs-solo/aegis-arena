// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IBounty
/// @notice Interface for Bounty Bond contract — agent-to-agent USDC rewards
interface IBounty {
  // ================================================================
  // Type Definitions
  // ================================================================

  struct BountyCondition {
    uint256 minVolumeUsdc;
    uint256 targetPriceMin;
    uint256 targetPriceMax;
    uint64 windowBlocks;
  }

  struct Bounty {
    uint256 bountyId;
    address creator;
    uint256 rewardAmount;
    uint256 roundId;
    bytes32 conditionHash;
    BountyCondition condition;
    uint64 expiresAt;
    bool claimed;
    address claimedBy;
    uint256 claimTxBlock;
  }

  // ================================================================
  // Core Functions
  // ================================================================

  /// @notice Create a new bounty with USDC reward and conditions
  /// @param roundId Which Arena round this bounty applies to
  /// @param rewardAmount USDC reward (6 decimals)
  /// @param condition BountyCondition with volume/price targets
  /// @return bountyId The newly created bounty ID
  function createBounty(
    uint256 roundId,
    uint256 rewardAmount,
    BountyCondition calldata condition
  ) external returns (uint256 bountyId);

  /// @notice Submit a claim for a bounty
  /// @param bountyId The bounty to claim
  function claimBounty(uint256 bountyId) external;

  /// @notice Verify bounty claim and execute payout
  /// @param bountyId The bounty to verify
  /// @param snapshotProof Encoded proof (volume, avgPrice)
  /// @return success True if verification succeeded
  function verifyAndPay(uint256 bountyId, bytes calldata snapshotProof) external returns (bool);

  /// @notice Expire an unclaimed bounty and refund creator
  /// @param bountyId The bounty to expire
  function expireBounty(uint256 bountyId) external;

  // ================================================================
  // View Functions
  // ================================================================

  /// @notice Get bounty details by ID
  /// @param bountyId The bounty to retrieve
  /// @return bounty Full bounty record
  function getBounty(uint256 bountyId) external view returns (Bounty memory bounty);

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

  // ================================================================
  // Events
  // ================================================================

  event BountyCreated(
    uint256 indexed bountyId,
    address indexed creator,
    uint256 reward,
    uint256 roundId,
    bytes32 conditionHash,
    uint64 expiresAt
  );

  event BountyClaimSubmitted(
    uint256 indexed bountyId,
    address indexed claimer,
    uint256 submitBlock
  );

  event BountyVerified(
    uint256 indexed bountyId,
    address indexed claimer,
    uint256 payout,
    uint256 verifyBlock
  );

  event BountyExpired(
    uint256 indexed bountyId,
    uint256 creatorRefund
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
