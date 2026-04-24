/**
 * Marketplace combo benchmark (Ethereum):
 *   - 1 list + 1 buy
 *   - 1 list + 1 cancel
 *
 * Reports gas used and transaction cost (wei / ETH) per tx and per combo.
 */

import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import hardhat from "hardhat";
import { network } from "hardhat";
import { encodeFunctionData, formatEther } from "viem";

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

type TxCost = {
  gasUsed: bigint;
  effectiveGasPriceWei: bigint;
  txCostWei: bigint;
};

type MarketplaceContract = {
  address: string;
  read: {
    listingCounter: () => Promise<bigint>;
    listings: (args: [bigint]) => Promise<[string, string, bigint, bigint, bigint, bigint]>;
  };
  write: {
    listNFT: (args: [string, bigint, bigint, bigint, bigint]) => Promise<Hash>;
    cancelListing: (args: [bigint]) => Promise<Hash>;
  };
};

type FactoryWithCreateGame = {
  read: {
    gameItems: () => Promise<Hash>;
    getGameByAuthority: (args: [Hash]) => Promise<Hash>;
  };
  write: { createGame: (args: [GameInput]) => Promise<Hash> };
};

const GAME_NAME = "My Game";
const EIP712_DOMAIN_NAME = "GameItemNFT";
const LISTING_PRICE = 10_000_000_000_000_000n; // 0.01 ETH
const LISTING_DURATION = 7n * 24n * 3600n;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

