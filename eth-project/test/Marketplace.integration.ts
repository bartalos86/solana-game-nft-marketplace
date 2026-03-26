/**
 * NFTMarketplace integration tests with gas reporting.
 * Run: pnpm exec hardhat test test/Marketplace.integration.ts
 */

import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import hardhat from "hardhat";
import { network } from "hardhat";
import { encodeFunctionData } from "viem";
import { currentDeploymentsPath, loadPersistentDeployments, savePersistentDeployments } from "./utils/persistentDeployments.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

type MarketplaceContract = {
  address: string;
  read: {
    listingCounter: () => Promise<bigint>;
    listings: (args: [bigint]) => Promise<[string, string, bigint, bigint, bigint, bigint]>;
    feeRecipient: () => Promise<string>;
    marketplaceFeePercent: () => Promise<bigint>;
  };
  write: {
    listNFT: (args: [string, bigint, bigint, bigint, bigint]) => Promise<Hash>;
    buyNFT: (args: [bigint], opts?: { value?: bigint }) => Promise<Hash>;
    cancelListing: (args: [bigint]) => Promise<Hash>;
  };
};

type GameForMint = {
  address: string;
  read: { balanceOf: (args: [Hash, bigint]) => Promise<bigint> };
  write: {
    mintWithSignature: (args: [Hash, Hash, string, bigint, Hash]) => Promise<Hash>;
    setApprovalForAll: (args: [Hash, boolean]) => Promise<Hash>;
  };
};

