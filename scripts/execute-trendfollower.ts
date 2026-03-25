#!/usr/bin/env node
/**
 * CP-022 TrendFollower On-Chain Execution Script
 * 
 * Executes TrendFollower's tap open position through Arena.executeBatch()
 * 
 * Prerequisites:
 * - Arena deployed at 0x77189D65156fC82C422F73Ed3c63F4e5F2c00bBA (X Layer)
 * - TrendFollower registered at 0x7287Ce9c02BeE9615fFBF3A690cd9179E6287bC1
 * - Round 1 vault: 4
 * - Deployer key available: security find-generic-password -s "aegis-arena-deployer" -a "talos" -w
 * 
 * Execution Plan:
 * 1. Fetch OKX DEX quote (USDT → OKB on X Layer, chain 196)
 * 2. Build tap open position via buildTapOpenPosition()
 * 3. Call Arena.executeBatch(roundId=1, agent=TrendFollower, actions[])
 * 4. Capture transaction hash and on-chain execution snapshots
 */

import { ethers } from "ethers";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

// Configuration
const CHAIN_ID = 196; // X Layer
const RPC_ENDPOINT = "https://rpc.xlayer.tech";
const ARENA_ADDRESS = "0x77189D65156fC82C422F73Ed3c63F4e5F2c00bBA";
const TRENDFOLLOWER_ADDRESS = "0x7287Ce9c02BeE9615fFBF3A690cd9179E6287bC1";
const ROUND_ID = 1;
const VAULT_ID = 4n; // Registered vault for TrendFollower in round 1

// Token addresses on X Layer
const USDT_ADDRESS = "0x201eba5cc46d1bd78ef49467ab4c8f599ce07613"; // USD₮0
const OKB_ADDRESS = "0x6fd7d4aee3dcd814d44cd60ca9157baf39da8973";  // WOKB

// Minimal Arena ABI (for executeBatch)
const ARENA_ABI = [
  "function executeBatch(uint256 roundId, address agent, bytes[] actions) external payable returns (bytes32)",
  "function getAgentVault(uint256 roundId, address agent) view returns (uint256)",
  "function getAgentExecutionState(uint256 roundId, address agent) view returns (uint256 vaultId, uint256 executionCount, uint256 actionCount, uint256 cumulativeVolumeUsdc, uint256 latestAvgPriceX96, uint256 lastExecutionBlock, address lastSurface, bytes32 lastBatchHash, bool lastProofEligible)",
];

async function getDeployerKey(): Promise<string> {
  try {
    const key = execSync(
      'security find-generic-password -s "aegis-arena-deployer" -a "talos" -w',
      { encoding: "utf-8" }
    ).trim();
    if (!key) {
      throw new Error("Deployer key is empty");
    }
    return key;
  } catch (error) {
    throw new Error(`Failed to fetch deployer key: ${error}`);
  }
}

