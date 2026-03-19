/**
 * GameFactory & GameItemNFT integration tests with gas reporting.
 * Run: pnpm exec hardhat test test/GameFactory.integration.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import hardhat from "hardhat";
import { network } from "hardhat";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Hash = `0x${string}`;

type ReceiptLog = { address: string; topics: (string | undefined)[] };
type ReceiptWithLogs = { logs: ReceiptLog[] };

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

type FactoryWithCreateGame = {
  address: string;
  write: { createGame: (args: [GameInput, string, bigint]) => Promise<Hash> };
};

type CreateGameOpts = {
  name?: string;
  symbol?: string;
  authority?: Hash;
  royaltyBps?: bigint;
};

type GameForSign = { address: string };

type GameForMint = {
  address: string;
  write: {
    mintWithSignature: (args: [Hash, string, bigint, Hash]) => Promise<Hash>;
  };
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GAME_NAME = "Test Game";
const GAME_SYMBOL = "TG";
const ROYALTY_BPS = 550n;
const GAME_DESCRIPTION = "Test game description";
const GAME_CATEGORY = "Action";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function gameAddressFromReceipt(receipt: ReceiptWithLogs, factoryAddress: string): Hash {
  const log = receipt.logs.find((l) => l.address.toLowerCase() === factoryAddress.toLowerCase());
  assert.ok(log?.topics?.[1], "GameCreated event missing");
  return `0x${log!.topics![1]!.slice(-40)}` as Hash;
}

describe("GameFactory & GameItemNFT", async function () {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [walletClient] = await viem.getWalletClients();
  const deployer = walletClient!.account!.address;
  const chainId = await publicClient.getChainId();

  const reportGas = async (label: string, hash: Hash) => {
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`  [Gas] ${label}: ${receipt.gasUsed.toString()} gas`);
    return receipt;
  };

  const deployFactory = async () => {
    const artifact = await hardhat.artifacts.readArtifact("GameFactory");
    const hash = await walletClient!.deployContract({
      abi: artifact.abi,
      bytecode: artifact.bytecode as Hash,
      account: walletClient!.account!,
    });
    const receipt = await reportGas("GameFactory deployment", hash);
    return { address: receipt.contractAddress!, receipt };
  };

  const createGame = async (factory: FactoryWithCreateGame, opts: CreateGameOpts = {}) => {
    const name = opts.name ?? GAME_NAME;
    const symbol = opts.symbol ?? GAME_SYMBOL;
    const authority = opts.authority ?? deployer;
    const royaltyBps = opts.royaltyBps ?? ROYALTY_BPS;
    const input: GameInput = {
      authority,
      name,
      description: GAME_DESCRIPTION,
      imageUri: "",
      uri: "",
      category: GAME_CATEGORY,
      feeRecipient: deployer,
      feePercentBps: 0,
    };
    const hash = await factory.write.createGame([input, symbol, royaltyBps]);
    const receipt = await reportGas("createGame", hash);
    const gameAddress = gameAddressFromReceipt(receipt, factory.address);
    const game = await viem.getContractAt("GameItemNFT", gameAddress);
    return { gameAddress, game, receipt };
  };

  const signMint = async (game: GameForSign, to: Hash, uri: string, nonce: bigint) => {
    const domain = { name: GAME_NAME, version: "1", chainId, verifyingContract: game.address } as const;
    const types = {
      Mint: [
        { name: "to", type: "address" },
        { name: "uri", type: "string" },
        { name: "nonce", type: "uint256" },
      ],
    } as const;
    return walletClient!.signTypedData({
      account: walletClient!.account!,
      domain,
      types,
      primaryType: "Mint",
      message: { to, uri, nonce },
    });
  };

  const mint = async (game: GameForMint, to: Hash, uri: string, nonce: bigint, label?: string) => {
    const signature = await signMint(game, to, uri, nonce);
    const hash = await game.write.mintWithSignature([to, uri, nonce, signature as Hash]);
    return reportGas(label ?? "mintWithSignature", hash);
  };

  it("deploys GameFactory and reports deployment gas", async function () {
    const { address } = await deployFactory();
    assert.ok(address);
    console.log(`  GameFactory at: ${address}`);
  });

  it("creates a game and reports createGame gas", async function () {
    const factory = await viem.deployContract("GameFactory");
    const { game, gameAddress } = await createGame(factory);
    assert.ok(gameAddress);
    assert.equal(await game.read.name(), GAME_NAME);
    assert.equal(await game.read.symbol(), GAME_SYMBOL);
    assert.equal((await game.read.authority()).toLowerCase(), deployer.toLowerCase());
    assert.equal((await game.read.owner()).toLowerCase(), deployer.toLowerCase());
  });

  it("creates multiple games from one factory", async function () {
    const factory = await viem.deployContract("GameFactory");
    const { game: game0 } = await createGame(factory, { name: "Game A", symbol: "GA" });
    const { game: game1 } = await createGame(factory, { name: "Game B", symbol: "GB" });
    assert.equal(await game0.read.name(), "Game A");
    assert.equal(await game1.read.name(), "Game B");
    assert.notEqual(game0.address, game1.address);
  });

  it("mints one item with signature and reports gas", async function () {
    const factory = await viem.deployContract("GameFactory");
    const { game } = await createGame(factory);
    await mint(game, deployer, "ipfs://QmFirst", 0n, "mintWithSignature (first)");
    assert.equal((await game.read.ownerOf([0n])).toLowerCase(), deployer.toLowerCase());
    assert.equal(await game.read.tokenURI([0n]), "ipfs://QmFirst");
    assert.equal(await game.read.balanceOf([deployer]), 1n);
  });

  it("mints multiple items and reports gas per mint", async function () {
    const factory = await viem.deployContract("GameFactory");
    const { game } = await createGame(factory);
    for (let i = 0; i < 3; i++) {
      await mint(game, deployer, `ipfs://QmItem${i}`, BigInt(i), `mintWithSignature #${i}`);
    }
    assert.equal(await game.read.balanceOf([deployer]), 3n);
  });

  it("reverts when reusing the same mint signature", async function () {
    const factory = await viem.deployContract("GameFactory");
    const { game } = await createGame(factory);
    const uri = "ipfs://QmReplay";
    const nonce = 99n;
    await mint(game, deployer, uri, nonce);
    const signature = await signMint(game, deployer, uri, nonce);
    await assert.rejects(
      () => game.write.mintWithSignature([deployer, uri, nonce, signature as Hash]),
      /Signature already used|revert/,
    );
  });

  it("reverts when mint signature has wrong nonce", async function () {
    const factory = await viem.deployContract("GameFactory");
    const { game } = await createGame(factory);
    const signature = await signMint(game, deployer, "ipfs://QmWrongNonce", 999n);
    await assert.rejects(
      () => game.write.mintWithSignature([deployer, "ipfs://QmWrongNonce", 0n, signature as Hash]),
      /Invalid signature|revert/,
    );
  });
});
