// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin/security/ReentrancyGuard.sol";
import "openzeppelin/token/ERC20/IERC20.sol";

/// @title IBounty Interface (minimal)
interface IEssentialToken is IERC20 {
  // Standard ERC20 interface sufficient for our needs
}

/// @title Bounty
/// @notice Smart contract for agent-to-agent USDC bounty bonds
/// @dev Manages bounty creation, claiming, verification, and escrow payouts
contract Bounty is ReentrancyGuard {
  // ================================================================
  // Type Definitions
  // ================================================================

  /// @notice Bounty condition requirements for claiming
  struct BountyCondition {
    uint256 minVolumeUsdc;    // Minimum USDC volume (6 decimals)
    uint256 targetPriceMin;   // Min acceptable average price (sqrtPriceX96)
    uint256 targetPriceMax;   // Max acceptable average price (sqrtPriceX96)
    uint64 windowBlocks;      // Observation window in blocks
  }

  /// @notice Complete bounty record
  struct Bounty {
    uint256 bountyId;         // Unique ID (auto-incrementing)
    address creator;          // Agent that posted bounty
    uint256 rewardAmount;     // USDC reward in 6 decimals
    uint256 roundId;          // Which Arena round this applies to
    bytes32 conditionHash;    // Hash of BountyCondition struct
    BountyCondition condition; // Full condition data
    uint64 expiresAt;         // Block number (uint64)
    bool claimed;             // Has someone claimed this bounty?
    address claimedBy;        // Which agent claimed it
    uint256 claimTxBlock;     // Block number when claim was submitted
  }

  // ================================================================
  // State Variables
  // ================================================================

  address public immutable usdcToken;
  address public immutable arena;
  address public owner;

  uint256 public nextBountyId = 1;

  /// @notice All bounties by ID
  mapping(uint256 => Bounty) public bounties;

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

  // ================================================================
  // Custom Errors
  // ================================================================

  error BountyNotFound(uint256 bountyId);
  error BountyAlreadyClaimed(uint256 bountyId);
  error BountyExpiredError(uint256 bountyId);
  error BountyConditionsNotMet(uint256 bountyId);
  error BountyNotYetClaimed(uint256 bountyId);
  error InvalidBountyParams();
  error InsufficientAllowance();
  error NotYetExpired(uint256 bountyId);
  error TransferFailed();

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
  /// @param condition BountyCondition with volume/price targets
  /// @return bountyId The newly created bounty ID
  function createBounty(
    uint256 roundId,
    uint256 rewardAmount,
    BountyCondition calldata condition
  ) external nonReentrant returns (uint256 bountyId) {
    // Validate inputs
    if (rewardAmount == 0) {
      revert InvalidBountyParams();
    }
    if (condition.minVolumeUsdc == 0) {
      revert InvalidBountyParams();
    }
    if (condition.windowBlocks == 0) {
      revert InvalidBountyParams();
    }
    if (condition.targetPriceMin > condition.targetPriceMax) {
      revert InvalidBountyParams();
    }

    // Get next bounty ID
    bountyId = nextBountyId;
    nextBountyId++;

    // Compute condition hash for immutable reference
    bytes32 conditionHash = keccak256(abi.encode(condition));

    // Calculate expiry block
    uint64 expiresAt = uint64(block.number) + condition.windowBlocks;

    // Create bounty record
    Bounty storage bounty = bounties[bountyId];
    bounty.bountyId = bountyId;
    bounty.creator = msg.sender;
    bounty.rewardAmount = rewardAmount;
    bounty.roundId = roundId;
    bounty.conditionHash = conditionHash;
    bounty.condition = condition;
    bounty.expiresAt = expiresAt;
    bounty.claimed = false;
    bounty.claimedBy = address(0);
    bounty.claimTxBlock = 0;

    // Transfer USDC from creator to this contract (escrow)
    bool transferOk = IEssentialToken(usdcToken).transferFrom(
      msg.sender,
      address(this),
      rewardAmount
    );
    if (!transferOk) {
      revert TransferFailed();
    }

    // Record escrow balance
    escrowBalance[bountyId] = rewardAmount;

    // Index bounty by round and creator
    roundBounties[roundId].push(bountyId);
    creatorBounties[msg.sender].push(bountyId);

    // Emit events
    emit EscrowDeposited(bountyId, rewardAmount);
    emit BountyCreated(bountyId, msg.sender, rewardAmount, roundId, conditionHash, expiresAt);
  }

  /// @notice Submit a claim for a bounty
  /// @param bountyId The bounty to claim
  function claimBounty(uint256 bountyId) external nonReentrant {
    Bounty storage bounty = bounties[bountyId];

    // Validate bounty exists
    if (bounty.bountyId == 0) {
      revert BountyNotFound(bountyId);
    }

    // Validate not already claimed
    if (bounty.claimed) {
      revert BountyAlreadyClaimed(bountyId);
    }

    // Validate not expired
    if (block.number >= bounty.expiresAt) {
      revert BountyExpiredError(bountyId);
    }

    // Mark as claimed
    bounty.claimed = true;
    bounty.claimedBy = msg.sender;
    bounty.claimTxBlock = block.number;

    // Emit event
    emit BountyClaimSubmitted(bountyId, msg.sender, block.number);
  }

  /// @notice Verify bounty claim and execute payout (owner-only for MVP)
  /// @param bountyId The bounty to verify
  /// @param snapshotProof Encoded proof (volume, avgPrice)
  /// @return success True if verification succeeded and payout executed
  function verifyAndPay(
    uint256 bountyId,
    bytes calldata snapshotProof
  ) external nonReentrant returns (bool success) {
    // Owner-only for MVP (post-hackathon: signer whitelist)
    require(msg.sender == owner, "Bounty: only owner can verify");

    Bounty storage bounty = bounties[bountyId];

    // Validate bounty exists
    if (bounty.bountyId == 0) {
      revert BountyNotFound(bountyId);
    }

    // Validate bounty has been claimed
    if (!bounty.claimed) {
      revert BountyNotYetClaimed(bountyId);
    }

    // Validate not expired
    if (block.number >= bounty.expiresAt) {
      revert BountyExpiredError(bountyId);
    }

    // Decode snapshot proof
    (uint256 volume, uint256 avgPrice) = _decodeAndValidateSnapshot(snapshotProof, bounty);

    // Verify conditions
    if (volume < bounty.condition.minVolumeUsdc) {
      revert BountyConditionsNotMet(bountyId);
    }

    if (avgPrice < bounty.condition.targetPriceMin || avgPrice > bounty.condition.targetPriceMax) {
      revert BountyConditionsNotMet(bountyId);
    }

    // Get payout amount
    uint256 payout = escrowBalance[bountyId];

    // Clear escrow (before transfer, to prevent reentrancy)
    escrowBalance[bountyId] = 0;

    // Transfer USDC to claimer
    bool transferOk = IEssentialToken(usdcToken).transfer(bounty.claimedBy, payout);
    if (!transferOk) {
      revert TransferFailed();
    }

    // Emit events
    emit BountyVerified(bountyId, bounty.claimedBy, payout, block.number);
    emit EscrowReleased(bountyId, bounty.claimedBy, payout);

    return true;
  }

  /// @notice Expire an unclaimed bounty and refund creator
  /// @param bountyId The bounty to expire
  function expireBounty(uint256 bountyId) external nonReentrant {
    Bounty storage bounty = bounties[bountyId];

    // Validate bounty exists
    if (bounty.bountyId == 0) {
      revert BountyNotFound(bountyId);
    }

    // Validate bounty has expired
    if (block.number < bounty.expiresAt) {
      revert NotYetExpired(bountyId);
    }

    // Validate not already claimed
    if (bounty.claimed) {
      revert BountyAlreadyClaimed(bountyId);
    }

    // Get refund amount
    uint256 refund = escrowBalance[bountyId];

    // Clear escrow (before transfer)
    escrowBalance[bountyId] = 0;

    // Mark as claimed to prevent future claims
    bounty.claimed = true;

    // Transfer USDC back to creator
    bool transferOk = IEssentialToken(usdcToken).transfer(bounty.creator, refund);
    if (!transferOk) {
      revert TransferFailed();
    }

    // Emit events
    emit BountyExpired(bountyId, refund);
    emit EscrowReleased(bountyId, bounty.creator, refund);
  }

  // ================================================================
  // View Functions
  // ================================================================

  /// @notice Get bounty details by ID
  /// @param bountyId The bounty to retrieve
  /// @return bounty Full bounty record
  function getBounty(uint256 bountyId) external view returns (Bounty memory bounty) {
    bounty = bounties[bountyId];
    if (bounty.bountyId == 0) {
      revert BountyNotFound(bountyId);
    }
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

  // ================================================================
  // Helper Functions
  // ================================================================

  /// @notice Decode and validate snapshot proof
  /// @param proof Encoded proof (volume, avgPrice)
  /// @param bounty The bounty being verified
  /// @return volume USDC volume traded
  /// @return avgPrice Average execution price (sqrtPriceX96)
  function _decodeAndValidateSnapshot(
    bytes calldata proof,
    Bounty storage bounty
  ) internal view returns (uint256 volume, uint256 avgPrice) {
    // Decode proof as (uint256 volume, uint256 avgPrice)
    (volume, avgPrice) = abi.decode(proof, (uint256, uint256));

    // MVP: basic validation (server validates in production)
    // Post-hackathon: would call IArena(arena).getSnapshots()
  }
}
