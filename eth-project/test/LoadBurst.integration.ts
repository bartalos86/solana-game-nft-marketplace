/**
 * ETH load & burst tests for mint/list/buy flows.
 *
 * Run:
 *   pnpm exec hardhat test test/LoadBurst.integration.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import hardhat from "hardhat";
import { network } from "hardhat";
import { decodeEventLog, encodeFunctionData } from "viem";

type Hash = `0x${string}`;

type GameInput = {
  authority: Hash;
  name: string;
  description: string;
  imageUri: string;
  uri: string;
  category: string;
  feeRecipient: Hash;
  feePercentBps: number;
};

type WalletClient = {
  account?: { address: Hash };
  sendTransaction: (args: { to: Hash; data: Hash; value?: bigint; account: { address: Hash } }) => Promise<Hash>;
  signTypedData: (args: unknown) => Promise<string>;
};

type GameContract = {
  address: Hash;
  write: {
    mintWithSignature: (args: [Hash, Hash, string, bigint, Hash]) => Promise<Hash>;
    setApprovalForAll: (args: [Hash, boolean]) => Promise<Hash>;
  };
};

type FactoryContract = {
  write: { createGame: (args: [GameInput]) => Promise<Hash> };
  read: { gameItems: () => Promise<Hash> };
};

type MarketplaceContract = {
  address: Hash;
  write: {
    listNFT: (args: [Hash, bigint, bigint, bigint, bigint]) => Promise<Hash>;
  };
};

type TxMetric = {
  ok: boolean;
  latencyMs: number;
  gasUsed: bigint;
  label: string;
  error?: string;
};

type ScenarioSummary = {
  label: string;
  attempts: number;
  ok: number;
  fail: number;
  latencyP50Ms: number;
  latencyP95Ms: number;
  gasMean: number;
  gasP95: number;
};

const EIP712_DOMAIN_NAME = "GameItemNFT";
const LISTING_PRICE = 1_000_000n;
const LISTING_DURATION_SECONDS = 86400n;
const LOAD_LEVELS = [10, 50, 100, 500];
const BURST_COUNT = 5;
const BURST_SIZE = 75;
const BURST_COOLDOWN_MS = 1200;
const RESULTS_DIR = path.resolve(process.cwd(), "benchmark-results");

function nowMs(): number {
  return Date.now();
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx] ?? 0;
}

function summarize(label: string, rows: TxMetric[]): ScenarioSummary {
  const ok = rows.filter((r) => r.ok);
  const fail = rows.length - ok.length;
  const latencies = ok.map((r) => r.latencyMs).sort((a, b) => a - b);
  const gas = ok.map((r) => Number(r.gasUsed)).sort((a, b) => a - b);
  const mean = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
  const summary: ScenarioSummary = {
    label,
    attempts: rows.length,
    ok: ok.length,
    fail,
    latencyP50Ms: percentile(latencies, 50),
    latencyP95Ms: percentile(latencies, 95),
    gasMean: mean(gas),
    gasP95: percentile(gas, 95),
  };
  console.log(
    `[${label}] attempts=${rows.length} ok=${ok.length} fail=${fail} p50=${summary.latencyP50Ms.toFixed(
      2,
    )}ms p95=${summary.latencyP95Ms.toFixed(2)}ms gasMean=${summary.gasMean.toFixed(0)} gasP95=${summary.gasP95.toFixed(0)}`,
  );
  return summary;
}

function toJsonSafeRows(rows: TxMetric[]) {
  return rows.map((r) => ({
    ...r,
    gasUsed: r.gasUsed.toString(),
  }));
}

async function writeJsonReport(filename: string, payload: unknown) {
  await mkdir(RESULTS_DIR, { recursive: true });
  const outPath = path.join(RESULTS_DIR, filename);
  await writeFile(outPath, JSON.stringify(payload, null, 2), "utf8");
  console.log(`[JSON] wrote ${outPath}`);
}

describe("ETH load & burst tests", async function () {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const walletClients = (await viem.getWalletClients()) as unknown as WalletClient[];
  const deployer = walletClients[0]?.account?.address as Hash;
  const chainId = await publicClient.getChainId();
  const marketplaceAbi = (await hardhat.artifacts.readArtifact("NFTMarketplace")).abi;

  assert.ok(walletClients.length > 0, "No wallet clients found");
  const runId = new Date().toISOString().replaceAll(":", "-");
  const runSummaries: ScenarioSummary[] = [];

  // Per-wallet serialization prevents nonce races while still allowing parallelism across wallets.
  const walletQueues = new Map<Hash, Promise<void>>();
  const runOnWallet = async <T>(wallet: WalletClient, fn: () => Promise<T>): Promise<T> => {
    const address = wallet.account?.address as Hash;
    const prev = walletQueues.get(address) ?? Promise.resolve();
    let resolveCurrent!: () => void;
    const current = new Promise<void>((resolve) => {
      resolveCurrent = resolve;
    });
    walletQueues.set(address, prev.then(() => current));
    try {
      await prev;
      return await fn();
    } finally {
      resolveCurrent();
    }
  };

  const txMetric = async (label: string, send: () => Promise<Hash>): Promise<TxMetric> => {
    const start = nowMs();
    try {
      const hash = await send();
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      return {
        ok: true,
        latencyMs: nowMs() - start,
        gasUsed: receipt.gasUsed,
        label,
      };
    } catch (e: unknown) {
      return {
        ok: false,
        latencyMs: nowMs() - start,
        gasUsed: 0n,
        label,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  };

  const txMetricWithReceipt = async (
    label: string,
    send: () => Promise<Hash>,
  ): Promise<
    | { ok: true; metric: TxMetric; receipt: Awaited<ReturnType<typeof publicClient.waitForTransactionReceipt>> }
    | { ok: false; metric: TxMetric; receipt: null }
  > => {
    const start = nowMs();
    try {
      const hash = await send();
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      return {
        ok: true,
        receipt,
        metric: {
          ok: true,
          latencyMs: nowMs() - start,
          gasUsed: receipt.gasUsed,
          label,
        },
      };
    } catch (e: unknown) {
      return {
        ok: false,
        receipt: null,
        metric: {
          ok: false,
          latencyMs: nowMs() - start,
          gasUsed: 0n,
          label,
          error: e instanceof Error ? e.message : String(e),
        },
      };
    }
  };

  const extractListingId = (
    receipt: Awaited<ReturnType<typeof publicClient.waitForTransactionReceipt>>,
  ): bigint | null => {
    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi: marketplaceAbi,
          data: log.data,
          topics: log.topics,
        });
        if (decoded.eventName === "Listed") {
          return decoded.args.listingId as bigint;
        }
      } catch {
        // Ignore logs from other events/contracts.
      }
    }
    return null;
  };

  const deployFlow = async () => {
    const marketplace = (await viem.deployContract("NFTMarketplace", [deployer])) as unknown as MarketplaceContract;
    const factory = (await viem.deployContract("GameFactory")) as unknown as FactoryContract;

    const input: GameInput = {
      authority: deployer,
      name: "Load Test Game",
      description: "stress",
      imageUri: "",
      uri: "",
      category: "Load",
      feeRecipient: deployer,
      feePercentBps: 300,
    };
    await factory.write.createGame([input]);
    const gameAddress = await factory.read.gameItems();
    const game = (await viem.getContractAt("GameItemNFT", gameAddress)) as unknown as GameContract;
    return { marketplace, game, gameAddress };
  };

  const signMint = async (
    wallet: WalletClient,
    gameAddress: Hash,
    gameAuthority: Hash,
    to: Hash,
    uri: string,
    nonce: bigint,
  ) => {
    const domain = {
      name: EIP712_DOMAIN_NAME,
      version: "1",
      chainId,
      verifyingContract: gameAddress,
    } as const;
    const types = {
      Mint: [
        { name: "gameAuthority", type: "address" },
        { name: "to", type: "address" },
        { name: "uri", type: "string" },
        { name: "amount", type: "uint256" },
        { name: "nonce", type: "uint256" },
      ],
    } as const;
    return wallet.signTypedData({
      account: wallet.account,
      domain,
      types,
      primaryType: "Mint",
      message: { gameAuthority, to, uri, amount: 1n, nonce },
    });
  };

  const runParallelLevel = async (clients: number) => {
    const { marketplace, game, gameAddress } = await deployFlow();
    const sellerWallet = walletClients[0]!;
    await game.write.setApprovalForAll([marketplace.address, true]);

    const startBlock = await publicClient.getBlock();
    const baseExpiry = startBlock.timestamp + LISTING_DURATION_SECONDS;

    const minted: TxMetric[] = await Promise.all(
      Array.from({ length: clients }, (_, i) => {
        const wallet = walletClients[i % walletClients.length]!;
        const nonce = BigInt(i);
        const uri = `ipfs://load/${clients}/${i}`;
        return txMetric(`mint-${i}`, async () => {
          const sig = await signMint(sellerWallet, gameAddress, deployer, deployer, uri, nonce);
          return runOnWallet(sellerWallet, () =>
            game.write.mintWithSignature([deployer, deployer, uri, nonce, sig as Hash]),
          );
        });
      }),
    );
    runSummaries.push(summarize(`mint_parallel_${clients}`, minted));

    const listedResults = await Promise.all(
      Array.from({ length: clients }, (_, i) =>
        txMetricWithReceipt(`list-${i}`, () =>
          runOnWallet(sellerWallet, () =>
            marketplace.write.listNFT([gameAddress, BigInt(i), 1n, LISTING_PRICE, baseExpiry + BigInt(i + 1)]),
          ),
        ),
      ),
    );
    const listed: TxMetric[] = listedResults.map((result) => result.metric);
    const listingIds = listedResults.map((result) => {
      if (!result.ok || !result.receipt) return null;
      return extractListingId(result.receipt);
    });
    runSummaries.push(summarize(`list_parallel_${clients}`, listed));

    const bought: TxMetric[] = await Promise.all(
      Array.from({ length: clients }, (_, i) => {
        const buyerWallet = walletClients[(i % (walletClients.length - 1)) + 1] ?? walletClients[0]!;
        const listingId = listingIds[i];
        if (listingId === null) {
          return Promise.resolve({
            ok: false,
            latencyMs: 0,
            gasUsed: 0n,
            label: `buy-${i}`,
            error: "Missing listingId from list transaction receipt",
          } satisfies TxMetric);
        }
        return txMetric(`buy-${i}`, () =>
          runOnWallet(buyerWallet, () =>
            buyerWallet.sendTransaction({
              to: marketplace.address,
              data: encodeFunctionData({
                abi: marketplaceAbi,
                functionName: "buyNFT",
                  args: [listingId],
              }) as Hash,
              value: LISTING_PRICE,
              account: buyerWallet.account!,
            }),
          ),
        );
      }),
    );
    runSummaries.push(summarize(`buy_parallel_${clients}`, bought));

    await writeJsonReport(`eth-parallel-${clients}-${runId}.json`, {
      chain: "ethereum",
      scenario: "parallel",
      clients,
      runId,
      summaries: runSummaries.slice(-3),
      rows: {
        minted: toJsonSafeRows(minted),
        listed: toJsonSafeRows(listed),
        bought: toJsonSafeRows(bought),
      },
    });

    return { minted, listed, bought };
  };

  it("parallel load: 10/50/100/500 virtual clients", async function () {
    for (const clients of LOAD_LEVELS) {
      const { minted, listed, bought } = await runParallelLevel(clients);
      assert.equal(minted.length, clients);
      assert.equal(listed.length, clients);
      assert.equal(bought.length, clients);
    }
  });

  it("burst load: short high-pressure spikes", async function () {
    const { marketplace, game, gameAddress } = await deployFlow();
    const sellerWallet = walletClients[0]!;
    await game.write.setApprovalForAll([marketplace.address, true]);

    let nonceCursor = 0;
    let listingCursor = 0;
    const burstRows: TxMetric[] = [];

    for (let b = 0; b < BURST_COUNT; b++) {
      const blk = await publicClient.getBlock();
      const expiryBase = blk.timestamp + LISTING_DURATION_SECONDS + BigInt(b * 1000);
      const rowsPerBurst = await Promise.all(
        Array.from({ length: BURST_SIZE }, (_, i) => {
          const nonce = BigInt(nonceCursor++);
          const tokenId = BigInt(listingCursor++);
          return (async () => {
            const mintRow = await txMetric(`mint_step_flow_b${b}_i${i}_s0`, async () => {
              const uri = `ipfs://burst/${b}/${i}`;
              const sig = await signMint(sellerWallet, gameAddress, deployer, deployer, uri, nonce);
              return runOnWallet(sellerWallet, () =>
                game.write.mintWithSignature([deployer, deployer, uri, nonce, sig as Hash]),
              );
            });
            const listResult = await txMetricWithReceipt(`list_nft_b${b}_i${i}_s1`, async () =>
              runOnWallet(sellerWallet, () =>
                marketplace.write.listNFT([gameAddress, tokenId, 1n, LISTING_PRICE, expiryBase + BigInt(i + 1)]),
              ),
            );
            const listRow = listResult.metric;
            const listingId = listResult.ok && listResult.receipt ? extractListingId(listResult.receipt) : null;
            if (listingId === null) {
              const buySkipped: TxMetric = {
                ok: false,
                latencyMs: 0,
                gasUsed: 0n,
                label: `buy_nft_b${b}_i${i}_s2`,
                error: "Missing listingId from list transaction receipt",
              };
              return [mintRow, listRow, buySkipped];
            }
            const buyRow = await txMetric(`buy_nft_b${b}_i${i}_s2`, async () => {
              const buyerWallet = walletClients[((b * BURST_SIZE + i) % (walletClients.length - 1)) + 1] ?? walletClients[0]!;
              return runOnWallet(buyerWallet, () =>
                buyerWallet.sendTransaction({
                  to: marketplace.address,
                  data: encodeFunctionData({
                    abi: marketplaceAbi,
                    functionName: "buyNFT",
                    args: [listingId],
                  }) as Hash,
                  value: LISTING_PRICE,
                  account: buyerWallet.account!,
                }),
              );
            });
            return [mintRow, listRow, buyRow];
          })();
        }),
      );
      const rows = rowsPerBurst.flat();
      runSummaries.push(summarize(`eth_burst_${b}`, rows));
      burstRows.push(...rows);
      await new Promise((r) => setTimeout(r, BURST_COOLDOWN_MS));
    }

    runSummaries.push(summarize("eth_burst_total", burstRows));
    await writeJsonReport(`eth-burst-${runId}.json`, {
      chain: "ethereum",
      scenario: "burst",
      runId,
      config: { BURST_COUNT, BURST_SIZE, BURST_COOLDOWN_MS },
      summaries: runSummaries.filter((s) => s.label.startsWith("eth_burst_")),
      rows: toJsonSafeRows(burstRows),
    });
    assert.equal(burstRows.length, BURST_COUNT * BURST_SIZE * 3);
  });

  it("burst load: minting spikes", async function () {
    const { game, gameAddress } = await deployFlow();
    const sellerWallet = walletClients[0]!;
    let nonceCursor = 0;
    const rows: TxMetric[] = [];

    for (let b = 0; b < BURST_COUNT; b++) {
      const burstRows = await Promise.all(
        Array.from({ length: BURST_SIZE }, (_, i) => {
          const nonce = BigInt(nonceCursor++);
          return txMetric(`mint_step_flow_b${b}_i${i}`, async () => {
            const uri = `ipfs://mint-burst/${b}/${i}`;
            const sig = await signMint(sellerWallet, gameAddress, deployer, deployer, uri, nonce);
            return runOnWallet(sellerWallet, () =>
              game.write.mintWithSignature([deployer, deployer, uri, nonce, sig as Hash]),
            );
          });
        }),
      );
      runSummaries.push(summarize(`eth_mint_burst_${b}`, burstRows));
      rows.push(...burstRows);
      await new Promise((r) => setTimeout(r, BURST_COOLDOWN_MS));
    }

    runSummaries.push(summarize("eth_mint_burst_total", rows));
    await writeJsonReport(`eth-mint-burst-${runId}.json`, {
      chain: "ethereum",
      scenario: "mint_burst",
      runId,
      config: { BURST_COUNT, BURST_SIZE, BURST_COOLDOWN_MS },
      summaries: runSummaries.filter((s) => s.label.startsWith("eth_mint_burst_")),
      rows: toJsonSafeRows(rows),
    });
    assert.equal(rows.length, BURST_COUNT * BURST_SIZE);
  });
});