type FactoryWithCreateGame = {
  address: string;
  write: { createGame: (args: [GameInput]) => Promise<Hash> };
  read: {
    gameItems: () => Promise<Hash>;
    getGameByAuthority: (args: [Hash]) => Promise<Hash>;
  };
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GAME_NAME = "My Game";
const GAME_DESCRIPTION = "";
const GAME_CATEGORY = "";
const GAME_FEE_BPS = 0;
const EIP712_DOMAIN_NAME = "GameItemNFT";
const LISTING_PRICE = 10_000_000_000_000_000n; // 0.01 ETH (anchor parity value scale)
const LISTING_DURATION = 7n * 24n * 3600n; // 7 days, aligned with anchor tests

function isSepoliaRun(): boolean {
  if ((process.env.HARDHAT_NETWORK ?? "").trim() === "sepolia") {
    return true;
  }
  const networkFlagIndex = process.argv.findIndex((arg) => arg === "--network");
  if (networkFlagIndex >= 0) {
    return process.argv[networkFlagIndex + 1] === "sepolia";
  }
  return process.argv.some((arg) => arg === "--network=sepolia");
}

function shouldReusePersistentDeployments(): boolean {
  const raw = (process.env.REUSE_PERSISTENT_DEPLOYMENTS ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

describe("NFTMarketplace", { concurrency: 1 }, async function () {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const walletClients = await viem.getWalletClients();
  const deployerWallet = walletClients![0]!;
  const seller = deployerWallet.account!.address;
  const buyerWallet = walletClients![1] ?? walletClients![0];
  const buyer = buyerWallet.account!.address;
  const chainId = await publicClient.getChainId();
  const marketplaceAbi = (await hardhat.artifacts.readArtifact("NFTMarketplace")).abi;
  const isSepolia = isSepoliaRun();
  const reusePersistentDeployments = shouldReusePersistentDeployments();
  let marketplace: MarketplaceContract;
  let factory: FactoryWithCreateGame;
  let mintNonceCursor = 0n;

  const reportGas = async (label: string, hash: Hash) => {
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") {
      throw new Error(`Transaction reverted (${label})`);
    }
    console.log(`  [Gas] ${label}: ${receipt.gasUsed.toString()} gas`);
    return receipt;
  };

  const reportGasAndLatency = async (label: string, hash: Hash) => {
    const startedAt = Date.now();
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    const latencyMs = Date.now() - startedAt;
    console.log(`  [Gas] ${label}: ${receipt.gasUsed.toString()} gas`);
    console.log(`  [Latency] ${label}: ${latencyMs}ms`);
    if (receipt.status !== "success") {
      throw new Error(`Transaction reverted (${label})`);
    }
    return receipt;
  };

  const deployWithAccount = async (
    contractName: "NFTMarketplace" | "GameFactory",
    args?: readonly [`0x${string}`],
  ) => {
    const artifact = await hardhat.artifacts.readArtifact(contractName);
    const deployArgs =
      contractName === "NFTMarketplace"
        ? (args ?? [seller as Hash])
        : undefined;
    const hash = await deployerWallet.deployContract({
      abi: artifact.abi,
      bytecode: artifact.bytecode as Hash,
      args: deployArgs,
      account: deployerWallet.account!,
    });
    const receipt = await reportGas(`${contractName} deployment`, hash);
    return receipt.contractAddress!;
  };

  before(async () => {
    if (isSepolia && reusePersistentDeployments) {
      const persisted = await loadPersistentDeployments("sepolia");
      if (persisted?.marketplace && persisted?.gameFactory) {
        marketplace = (await viem.getContractAt("NFTMarketplace", persisted.marketplace)) as unknown as MarketplaceContract;
        factory = (await viem.getContractAt("GameFactory", persisted.gameFactory)) as unknown as FactoryWithCreateGame;
        console.log(`Reusing persisted deployments from ${currentDeploymentsPath()}`);
        return;
      }
    }

    const marketplaceAddress = await deployWithAccount("NFTMarketplace", [seller]);
    const factoryAddress = await deployWithAccount("GameFactory");
    marketplace = (await viem.getContractAt("NFTMarketplace", marketplaceAddress as Hash)) as unknown as MarketplaceContract;
    factory = (await viem.getContractAt("GameFactory", factoryAddress as Hash)) as unknown as FactoryWithCreateGame;

    if (isSepolia && reusePersistentDeployments) {
      await savePersistentDeployments("sepolia", Number(chainId), {
        marketplace: marketplace.address as Hash,
        gameFactory: factory.address as Hash,
      });
      console.log(`Saved deployments to ${currentDeploymentsPath()}`);
    }
  });

  const getBlockTimestamp = async () => {
    const block = await publicClient.getBlock();
    return block.timestamp;
  };

  const sleep = async (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms));

  const waitUntilAfterTimestamp = async (targetTs: bigint, timeoutMs = 120_000) => {
    const started = Date.now();
    while (true) {
      const now = await getBlockTimestamp();
      if (now > targetTs) return;
      if (Date.now() - started > timeoutMs) {
        throw new Error(`Timed out waiting for chain timestamp to pass ${targetTs.toString()}`);
      }
      await sleep(2_000);
    }
  };

  /** Deploy factory, create game, mint one ERC-1155 token id (quantity=1). */
  const setupOneNFT = async () => {
    const input: GameInput = {
      authority: seller as Hash,
      name: GAME_NAME,
      description: GAME_DESCRIPTION,
      imageUri: "",
      uri: "",
      category: GAME_CATEGORY,
      feeRecipient: seller as Hash,
      feePercentBps: GAME_FEE_BPS,
    };
    let gameAddress: Hash | undefined;
    try {
      const existing = await factory.read.getGameByAuthority([seller as Hash]);
      if (existing !== "0x0000000000000000000000000000000000000000") {
        gameAddress = existing;
      }
    } catch {
      // Not registered yet; create below.
    }

    if (!gameAddress) {
      const createHash = await factory.write.createGame([input]);
      await reportGas("createGame (setup)", createHash);
      gameAddress = await factory.read.gameItems();
    }

    const game = await viem.getContractAt("GameItemNFT", gameAddress);

    const domain = {
      name: EIP712_DOMAIN_NAME,
      version: "1",
      chainId,
      verifyingContract: game.address,
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
    const nonce = mintNonceCursor++;
    const signature = await walletClients![0]!.signTypedData({
      account: walletClients![0]!.account!,
      domain,
      types,
      primaryType: "Mint",
      message: {
        gameAuthority: seller,
        to: seller,
        uri: "",
        amount: 1n,
        nonce,
      },
    });
    const mintHash = await game.write.mintWithSignature([
      seller,
      seller,
      "",
      nonce,
      signature as Hash,
    ]);
    await reportGasAndLatency("mintWithSignature (setup)", mintHash);

    return { nftAddress: game.address as string, tokenId: nonce, quantity: 1n, game: game as unknown as GameForMint };
  };

  /** Seller must grant operator approval for ERC-1155 marketplace escrow transfers. */
  const approveForListing = async (
    game: { write: { setApprovalForAll: (args: [Hash, boolean]) => Promise<Hash> } },
    marketplaceAddress: Hash
  ) => {
    const hash = await game.write.setApprovalForAll([marketplaceAddress, true]);
    return reportGasAndLatency("setApprovalForAll (listing)", hash);
  };

  const listNFT = async (
    marketplace: MarketplaceContract,
    nft: string,
    tokenId: bigint,
    quantity: bigint,
    price: bigint,
    expiry: bigint,
    label = "listNFT",
  ) => {
    const hash = await marketplace.write.listNFT([nft, tokenId, quantity, price, expiry]);
    return reportGasAndLatency(label, hash);
  };

  const buyNFT = async (
    marketplace: MarketplaceContract,
    listingId: bigint,
    value: bigint,
    label = "buyNFT",
  ) => {
    const hash = await marketplace.write.buyNFT([listingId], { value });
    return reportGasAndLatency(label, hash);
  };

  const cancelListing = async (
    marketplace: MarketplaceContract,
    listingId: bigint,
    label = "cancelListing",
  ) => {
    const hash = await marketplace.write.cancelListing([listingId]);
    return reportGasAndLatency(label, hash);
  };

  it("deploys marketplace and reports deployment gas", async function () {
    assert.ok(marketplace.address);
    assert.equal(
      (await marketplace.read.feeRecipient()).toLowerCase(),
      seller.toLowerCase(),
    );
    console.log(`  Marketplace at: ${marketplace.address}`);
  });

  it("token creation (setup): reports createGame + mintWithSignature gas/time", async function () {
    const { nftAddress, tokenId, quantity, game } = await setupOneNFT();
    assert.ok(nftAddress);
    assert.equal(quantity, 1n);
    assert.equal(await game.read.balanceOf([seller as Hash, tokenId]), 1n);
  });

  it("approve (setup): reports setApprovalForAll gas/time", async function () {
    const { game } = await setupOneNFT();
    await approveForListing(game, marketplace.address as Hash);
  });

  it("list_nft: reports listNFT gas/time", async function () {
    const { nftAddress, tokenId, quantity, game } = await setupOneNFT();
    await approveForListing(game, marketplace.address as Hash);
    const now = await getBlockTimestamp();
    const expiry = now + LISTING_DURATION;
    const listingId = await marketplace.read.listingCounter();

    await listNFT(marketplace, nftAddress, tokenId, quantity, LISTING_PRICE, expiry);

    const counter = await marketplace.read.listingCounter();
    assert.equal(counter, listingId + 1n);
    const [listingSeller, listingNft, listingTokenId, listingQuantity, price] =
      await marketplace.read.listings([listingId]);
    assert.equal(listingSeller.toLowerCase(), seller.toLowerCase());
    assert.equal(listingNft.toLowerCase(), nftAddress.toLowerCase());
    assert.equal(listingTokenId, tokenId);
    assert.equal(listingQuantity, quantity);
    assert.equal(price, LISTING_PRICE);
  });

  it("buy_nft: reports buyNFT gas/time", async function () {
    const { nftAddress, tokenId, quantity, game } = await setupOneNFT();
    await approveForListing(game, marketplace.address as Hash);
    const now = await getBlockTimestamp();
    const listingId = await marketplace.read.listingCounter();
    await listNFT(marketplace, nftAddress, tokenId, quantity, LISTING_PRICE, now + LISTING_DURATION);

    const buyHash = await buyerWallet.sendTransaction({
      to: marketplace.address as Hash,
      data: encodeFunctionData({
        abi: marketplaceAbi,
        functionName: "buyNFT",
        args: [listingId],
      }),
      value: LISTING_PRICE,
      account: buyerWallet.account!,
    });
    await reportGasAndLatency("buyNFT", buyHash);

    assert.equal(await game.read.balanceOf([buyer as Hash, tokenId]), quantity, "Buyer should receive listed quantity");
    if (buyerWallet !== walletClients![0]) {
      assert.equal(await game.read.balanceOf([seller as Hash, tokenId]), 0n, "Seller should no longer hold listed token");
    }
  });

  it("cancel_listing: reports cancelListing gas/time", async function () {
    const { nftAddress, tokenId, quantity, game } = await setupOneNFT();
    await approveForListing(game, marketplace.address as Hash);
    const now = await getBlockTimestamp();
    const listingId = await marketplace.read.listingCounter();
    await listNFT(marketplace, nftAddress, tokenId, quantity, LISTING_PRICE, now + LISTING_DURATION);

    await cancelListing(marketplace, listingId);

    const [listingSeller] = await marketplace.read.listings([listingId]);
    assert.equal(listingSeller, "0x0000000000000000000000000000000000000000");
    assert.equal(await game.read.balanceOf([seller as Hash, tokenId]), quantity, "Token should return to seller");
  });

  it("reverts when listing with price zero", async function () {
    const { nftAddress, tokenId, quantity } = await setupOneNFT();
    const now = await getBlockTimestamp();
    await assert.rejects(
      () => listNFT(marketplace, nftAddress, tokenId, quantity, 0n, now + LISTING_DURATION),
      /Price must be > 0|revert/,
    );
  });

  it("reverts when listing with past expiry", async function () {
    const { nftAddress, tokenId, quantity } = await setupOneNFT();
    const now = await getBlockTimestamp();
    await assert.rejects(
      () => listNFT(marketplace, nftAddress, tokenId, quantity, LISTING_PRICE, now - 1n),
      /Invalid expiry|revert/,
    );
  });

  it("reverts when buying with wrong ETH amount", async function () {
    const { nftAddress, tokenId, quantity, game } = await setupOneNFT();
    await approveForListing(game, marketplace.address as Hash);
    const now = await getBlockTimestamp();
    const listingId = await marketplace.read.listingCounter();
    await listNFT(marketplace, nftAddress, tokenId, quantity, LISTING_PRICE, now + LISTING_DURATION);

    await assert.rejects(
      () => buyNFT(marketplace, listingId, 0n),
      /Incorrect ETH sent|revert/,
    );
  });

  it("reverts when buying an expired listing", async function () {
    const { nftAddress, tokenId, quantity, game } = await setupOneNFT();
    await approveForListing(game, marketplace.address as Hash);
    const now = await getBlockTimestamp();
    const listingId = await marketplace.read.listingCounter();
    const expiry = now + 20n;
    await listNFT(marketplace, nftAddress, tokenId, quantity, LISTING_PRICE, expiry);

    if (isSepolia) {
      await waitUntilAfterTimestamp(expiry);
    } else {
      await (publicClient as any).request({ method: "evm_increaseTime", params: [30] });
      await (publicClient as any).request({ method: "evm_mine", params: [] });
    }

    await assert.rejects(
      () => buyNFT(marketplace, listingId, LISTING_PRICE),
      /Expired|revert/,
    );
  });

  it("reverts when non-seller cancels listing", async function () {
    if (buyerWallet === walletClients![0]) {
      return; // skip when single wallet
    }
    const { nftAddress, tokenId, quantity, game } = await setupOneNFT();
    await approveForListing(game, marketplace.address as Hash);
    const now = await getBlockTimestamp();
    const listingId = await marketplace.read.listingCounter();
    await listNFT(marketplace, nftAddress, tokenId, quantity, LISTING_PRICE, now + LISTING_DURATION);

    const cancelTx = async () => {
      const hash = await buyerWallet.sendTransaction({
        to: marketplace.address as Hash,
        data: encodeFunctionData({
          abi: marketplaceAbi,
          functionName: "cancelListing",
          args: [listingId],
        }),
        account: buyerWallet.account!,
      });
      await reportGasAndLatency("cancelListing non-seller", hash);
    };
    await assert.rejects(cancelTx, (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      const cause = (err as { cause?: Error })?.cause;
      const causeMsg = cause instanceof Error ? cause.message : cause ? String(cause) : "";
      return /Not seller|revert|reverted/.test(msg) || /Not seller|revert|reverted/.test(causeMsg);
    });
  });

});