describe("NFTMarketplace refund cost combos (Ethereum)", { concurrency: 1 }, async function () {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const walletClients = await viem.getWalletClients();
  const sellerWallet = walletClients![0]!;
  const buyerWallet = walletClients![1] ?? walletClients![0]!;
  const seller = sellerWallet.account!.address;
  const buyer = buyerWallet.account!.address;
  const chainId = await publicClient.getChainId();
  const marketplaceAbi = (await hardhat.artifacts.readArtifact("NFTMarketplace")).abi;
  let mintNonceCursor = 0n;
  let marketplace: MarketplaceContract;
  let factory: FactoryWithCreateGame;

  const waitAndMeasureTxCost = async (label: string, hash: Hash): Promise<TxCost> => {
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") {
      throw new Error(`Transaction reverted (${label})`);
    }
    const gasUsed = receipt.gasUsed;
    const effectiveGasPriceWei = receipt.effectiveGasPrice;
    const txCostWei = gasUsed * effectiveGasPriceWei;
    console.log(
      `[ETH] ${label}: gas=${gasUsed.toString()} | gas_price=${effectiveGasPriceWei.toString()} wei | tx_cost=${txCostWei.toString()} wei (${formatEther(txCostWei)} ETH)`,
    );
    return { gasUsed, effectiveGasPriceWei, txCostWei };
  };

  const logComboCost = (label: string, txCosts: TxCost[]) => {
    const totalGas = txCosts.reduce((sum, c) => sum + c.gasUsed, 0n);
    const totalWei = txCosts.reduce((sum, c) => sum + c.txCostWei, 0n);
    console.log(
      `[ETH][COMBO] ${label}: total_gas=${totalGas.toString()} | total_tx_cost=${totalWei.toString()} wei (${formatEther(totalWei)} ETH)`,
    );
  };

  const deployWithAccount = async (contractName: "NFTMarketplace" | "GameFactory", args?: readonly [`0x${string}`]) => {
    const artifact = await hardhat.artifacts.readArtifact(contractName);
    const hash = await sellerWallet.deployContract({
      abi: artifact.abi,
      bytecode: artifact.bytecode as Hash,
      args: contractName === "NFTMarketplace" ? (args ?? [seller as Hash]) : undefined,
      account: sellerWallet.account!,
    });
    await waitAndMeasureTxCost(`${contractName} deployment`, hash);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    return receipt.contractAddress!;
  };

  const getBlockTimestamp = async () => (await publicClient.getBlock()).timestamp;

  const setupOneNFT = async () => {
    const input: GameInput = {
      authority: seller as Hash,
      name: GAME_NAME,
      description: "",
      imageUri: "",
      uri: "",
      category: "",
      feeRecipient: seller as Hash,
      feePercentBps: 0,
    };

    let gameAddress: Hash | undefined;
    try {
      const existing = await factory.read.getGameByAuthority([seller as Hash]);
      if (existing !== ZERO_ADDRESS) {
        gameAddress = existing;
      }
    } catch {
      // Missing game for seller; will create one below.
    }

    if (!gameAddress) {
      const createGameHash = await factory.write.createGame([input]);
      await waitAndMeasureTxCost("createGame (setup)", createGameHash);
      gameAddress = await factory.read.gameItems();
    }

    const game = await viem.getContractAt("GameItemNFT", gameAddress);
    const nonce = mintNonceCursor++;

    const signature = await sellerWallet.signTypedData({
      account: sellerWallet.account!,
      domain: {
        name: EIP712_DOMAIN_NAME,
        version: "1",
        chainId,
        verifyingContract: game.address,
      },
      types: {
        Mint: [
          { name: "gameAuthority", type: "address" },
          { name: "to", type: "address" },
          { name: "uri", type: "string" },
          { name: "amount", type: "uint256" },
          { name: "nonce", type: "uint256" },
        ],
      },
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
    await waitAndMeasureTxCost("mintWithSignature (setup)", mintHash);

    const approveHash = await game.write.setApprovalForAll([marketplace.address as Hash, true]);
    await waitAndMeasureTxCost("setApprovalForAll (setup)", approveHash);

    return { gameAddress: game.address as string, tokenId: nonce, quantity: 1n, game };
  };

  before(async () => {
    const marketplaceAddress = await deployWithAccount("NFTMarketplace", [seller]);
    const factoryAddress = await deployWithAccount("GameFactory");
    marketplace = (await viem.getContractAt("NFTMarketplace", marketplaceAddress as Hash)) as unknown as MarketplaceContract;
    factory = (await viem.getContractAt("GameFactory", factoryAddress as Hash)) as unknown as FactoryWithCreateGame;
  });

  it("measures combo cost: 1 list + 1 buy", async function () {
    const { gameAddress, tokenId, quantity, game } = await setupOneNFT();
    const now = await getBlockTimestamp();
    const listingId = await marketplace.read.listingCounter();

    const listHash = await marketplace.write.listNFT([
      gameAddress,
      tokenId,
      quantity,
      LISTING_PRICE,
      now + LISTING_DURATION,
    ]);
    const listCost = await waitAndMeasureTxCost("listNFT", listHash);

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
    const buyCost = await waitAndMeasureTxCost("buyNFT", buyHash);
    logComboCost("list + buy", [listCost, buyCost]);

    assert.equal(await game.read.balanceOf([buyer as Hash, tokenId]), quantity, "Buyer should receive listed quantity");
  });

  it("measures combo cost: 1 list + 1 cancel", async function () {
    const { gameAddress, tokenId, quantity, game } = await setupOneNFT();
    const now = await getBlockTimestamp();
    const listingId = await marketplace.read.listingCounter();

    const listHash = await marketplace.write.listNFT([
      gameAddress,
      tokenId,
      quantity,
      LISTING_PRICE,
      now + LISTING_DURATION,
    ]);
    const listCost = await waitAndMeasureTxCost("listNFT", listHash);

    const cancelHash = await marketplace.write.cancelListing([listingId]);
    const cancelCost = await waitAndMeasureTxCost("cancelListing", cancelHash);
    logComboCost("list + cancel", [listCost, cancelCost]);

    const [listingSeller] = await marketplace.read.listings([listingId]);
    assert.equal(listingSeller, ZERO_ADDRESS);
    assert.equal(await game.read.balanceOf([seller as Hash, tokenId]), quantity, "Token should return to seller");
  });
});
