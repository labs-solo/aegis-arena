// src/contracts/bounty.ts
// Re-export shim for BountyClient from sdk/bounty.ts
// CP-017: BountyState enum already implemented in sdk/bounty.ts

export {
  BountyClient,
  BountyState,
  createBounty,
  claimBounty,
  getBounty,
  getRoundBounties,
  getCreatorBounties,
  getEscrowBalance,
  verifyBountyClaim,
} from "../sdk/bounty.js";
