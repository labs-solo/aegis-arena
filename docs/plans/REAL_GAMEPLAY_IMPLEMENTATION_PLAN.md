# Real Gameplay Implementation Plan

## Purpose

This plan defines the minimum coherent implementation needed to move `aegis-arena` from demo/stub behavior to verifiable gameplay wiring. It is grounded in the current repo state and is intentionally fail-closed: it does not assume `Arena.sol`, `Bounty.sol`, the server, or the agents already provide production execution or proof verification.

## Current Slice Status

- `Arena.executeBatch()` is no longer event-only. It now records authoritative Arena-side execution state, stores per-agent execution snapshots, and accepts proof-eligible execution metadata only when the declared surface matches configured AEGIS/router boundary addresses.
- Server and agent write paths now submit real `Arena.executeBatch(...)` transactions instead of returning mock tx hashes.
- Public game state and score endpoints now read Arena state. For unsettled rounds, the score endpoint reports Arena-backed execution volume rather than fabricated settlement output.
- `Bounty.verifyAndPay()` now fails closed unless the supplied proof resolves to an Arena snapshot for the claimed round and claimer. Economic settlement and downstream router execution remain incomplete.

## CP-021 Approach 2 Decision

- Chosen model: the orchestrator provisions AEGIS vaults first, and `Arena.register()` binds those explicit vault IDs to agents.
- Default owner/deployer assumption: the deployer wallet `0x71632aA7C30D6A1644e5Db13d245bd195A08b70b` is the non-agent owner unless ownership is explicitly transferred later.

## Current Repo Truth

### Contracts

- [`contracts/Arena.sol`](/Users/page/Page/repos/aegis-arena/contracts/Arena.sol) `register()` now binds orchestrator-provided vault IDs and rejects zero, duplicate-agent, and duplicate-vault inputs; it still does not create vaults itself.
- [`src/sdk/vault-validator.ts`](/Users/page/Page/repos/aegis-arena/src/sdk/vault-validator.ts) adds the first truthful validation layer for supplied vault IDs: configured allowlists plus a best-effort `VaultRegistry.ownerOf()` probe when a readable registry/provider is configured.
- [`src/sdk/arena.ts`](/Users/page/Page/repos/aegis-arena/src/sdk/arena.ts) reads authoritative agent-to-vault bindings from Arena and performs the registration write after validation.
- [`src/server/routes/agent-actions.ts`](/Users/page/Page/repos/aegis-arena/src/server/routes/agent-actions.ts) exposes `POST /api/agent/register` and `GET /api/agent/bindings/*` for orchestrator-owned registration and binding reads when Arena/RPC config is present.
- [`contracts/Arena.sol`](/Users/page/Page/repos/aegis-arena/contracts/Arena.sol) `executeBatch()` only validates round/agent membership and emits `ActionsExecuted`; it does not forward actions to AEGIS Router or persist execution results.
- [`contracts/Arena.sol`](/Users/page/Page/repos/aegis-arena/contracts/Arena.sol) `settle()` assigns mock descending scores and mock prizes.
- [`contracts/Arena.sol`](/Users/page/Page/repos/aegis-arena/contracts/Arena.sol) `getSnapshots()` and `getSnapshotTimestamps()` are stubs returning mock data.
- [`contracts/IArena.sol`](/Users/page/Page/repos/aegis-arena/contracts/IArena.sol) does not expose the snapshot methods that exist on `Arena.sol`, so the public contract surface is already drifting from the implementation.
- [`contracts/Bounty.sol`](/Users/page/Page/repos/aegis-arena/contracts/Bounty.sol) `verifyAndPay()` trusts owner-supplied `snapshotProof` bytes decoded by `_decodeAndValidateSnapshot()` rather than verifying an Arena-backed snapshot or attestation.

### Server / Orchestrator / Runtime

- [`src/server/routes/agent-actions.ts`](/Users/page/Page/repos/aegis-arena/src/server/routes/agent-actions.ts) still returns mock tx hashes for `executeBatch()` submission, but registration now has a real Arena write path when the deployer-owned signer is configured.
- [`src/server/routes/bounties.ts`](/Users/page/Page/repos/aegis-arena/src/server/routes/bounties.ts) lists mock bounties, accepts claims without contract submission, and treats `/verify` as a server-side proof decoding endpoint.
- [`src/server/index.ts`](/Users/page/Page/repos/aegis-arena/src/server/index.ts) serves mock game state and mock scores.
- [`src/agents/base-agent.ts`](/Users/page/Page/repos/aegis-arena/src/agents/base-agent.ts) now encodes `Arena.executeBatch(roundId, agent, actions)` calldata after a registered vault ID is bound, but direct execution and tx signing/submission are still placeholders.

### Owner / Deployer Wiring

