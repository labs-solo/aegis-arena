import { ethers } from "ethers";
import {
  ArenaClient,
  AegisVaultValidator,
  CHAIN_CONFIG,
  KNOWN_ADDRESSES,
} from "../../sdk/index";

export interface ArenaServiceConfig {
  arenaAddress: string;
  provider: ethers.Provider;
  signer?: ethers.Signer;
  vaultRegistryAddress?: string;
  knownVaultIds?: Array<string | number | bigint>;
  knownVaultOwners?: Record<string, string>;
}

export function parseOptionalJson<T>(value: string | undefined, fallback: T): T {
  if (!value) {
    return fallback;
  }

  return JSON.parse(value) as T;
}

export function createArenaServiceConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  options: { requireSigner?: boolean } = {}
): ArenaServiceConfig {
  const arenaAddress = env.ARENA_ADDRESS;
  if (!arenaAddress) {
    throw new Error("ARENA_ADDRESS is required");
  }

  const rpcUrl = env.X_LAYER_RPC_URL || env.RPC_URL || CHAIN_CONFIG.rpc;
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const privateKey = env.ORCHESTRATOR_PRIVATE_KEY;

  if (options.requireSigner && !privateKey) {
    throw new Error(
      "ORCHESTRATOR_PRIVATE_KEY is required for Arena registration writes"
    );
  }

  return {
    arenaAddress,
    provider,
    signer: privateKey ? new ethers.Wallet(privateKey, provider) : undefined,
    vaultRegistryAddress:
      env.AEGIS_VAULT_REGISTRY_ADDRESS || KNOWN_ADDRESSES.VAULT_REGISTRY,
    knownVaultIds: parseOptionalJson<Array<string | number | bigint>>(
      env.ARENA_KNOWN_VAULT_IDS,
      []
    ),
    knownVaultOwners: parseOptionalJson<Record<string, string>>(
      env.ARENA_KNOWN_VAULT_OWNERS,
      {}
    ),
  };
}

export function createArenaClientFromConfig(config: ArenaServiceConfig): ArenaClient {
  const vaultValidator = new AegisVaultValidator({
    provider: config.provider,
    vaultRegistryAddress: config.vaultRegistryAddress,
    knownVaultIds: config.knownVaultIds,
    knownVaultOwners: config.knownVaultOwners,
  });

  return new ArenaClient({
    provider: config.provider,
    signer: config.signer,
    arenaAddress: config.arenaAddress,
    vaultValidator,
  });
}