async function fetchOKXQuote(
  fromToken: string,
  toToken: string,
  amount: string
): Promise<any> {
  console.log(`\n[Quote] Fetching OKX DEX quote...`);
  console.log(`  From: ${fromToken} (USDT)`);
  console.log(`  To: ${toToken} (OKB)`);
  console.log(`  Amount: ${amount}`);
  console.log(`  Chain: 196 (X Layer)`);

  // NOTE: In production, this would make a real HTTP request to OKX DEX API.
  // Due to API auth requirements, we document the request structure instead.
  
  const mockQuote = {
    code: "0",
    msg: "success",
    data: {
      chainId: "196",
      fromToken: {
        chainId: "196",
        address: fromToken,
        symbol: "USDT",
        name: "Tether USD",
        decimals: 6,
        logoUrl: "",
        level: 1,
        priceUsd: "1",
      },
      toToken: {
        chainId: "196",
        address: toToken,
        symbol: "OKB",
        name: "OKB",
        decimals: 18,
        logoUrl: "",
        level: 1,
        priceUsd: "0.95",
      },
      inAmount: amount,
      outAmount: "9500000000000000000", // 9.5 OKB (2.5% price impact assumed)
      quoteCompareRes: [],
      routerResult: {
        swapActionStructs: [
          {
            protocol: "okx-swap",
            tokenIn: fromToken,
            tokenOut: toToken,
            tokenInAmount: amount,
            tokenOutAmount: "9500000000000000000",
            details: {
              swapRouter: "0x6352a56caadc4f1e25cd6c75970fa768a3335652",
              swapData: "0x...", // Actual swap data would come from OKX
              tokenApproveTarget: "0x6352a56caadc4f1e25cd6c75970fa768a3335652",
            },
          },
        ],
      },
      gasUsd: "0.5",
      priceImpactPercentage: "2.5",
      slippage: "1",
    },
  };

  console.log(`[Quote] Mock quote acquired (production would fetch from OKX API)`);
  console.log(`  Output: ${mockQuote.data.outAmount} OKB`);
  console.log(`  Price impact: ${mockQuote.data.priceImpactPercentage}%`);

  return mockQuote;
}

async function buildOpenPositionActions(): Promise<any[]> {
  console.log(`\n[Builder] Building tap open position actions...`);

  // For this execution, we create mock actions (simplified).
  // In production, buildTapOpenPosition() would return real Action[] objects.
  
  const mockActions = [
    {
      opcode: 0x84, // AE_UNLOCK_VAULT
      params: [
        {
          type: "bytes32",
          value: "0x" + Buffer.alloc(32, 4).toString("hex"), // vault ID as bytes32
        },
      ],
    },
    {
      opcode: 0x06, // SWAP_EXACT_IN_SINGLE (mock)
      params: [
        { type: "bytes32", value: "0x" + Buffer.alloc(32, 1).toString("hex") }, // poolId
        { type: "address", value: USDT_ADDRESS },
        { type: "address", value: OKB_ADDRESS },
        { type: "uint256", value: "10000000000000000000" }, // 10 USDT
        { type: "uint256", value: "9500000000000000000" }, // 9.5 OKB min out
      ],
    },
    {
      opcode: 0x85, // AE_LOCK_VAULT
      params: [
        {
          type: "bytes32",
          value: "0x" + Buffer.alloc(32, 4).toString("hex"),
        },
      ],
    },
  ];

  console.log(`[Builder] Composed ${mockActions.length} actions`);
  return mockActions;
}

async function executeOnChain(
  provider: ethers.Provider,
  signer: ethers.Signer,
  actions: any[]
): Promise<{ txHash: string; success: boolean; error?: string }> {
  console.log(`\n[Execution] Preparing Arena.executeBatch call...`);

  try {
    const arenaContract = new ethers.Contract(
      ARENA_ADDRESS,
      ARENA_ABI,
      signer
    );

    // In production, actions would be fully encoded bytes.
    // For this test, we'll attempt with simplified encoding.
    const encodedActions = actions.map((action) => {
      // Simplified encoding: opcode + abi-encoded params
      // Production would use proper encodeAction() from router.ts
      return `0x${action.opcode.toString(16).padStart(2, "0")}`;
    });

    console.log(`[Execution] Calling Arena.executeBatch...`);
    console.log(`  roundId: ${ROUND_ID}`);
    console.log(`  agent: ${TRENDFOLLOWER_ADDRESS}`);
    console.log(`  actions count: ${encodedActions.length}`);

    const tx = await arenaContract.executeBatch(
      ROUND_ID,
      TRENDFOLLOWER_ADDRESS,
      encodedActions
    );

    console.log(`[Execution] Transaction submitted!`);
    console.log(`  TX Hash: ${tx.hash}`);

    const receipt = await tx.wait(1);
    if (!receipt) {
      return {
        txHash: tx.hash,
        success: false,
        error: "Transaction not mined (timeout or reverted)",
      };
    }

    console.log(`[Execution] Transaction mined!`);
    console.log(`  Block: ${receipt.blockNumber}`);
    console.log(`  Gas used: ${receipt.gasUsed}`);

    return {
      txHash: tx.hash,
      success: true,
    };
  } catch (error) {
    const errorMsg =
      error instanceof Error ? error.message : String(error);
    console.error(`[Execution] ERROR: ${errorMsg}`);
    return {
      txHash: "FAILED",
      success: false,
      error: errorMsg,
    };
  }
}

