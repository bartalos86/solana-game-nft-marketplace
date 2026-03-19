/**
 * NFTMarketplace integration tests with gas reporting.
 * Run: pnpm exec hardhat test test/Marketplace.integration.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import hardhat from "hardhat";
import { network } from "hardhat";
import { encodeFunctionData } from "viem";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Hash = `0x${string}`;

type ReceiptLog = { address: string; topics: (string | undefined)[] };
type ReceiptWithLogs = { logs: ReceiptLog[] };

type MarketplaceContract = {
  address: string;
  read: {
    listingCounter: () => Promise<bigint>;
    listings: (args: [bigint]) => Promise<[string, string, bigint, bigint, bigint]>;
    feeRecipient: () => Promise<string>;
    marketplaceFeePercent: () => Promise<bigint>;
  };
  write: {
    listNFT: (args: [string, bigint, bigint, bigint]) => Promise<Hash>;
    buyNFT: (args: [bigint], opts?: { value?: bigint }) => Promise<Hash>;
    cancelListing: (args: [bigint]) => Promise<Hash>;
  };
};

type GameForMint = {
  address: string;
  read: { ownerOf: (args: [bigint]) => Promise<Hash> };
  write: {
    mintWithSignature: (args: [Hash, string, bigint, Hash]) => Promise<Hash>;
    approve: (args: [Hash, bigint]) => Promise<Hash>;
  };
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GAME_NAME = "Test Game";
const GAME_SYMBOL = "TG";
const ROYALTY_BPS = 550n;
const LISTING_PRICE = 1_000_000n; // 1e6 wei
const LISTING_DURATION = 86400n; // 1 day in seconds

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function gameAddressFromReceipt(receipt: ReceiptWithLogs, factoryAddress: string): Hash {
  const log = receipt.logs.find((l) => l.address.toLowerCase() === factoryAddress.toLowerCase());
  assert.ok(log?.topics?.[1], "GameCreated event missing");
  return `0x${log!.topics![1]!.slice(-40)}` as Hash;
}

describe("NFTMarketplace", async function () {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const walletClients = await viem.getWalletClients();
  const seller = walletClients![0]!.account!.address;
  const buyerWallet = walletClients![1] ?? walletClients![0];
  const buyer = buyerWallet.account!.address;
  const chainId = await publicClient.getChainId();
  const marketplaceAbi = (await hardhat.artifacts.readArtifact("NFTMarketplace")).abi;

  const reportGas = async (label: string, hash: Hash) => {
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`  [Gas] ${label}: ${receipt.gasUsed.toString()} gas`);
    return receipt;
  };

  const deployMarketplace = async (feeRecipient: Hash) => {
    const marketplace = await viem.deployContract("NFTMarketplace", [feeRecipient]);
    return marketplace as unknown as MarketplaceContract;
  };

  const getBlockTimestamp = async () => {
    const block = await publicClient.getBlock();
    return block.timestamp;
  };

  /** Deploy factory, create game, mint one token. Returns NFT address, tokenId, and game contract. */
  const setupOneNFT = async () => {
    const factory = await viem.deployContract("GameFactory");
    const createHash = await factory.write.createGame([
      GAME_NAME,
      GAME_SYMBOL,
      seller,
      ROYALTY_BPS,
    ]);
    const createReceipt = await reportGas("createGame (setup)", createHash);
    const gameAddress = gameAddressFromReceipt(createReceipt, factory.address);
    const game = await viem.getContractAt("GameItemNFT", gameAddress);

    const domain = {
      name: GAME_NAME,
      version: "1",
      chainId,
      verifyingContract: game.address,
    } as const;
    const types = {
      Mint: [
        { name: "to", type: "address" },
        { name: "uri", type: "string" },
        { name: "nonce", type: "uint256" },
      ],
    } as const;
    const signature = await walletClients![0]!.signTypedData({
      account: walletClients![0]!.account!,
      domain,
      types,
      primaryType: "Mint",
      message: { to: seller, uri: "ipfs://QmListed", nonce: 0n },
    });
    const mintHash = await game.write.mintWithSignature([
      seller,
      "ipfs://QmListed",
      0n,
      signature as Hash,
    ]);
    await reportGas("mintWithSignature (setup)", mintHash);

    return { nftAddress: game.address as string, tokenId: 0n, game };
  };

  /** Seller must approve marketplace before listing. */
  const approveForListing = async (
    game: { write: { approve: (args: [Hash, bigint]) => Promise<Hash> } },
    marketplaceAddress: Hash,
    tokenId: bigint,
  ) => {
    const hash = await game.write.approve([marketplaceAddress, tokenId]);
    return reportGas("approve (listing)", hash);
  };

  const listNFT = async (
    marketplace: MarketplaceContract,
    nft: string,
    tokenId: bigint,
    price: bigint,
    expiry: bigint,
    label = "listNFT",
  ) => {
    const hash = await marketplace.write.listNFT([nft, tokenId, price, expiry]);
    return reportGas(label, hash);
  };

  const buyNFT = async (
    marketplace: MarketplaceContract,
    listingId: bigint,
    value: bigint,
    label = "buyNFT",
  ) => {
    const hash = await marketplace.write.buyNFT([listingId], { value });
    return reportGas(label, hash);
  };

  const cancelListing = async (
    marketplace: MarketplaceContract,
    listingId: bigint,
    label = "cancelListing",
  ) => {
    const hash = await marketplace.write.cancelListing([listingId]);
    return reportGas(label, hash);
  };

  it("deploys marketplace and reports deployment gas", async function () {
    const marketplace = await viem.deployContract("NFTMarketplace", [seller]);
    assert.ok(marketplace.address);
    assert.equal(
      (await (marketplace as unknown as MarketplaceContract).read.feeRecipient()).toLowerCase(),
      seller.toLowerCase(),
    );
    console.log(`  Marketplace at: ${marketplace.address}`);
  });

  it("lists an NFT and reports listNFT gas", async function () {
    const marketplace = await deployMarketplace(seller as Hash);
    const { nftAddress, tokenId, game } = await setupOneNFT();
    await approveForListing(game, marketplace.address as Hash, tokenId);
    const now = await getBlockTimestamp();
    const expiry = now + LISTING_DURATION;

    await listNFT(marketplace, nftAddress, tokenId, LISTING_PRICE, expiry);

    const counter = await marketplace.read.listingCounter();
    assert.equal(counter, 1n);
    const [listingSeller, listingNft, listingTokenId, price] = await marketplace.read.listings([0n]);
    assert.equal(listingSeller.toLowerCase(), seller.toLowerCase());
    assert.equal(listingNft.toLowerCase(), nftAddress.toLowerCase());
    assert.equal(listingTokenId, tokenId);
    assert.equal(price, LISTING_PRICE);
  });

  it("buys a listed NFT and reports buyNFT gas", async function () {
    const marketplace = await deployMarketplace(seller as Hash);
    const { nftAddress, tokenId, game } = await setupOneNFT();
    await approveForListing(game, marketplace.address as Hash, tokenId);
    const now = await getBlockTimestamp();
    await listNFT(marketplace, nftAddress, tokenId, LISTING_PRICE, now + LISTING_DURATION);

    const buyHash = await buyerWallet.sendTransaction({
      to: marketplace.address as Hash,
      data: encodeFunctionData({
        abi: marketplaceAbi,
        functionName: "buyNFT",
        args: [0n],
      }),
      value: LISTING_PRICE,
      account: buyerWallet.account!,
    });
    await reportGas("buyNFT", buyHash);

    assert.equal(
      (await (game as unknown as GameForMint).read.ownerOf([tokenId])).toLowerCase(),
      buyer.toLowerCase(),
      "NFT should be transferred to buyer",
    );
  });

  it("cancels a listing and reports cancelListing gas", async function () {
    const marketplace = await deployMarketplace(seller as Hash);
    const { nftAddress, tokenId, game } = await setupOneNFT();
    await approveForListing(game, marketplace.address as Hash, tokenId);
    const now = await getBlockTimestamp();
    await listNFT(marketplace, nftAddress, tokenId, LISTING_PRICE, now + LISTING_DURATION);

    await cancelListing(marketplace, 0n);

    const [listingSeller] = await marketplace.read.listings([0n]);
    assert.equal(listingSeller, "0x0000000000000000000000000000000000000000");
    assert.equal(
      (await (game as unknown as GameForMint).read.ownerOf([tokenId])).toLowerCase(),
      seller.toLowerCase(),
      "NFT should be returned to seller",
    );
  });

  it("reverts when listing with price zero", async function () {
    const marketplace = await deployMarketplace(seller as Hash);
    const { nftAddress, tokenId } = await setupOneNFT();
    const now = await getBlockTimestamp();
    await assert.rejects(
      () => listNFT(marketplace, nftAddress, tokenId, 0n, now + LISTING_DURATION),
      /Price must be > 0|revert/,
    );
  });

  it("reverts when listing with past expiry", async function () {
    const marketplace = await deployMarketplace(seller as Hash);
    const { nftAddress, tokenId } = await setupOneNFT();
    const now = await getBlockTimestamp();
    await assert.rejects(
      () => listNFT(marketplace, nftAddress, tokenId, LISTING_PRICE, now - 1n),
      /Invalid expiry|revert/,
    );
  });

  it("reverts when buying with wrong ETH amount", async function () {
    const marketplace = await deployMarketplace(seller as Hash);
    const { nftAddress, tokenId, game } = await setupOneNFT();
    await approveForListing(game, marketplace.address as Hash, tokenId);
    const now = await getBlockTimestamp();
    await listNFT(marketplace, nftAddress, tokenId, LISTING_PRICE, now + LISTING_DURATION);

    await assert.rejects(
      () => buyNFT(marketplace, 0n, LISTING_PRICE + 1n),
      /Incorrect ETH sent|revert/,
    );
  });

  it("reverts when non-seller cancels listing", async function () {
    if (buyerWallet === walletClients![0]) {
      return; // skip when single wallet
    }
    const marketplace = await deployMarketplace(seller as Hash);
    const { nftAddress, tokenId, game } = await setupOneNFT();
    await approveForListing(game, marketplace.address as Hash, tokenId);
    const now = await getBlockTimestamp();
    await listNFT(marketplace, nftAddress, tokenId, LISTING_PRICE, now + LISTING_DURATION);

    const cancelTx = () =>
      buyerWallet.sendTransaction({
        to: marketplace.address as Hash,
        data: encodeFunctionData({
          abi: marketplaceAbi,
          functionName: "cancelListing",
          args: [0n],
        }),
        account: buyerWallet.account!,
      });
    await assert.rejects(cancelTx, (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      const cause = (err as { cause?: Error })?.cause;
      const causeMsg = cause instanceof Error ? cause.message : cause ? String(cause) : "";
      return /Not seller|revert|reverted/.test(msg) || /Not seller|revert|reverted/.test(causeMsg);
    });
  });
});