- [`contracts/Arena.sol`](/Users/page/Page/repos/aegis-arena/contracts/Arena.sol) and [`contracts/Bounty.sol`](/Users/page/Page/repos/aegis-arena/contracts/Bounty.sol) both default `owner = msg.sender` at deployment.
- [`contracts/script/DeployArena.s.sol`](/Users/page/Page/repos/aegis-arena/contracts/script/DeployArena.s.sol) deploys `Arena` from `ORCHESTRATOR_PRIVATE_KEY`.
- [`deploy/addresses.json`](/Users/page/Page/repos/aegis-arena/deploy/addresses.json) records a `deployedBy` address that should be treated as the default non-agent owner/deployer authority. Agent wallets must not be assumed to own Arena/Bounty unless explicitly configured otherwise.

## Minimum Coherent Implementation Set

The next execution agent should treat the following as one slice. Partial implementation leaves the repo in an ambiguous state.

1. Contract truthfulness.
2. Runtime submission wiring.
3. Snapshot/proof verification path.
4. Owner/deployer authority wiring.
5. Tests and docs updated to match the above.

## Staged Work

### Stage 1: Lock Down Contract Interfaces and Authority

Files:
- [`contracts/IArena.sol`](/Users/page/Page/repos/aegis-arena/contracts/IArena.sol)
- [`contracts/Arena.sol`](/Users/page/Page/repos/aegis-arena/contracts/Arena.sol)
- [`contracts/Bounty.sol`](/Users/page/Page/repos/aegis-arena/contracts/Bounty.sol)
- [`contracts/interfaces/IBounty.sol`](/Users/page/Page/repos/aegis-arena/contracts/interfaces/IBounty.sol)
- [`contracts/script/DeployArena.s.sol`](/Users/page/Page/repos/aegis-arena/contracts/script/DeployArena.s.sol)
- [`deploy/addresses.json`](/Users/page/Page/repos/aegis-arena/deploy/addresses.json)

Required changes:
- Expose the actual Arena snapshot/query surface in `IArena.sol`, or remove public claims that the interface supports snapshot-backed bounty verification until it does.
- Add explicit deployer/owner configuration semantics to docs and scripts. Default owner is the deployer wallet, not any agent wallet.
- If ownership transfer is needed, wire it explicitly in deployment/config docs rather than implicitly inferring it from agent addresses.
- Keep existing agent naming unchanged, including `Predator`.

Acceptance condition:
- A reader can determine exactly which address owns Arena/Bounty and which interface methods downstream code is allowed to call.

### Stage 2: Replace Synthetic Vault IDs With Real Vault Binding

Files:
- [`contracts/Arena.sol`](/Users/page/Page/repos/aegis-arena/contracts/Arena.sol)
- [`contracts/AegisDeployConfig.sol`](/Users/page/Page/repos/aegis-arena/contracts/AegisDeployConfig.sol)
- [`src/agents/base-agent.ts`](/Users/page/Page/repos/aegis-arena/src/agents/base-agent.ts)
- [`src/server/routes/agent-actions.ts`](/Users/page/Page/repos/aegis-arena/src/server/routes/agent-actions.ts)

Required contract changes:
- Remove synthetic sequential vault ID assignment from `register()`.
- Replace it with one real source of truth:
  - either `Arena.register()` creates/binds real vaults against the configured AEGIS contracts, or
  - the orchestrator provisions vaults first and `Arena.register()` validates and stores those pre-existing vault IDs.
- Emit the real vault ID in `AgentRegistered`.

Required runtime changes:
- The orchestrator must own the registration flow and persist the returned agent-to-vault mapping.
- Agents must read the actual registered vault ID instead of carrying an arbitrary local `vaultId`.

Acceptance condition:
- For any registered agent, `Arena.getAgentVault()` resolves to a real AEGIS-backed vault identifier rather than a synthetic placeholder.

### Stage 3: Make `executeBatch()` a Real Submission Boundary

Files:
- [`contracts/Arena.sol`](/Users/page/Page/repos/aegis-arena/contracts/Arena.sol)
- [`src/agents/base-agent.ts`](/Users/page/Page/repos/aegis-arena/src/agents/base-agent.ts)
- [`src/server/routes/agent-actions.ts`](/Users/page/Page/repos/aegis-arena/src/server/routes/agent-actions.ts)
- [`src/sdk/opcodes.ts`](/Users/page/Page/repos/aegis-arena/src/sdk/opcodes.ts)
- [`src/sdk/router.ts`](/Users/page/Page/repos/aegis-arena/src/sdk/router.ts)

Required contract changes:
- Define what `actions` mean at the Arena boundary: raw router calldata, encoded opcodes, or a constrained Arena action format.
- Ensure `executeBatch()` either forwards to the router/engine or rejects unsupported action payloads. Event-only recording is not sufficient.
- Emit enough data to reconstruct what was actually attempted and whether it succeeded.