async function captureSnapshot(
  provider: ethers.Provider
): Promise<any> {
  console.log(`\n[Snapshot] Capturing Arena execution state...`);

  try {
    const arenaContract = new ethers.Contract(
      ARENA_ADDRESS,
      ARENA_ABI,
      provider
    );

    const vaultId = await arenaContract.getAgentVault(ROUND_ID, TRENDFOLLOWER_ADDRESS);
    console.log(`  Vault ID: ${vaultId}`);

    const executionState = await arenaContract.getAgentExecutionState(
      ROUND_ID,
      TRENDFOLLOWER_ADDRESS
    );

    console.log(`  Execution state:`);
    console.log(`    executionCount: ${executionState.executionCount}`);
    console.log(`    actionCount: ${executionState.actionCount}`);
    console.log(`    cumulativeVolumeUsdc: ${executionState.cumulativeVolumeUsdc}`);

    return {
      vaultId: vaultId.toString(),
      executionState: {
        executionCount: executionState.executionCount.toString(),
        actionCount: executionState.actionCount.toString(),
        cumulativeVolumeUsdc: executionState.cumulativeVolumeUsdc.toString(),
        latestAvgPriceX96: executionState.latestAvgPriceX96.toString(),
        lastExecutionBlock: executionState.lastExecutionBlock.toString(),
      },
    };
  } catch (error) {
    console.warn(`[Snapshot] Could not capture state: ${error}`);
    return null;
  }
}

async function main() {
  console.log("=====================================");
  console.log("CP-022 TrendFollower On-Chain Execution");
  console.log("=====================================");

  try {
    // Step 1: Get deployer key
    console.log("\n[Setup] Retrieving deployer key...");
    const deployerKey = await getDeployerKey();
    console.log(`  ✓ Key retrieved (${deployerKey.substring(0, 10)}...)`);

    // Step 2: Set up provider and signer
    console.log("\n[Setup] Connecting to X Layer (chain 196)...");
    const provider = new ethers.JsonRpcProvider(RPC_ENDPOINT);
    const signer = new ethers.Wallet(deployerKey, provider);
    console.log(`  ✓ Connected`);
    console.log(`  Signer: ${signer.address}`);

    // Step 3: Fetch OKX DEX quote
    const quote = await fetchOKXQuote(USDT_ADDRESS, OKB_ADDRESS, "10000000000000000000");

    // Step 4: Build actions
    const actions = await buildOpenPositionActions();

    // Step 5: Execute on-chain
    const result = await executeOnChain(provider, signer, actions);

    // Step 6: Capture snapshot
    let snapshot = null;
    if (result.success) {
      snapshot = await captureSnapshot(provider);
    }

    // Step 7: Report results
    console.log("\n=====================================");
    console.log("Execution Summary");
    console.log("=====================================");
    console.log(`Status: ${result.success ? "✓ SUCCESS" : "✗ FAILED"}`);
    console.log(`TX Hash: ${result.txHash}`);
    if (result.error) {
      console.log(`Error: ${result.error}`);
    }
    if (snapshot) {
      console.log(`Vault ID: ${snapshot.vaultId}`);
      console.log(`Actions executed: ${snapshot.executionState.actionCount}`);
    }

    process.exit(result.success ? 0 : 1);
  } catch (error) {
    console.error("\n[FATAL]", error);
    process.exit(1);
  }
}

main();
