import { ethers } from "ethers";
import type {
  ArenaAgentBinding,
  VaultValidationEvidence,
  VaultValidationResult,
} from './types.js';

const VAULT_REGISTRY_ABI = [
  "function ownerOf(uint256 tokenId) view returns (address)",
] as const;

export interface VaultValidationConfig {
  provider?: ethers.Provider;
  vaultRegistryAddress?: string;
  knownVaultIds?: Array<bigint | number | string>;
  knownVaultOwners?: Record<string, string>;
  vaultRegistryContract?: {
    ownerOf(vaultId: bigint): Promise<string>;
  };
}

export class VaultValidationError extends Error {
  constructor(
    message: string,
    public readonly results: VaultValidationResult[]
  ) {
    super(message);
    this.name = "VaultValidationError";
  }
}

export class AegisVaultValidator {
  private readonly provider?: ethers.Provider;
  private readonly vaultRegistryAddress?: string;
  private readonly knownVaultIds: Set<string>;
  private readonly knownVaultOwners: Map<string, string>;
  private readonly vaultRegistryContract?: {
    ownerOf(vaultId: bigint): Promise<string>;
  };

  constructor(config: VaultValidationConfig = {}) {
    this.provider = config.provider;
    this.vaultRegistryAddress = config.vaultRegistryAddress;
    this.knownVaultIds = new Set(
      (config.knownVaultIds || []).map((vaultId) => this.normalizeVaultId(vaultId))
    );
    this.knownVaultOwners = new Map(
      Object.entries(config.knownVaultOwners || {}).map(([vaultId, owner]) => [
        this.normalizeVaultId(vaultId),
        ethers.getAddress(owner),
      ])
    );
    this.vaultRegistryContract = config.vaultRegistryContract;
  }

  async validateVault(
    vaultIdInput: bigint | number | string,
    expectedOwner?: string
  ): Promise<VaultValidationResult> {
    const vaultId = BigInt(vaultIdInput);
    const evidence: VaultValidationEvidence[] = [];
    const limitations: string[] = [];
    let owner: string | undefined;
    let valid = false;

    if (vaultId <= 0n) {
      return {
        vaultId,
        valid: false,
        evidence: [
          {
            source: "config.knownVaultIds",
            success: false,
            details: "Vault IDs must be greater than zero",
          },
        ],
        limitations,
      };
    }

    const normalizedExpectedOwner = expectedOwner
      ? ethers.getAddress(expectedOwner)
      : undefined;
    const normalizedVaultId = this.normalizeVaultId(vaultId);

    if (this.knownVaultOwners.has(normalizedVaultId)) {
      const configuredOwner = this.knownVaultOwners.get(normalizedVaultId)!;
      evidence.push({
        source: "config.knownVaultOwners",
        success: true,
        details: "Vault ID matched configured owner allowlist",
        owner: configuredOwner,
      });
      owner = configuredOwner;
      valid = true;
    }

    if (this.knownVaultIds.has(normalizedVaultId)) {
      evidence.push({
        source: "config.knownVaultIds",
        success: true,
        details: "Vault ID matched configured allowlist",
      });
      valid = true;
    }

    const registryEvidence = await this.readRegistryOwner(vaultId);
    if (registryEvidence) {
      evidence.push(registryEvidence.evidence);
      if (registryEvidence.evidence.success) {
        owner = registryEvidence.evidence.owner;
        valid = true;
      }
      limitations.push(...registryEvidence.limitations);
    } else {
      limitations.push(
        "No provider/vault registry configured for on-chain vault existence checks"
      );
    }

    if (normalizedExpectedOwner && owner && owner !== normalizedExpectedOwner) {
      evidence.push({
        source: "config.knownVaultOwners",
        success: false,
        details: `Vault owner mismatch: expected ${normalizedExpectedOwner}, got ${owner}`,
        owner,
      });
      valid = false;
    }

    if (!valid && evidence.length === 0) {
      limitations.push(
        "No positive validation evidence found; configure VaultRegistry and/or known vault manifests"
      );
    }

    return {
      vaultId,
      valid,
      owner,
      evidence,
      limitations: dedupe(limitations),
    };
  }

  async validateBindings(
    bindings: ArenaAgentBinding[],
    options: { requireOwnerMatch?: boolean } = {}
  ): Promise<VaultValidationResult[]> {
    return Promise.all(
      bindings.map((binding) =>
        this.validateVault(
          binding.vaultId,
          options.requireOwnerMatch ? binding.agent : undefined
        )
      )
    );
  }

  assertValid(results: VaultValidationResult[]): void {
    const invalid = results.filter((result) => !result.valid);
    if (invalid.length === 0) {
      return;
    }

    const summary = invalid
      .map((result) => `vault ${result.vaultId.toString()}`)
      .join(", ");
    throw new VaultValidationError(
      `Vault validation failed for ${summary}`,
      results
    );
  }

  private async readRegistryOwner(vaultId: bigint): Promise<{
    evidence: VaultValidationEvidence;
    limitations: string[];
  } | null> {
    if (!this.provider || !this.vaultRegistryAddress) {
      return null;
    }

    const limitations: string[] = [];
    const code = await this.provider.getCode(this.vaultRegistryAddress);
    if (code === "0x") {
      limitations.push("Configured VaultRegistry address has no deployed bytecode");
      return {
        evidence: {
          source: "vaultRegistry.ownerOf",
          success: false,
          details: "Configured VaultRegistry address has no deployed bytecode",
        },
        limitations,
      };
    }

    const registry =
      this.vaultRegistryContract ||
      new ethers.Contract(
        this.vaultRegistryAddress,
        VAULT_REGISTRY_ABI,
        this.provider
      );

    try {
      const owner = ethers.getAddress(await registry.ownerOf(vaultId));
      return {
        evidence: {
          source: "vaultRegistry.ownerOf",
          success: true,
          details: "VaultRegistry.ownerOf confirmed the vault exists",
          owner,
        },
        limitations,
      };
    } catch (error) {
      limitations.push(
        "VaultRegistry.ownerOf could not confirm the vault; this repo does not have deeper AEGIS registry ABIs yet"
      );
      return {
        evidence: {
          source: "vaultRegistry.ownerOf",
          success: false,
          details: `VaultRegistry.ownerOf probe failed: ${formatError(error)}`,
        },
        limitations,
      };
    }
  }

  private normalizeVaultId(vaultId: bigint | number | string): string {
    return BigInt(vaultId).toString();
  }
}

function formatError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return String(error);
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}