Required runtime changes:
- `BaseAgent.buildTxParams()` must encode the real `Arena.executeBatch(roundId, agent, actions)` call.
- Direct execution must stop returning mock hashes.
- Server `submitActionsToArena()` must submit the contract call and return actual tx hashes/receipts.

Acceptance condition:
- A batch submitted by the server or an agent results in a real chain transaction that changes state outside `Arena` or reverts cleanly.

### Stage 4: Replace Mock Settlement and Snapshot Stubs

Files:
- [`contracts/Arena.sol`](/Users/page/Page/repos/aegis-arena/contracts/Arena.sol)
- [`docs/specs/SCORING.md`](/Users/page/Page/repos/aegis-arena/docs/specs/SCORING.md)
- [`src/server/index.ts`](/Users/page/Page/repos/aegis-arena/src/server/index.ts)

Required contract changes:
- Implement a real settlement source of truth based on current vault holdings and the pool state actually referenced by the deployed market.
- Remove mock score assignment from `settle()`.
- Replace `getSnapshots()`/`getSnapshotTimestamps()` stub returns with persisted or derivable round/agent execution snapshots.

Required runtime changes:
- Public game state and score endpoints must read real contract state and fail if the round is unsettled or snapshot data is unavailable.

Acceptance condition:
- `settle()` can only succeed from actual vault/pool state, and snapshot queries return data derived from real gameplay rather than constants.

### Stage 5: Make Bounty Verification Arena-Backed

Files:
- [`contracts/Bounty.sol`](/Users/page/Page/repos/aegis-arena/contracts/Bounty.sol)
- [`contracts/IArena.sol`](/Users/page/Page/repos/aegis-arena/contracts/IArena.sol)
- [`contracts/interfaces/IBounty.sol`](/Users/page/Page/repos/aegis-arena/contracts/interfaces/IBounty.sol)
- [`src/server/routes/bounties.ts`](/Users/page/Page/repos/aegis-arena/src/server/routes/bounties.ts)
- [`src/sdk/bounty.ts`](/Users/page/Page/repos/aegis-arena/src/sdk/bounty.ts)

Required contract changes:
- `verifyAndPay()` must stop trusting owner-provided `(volume, avgPrice)` bytes as proof.
- Verification must be rooted in Arena-backed data:
  - either `Bounty.sol` reads validated snapshots from `Arena`,
  - or it validates a signed attestation whose payload is itself derived from Arena snapshots and whose signer set is explicit.
- If Arena cannot provide the necessary data for a bounty condition, `verifyAndPay()` must fail closed.

Required runtime changes:
- `/api/bounties/verify` should become a thin caller of the on-chain verification path, not a substitute for it.
- `/api/bounties/:roundId` and `/claim` should stop returning mock results and should reflect contract state.

Acceptance condition:
- A bounty payout is impossible unless the condition can be proven from Arena-backed data for the claimed round, claimer, and block window.

### Stage 6: Tests and Truthful Docs

Files:
- [`tests/contracts/bounty.test.ts`](/Users/page/Page/repos/aegis-arena/tests/contracts/bounty.test.ts)
- [`tests/integration/bounty-flow.test.ts`](/Users/page/Page/repos/aegis-arena/tests/integration/bounty-flow.test.ts)
- [`tests/integration/gateway-flow.test.ts`](/Users/page/Page/repos/aegis-arena/tests/integration/gateway-flow.test.ts)
- [`README.md`](/Users/page/Page/repos/aegis-arena/README.md)
- [`TECHNICAL.md`](/Users/page/Page/repos/aegis-arena/TECHNICAL.md)
- [`GAME_STATUS.md`](/Users/page/Page/repos/aegis-arena/GAME_STATUS.md)

Required changes:
- Add tests that fail on synthetic vault IDs, mock settlement, mock snapshots, and owner-supplied proof bypasses.
- Remove or qualify any doc text that claims live on-chain verification where the repo still uses mock data.

Acceptance condition:
- The tests describe the intended non-mock behavior, and the public docs no longer imply that the missing pieces already exist.

## Runtime Boundary

This repo should own gameplay execution, contract integration, and public status docs. If CP-013 or related control-plane artifacts in `/Users/page/Page/repos/talos-runtime` are needed for wording or attestation format alignment, treat them as reference material only; do not make `aegis-arena` depend on `talos-runtime` for core gameplay verification.

## Suggested Execution Order

1. Interface and owner/deployer cleanup.
2. Real vault binding in `register()`.
3. Real `executeBatch()` submission path.
4. Arena snapshots and settlement.
5. Arena-backed bounty verification.
6. Tests and doc cleanup.

## Blockers / Open Decisions

- Whether Arena itself creates vaults or only binds orchestrator-created vaults is not resolved in the current repo.
- The exact snapshot schema needed for bounty conditions is not yet defined in code. The next executor should define a concrete data model before editing `Bounty.sol`.
- The repo contains docs that describe live behavior more aggressively than the code implements. Those claims should not be used as acceptance criteria.
