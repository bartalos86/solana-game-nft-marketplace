/**
 * GameFactory & GameItemNFT integration tests with gas reporting.
 * Run: pnpm exec hardhat test test/GameFactory.integration.ts
 */

import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import hardhat from "hardhat";
import { network } from "hardhat";
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

type FactoryWithCreateGame = {
  address: string;
  read: {
    gameItems: () => Promise<Hash>;
    getGameByAuthority: (args: [Hash]) => Promise<Hash>;
    getGameData: (args: [Hash]) => Promise<{
      authority: Hash;
      name: string;
      description: string;
      imageUri: string;
      uri: string;
      category: string;
      feeRecipient: Hash;
      feePercentBps: number;
      exists: boolean;
    }>;
  };
  write: { createGame: (args: [GameInput]) => Promise<Hash> };
};

type CreateGameOpts = {
  name?: string;
  authority?: Hash;
  feePercentBps?: number;
};

type GameForSign = { address: Hash };

type GameForMint = {
  address: Hash;
  read: {
    uri: (args: [bigint]) => Promise<string>;
    balanceOf: (args: [Hash, bigint]) => Promise<bigint>;
    tokenGameAuthority: (args: [bigint]) => Promise<Hash>;
  };
  write: {
    mintWithSignature: (args: [Hash, Hash, string, bigint, Hash]) => Promise<Hash>;
  };
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GAME_NAME = "Test Game";
const GAME_DESCRIPTION = "Test game description";
const GAME_CATEGORY = "Action";
const GAME_FEE_BPS = 550;
const EIP712_DOMAIN_NAME = "GameItemNFT";

function isSepoliaRun(): boolean {
  if ((process.env.HARDHAT_NETWORK ?? "").trim() === "sepolia") return true;
  const networkFlagIndex = process.argv.findIndex((arg) => arg === "--network");
  if (networkFlagIndex >= 0) {
    return process.argv[networkFlagIndex + 1] === "sepolia";
  }
  return process.argv.some((arg) => arg === "--network=sepolia");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

describe("GameFactory & GameItemNFT", async function () {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const walletClients = await viem.getWalletClients();
  const walletClient = walletClients[0];
  const deployer = walletClient!.account!.address;
  const chainId = await publicClient.getChainId();
  const isSepolia = isSepoliaRun();
  let factory: FactoryWithCreateGame;
  let factoryAddress: string;

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

  before(async () => {
    if (isSepolia) {
      const persisted = await loadPersistentDeployments("sepolia");
      if (persisted?.gameFactory) {
        factoryAddress = persisted.gameFactory;
        factory = (await viem.getContractAt("GameFactory", factoryAddress as Hash)) as unknown as FactoryWithCreateGame;
        console.log(`Reusing persisted factory from ${currentDeploymentsPath()}`);
        return;
      }
    }

    const deployed = await deployFactory();
    factoryAddress = deployed.address;
    factory = (await viem.getContractAt("GameFactory", factoryAddress as Hash)) as unknown as FactoryWithCreateGame;

    if (isSepolia) {
      await savePersistentDeployments("sepolia", Number(chainId), { gameFactory: factoryAddress as Hash });
      console.log(`Saved factory deployment to ${currentDeploymentsPath()}`);
    }
  });

  const createGame = async (factory: FactoryWithCreateGame, opts: CreateGameOpts = {}) => {
    const name = opts.name ?? GAME_NAME;
    const authority = opts.authority ?? deployer;
    const feePercentBps = opts.feePercentBps ?? GAME_FEE_BPS;
    const input: GameInput = {
      authority,
      name,
      description: GAME_DESCRIPTION,
      imageUri: "",
      uri: "",
      category: GAME_CATEGORY,
      feeRecipient: deployer,
      feePercentBps,
    };
    const hash = await factory.write.createGame([input]);
    await reportGas("createGame", hash);
    const gameAddress = await factory.read.gameItems();
    const game = await viem.getContractAt("GameItemNFT", gameAddress);
    return { gameAddress, game: game as unknown as GameForMint, input };
  };

  const signMint = async (
    game: GameForSign,
    gameAuthority: Hash,
    to: Hash,
    uri: string,
    amount: bigint,
    nonce: bigint,
  ) => {
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
    return walletClient!.signTypedData({
      account: walletClient!.account!,
      domain,
      types,
      primaryType: "Mint",
      message: { gameAuthority, to, uri, amount, nonce },
    });
  };

  const mint = async (
    game: GameForMint,
    gameAuthority: Hash,
    to: Hash,
    uri: string,
    nonce: bigint,
    label?: string,
  ) => {
    const signature = await signMint(game, gameAuthority, to, uri, 1n, nonce);
    const hash = await game.write.mintWithSignature([gameAuthority, to, uri, nonce, signature as Hash]);
    return reportGas(label ?? "mintWithSignature", hash);
  };

  it("deploys GameFactory and reports deployment gas", async function () {
    assert.ok(factoryAddress);
    console.log(`  GameFactory at: ${factoryAddress}`);
  });

  it("creates a game and reports createGame gas", async function () {
    const { gameAddress, input } = await createGame(factory);
    assert.ok(gameAddress);
    assert.equal((await factory.read.gameItems()).toLowerCase(), gameAddress.toLowerCase());
    assert.equal((await factory.read.getGameByAuthority([input.authority])).toLowerCase(), gameAddress.toLowerCase());

    const gameData = await factory.read.getGameData([input.authority]);
    assert.equal(gameData.exists, true);
    assert.equal(gameData.name, input.name);
    assert.equal(gameData.feePercentBps, input.feePercentBps);
  });

  it("creates multiple games from one factory", async function () {
    const authorityA = deployer;
    const authorityB = (walletClients[1]?.account?.address ?? "0x000000000000000000000000000000000000dEaD") as Hash;
    const { gameAddress: game0 } = await createGame(factory, { name: "Game A", authority: authorityA });
    const { gameAddress: game1 } = await createGame(factory, {
      name: "Game B",
      authority: authorityB,
      feePercentBps: 1000,
    });
    assert.equal(game0.toLowerCase(), game1.toLowerCase());
  });

  it("mints one item with signature and reports gas", async function () {
    const { game } = await createGame(factory);
    await mint(game, deployer, deployer, "ipfs://QmFirst", 0n, "mintWithSignature (first)");
    assert.equal(await game.read.uri([0n]), "ipfs://QmFirst");
    assert.equal(await game.read.balanceOf([deployer, 0n]), 1n);
    assert.equal((await game.read.tokenGameAuthority([0n])).toLowerCase(), deployer.toLowerCase());
  });

  it("mints multiple items and reports gas per mint", async function () {
    const { game } = await createGame(factory);
    for (let i = 0; i < 3; i++) {
      await mint(game, deployer, deployer, `ipfs://QmItem${i}`, BigInt(i), `mintWithSignature #${i}`);
    }
    assert.equal(await game.read.balanceOf([deployer, 0n]), 1n);
    assert.equal(await game.read.balanceOf([deployer, 1n]), 1n);
    assert.equal(await game.read.balanceOf([deployer, 2n]), 1n);
  });

  it("reverts when reusing the same mint signature", async function () {
    const { game } = await createGame(factory);
    const uri = "ipfs://QmReplay";
    const nonce = 99n;
    await mint(game, deployer, deployer, uri, nonce);
    const signature = await signMint(game, deployer, deployer, uri, 1n, nonce);
    await assert.rejects(
      () => game.write.mintWithSignature([deployer, deployer, uri, nonce, signature as Hash]),
      /Signature already used|revert/,
    );
  });

  it("reverts when mint signature has wrong nonce", async function () {
    const { game } = await createGame(factory);
    const signature = await signMint(game, deployer, deployer, "ipfs://QmWrongNonce", 1n, 999n);
    await assert.rejects(
      () => game.write.mintWithSignature([deployer, deployer, "ipfs://QmWrongNonce", 0n, signature as Hash]),
      /Invalid signature|revert/,
    );
  });

  it("reverts when game authority is not registered", async function () {
    const { game } = await createGame(factory);
    const unknownAuthority = "0x000000000000000000000000000000000000dEaD" as Hash;
    const signature = await signMint(game, unknownAuthority, deployer, "ipfs://QmInvalidGame", 1n, 7n);
    await assert.rejects(
      () => game.write.mintWithSignature([unknownAuthority, deployer, "ipfs://QmInvalidGame", 7n, signature as Hash]),
      /InvalidGame|revert/,
    );
  });
});
