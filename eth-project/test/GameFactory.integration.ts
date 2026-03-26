/**
 * GameFactory & GameItemNFT integration tests with gas reporting.
 * Run: pnpm exec hardhat test test/GameFactory.integration.ts
 */

import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import hardhat from "hardhat";
import { network } from "hardhat";
import { currentDeploymentsPath, loadPersistentDeployments, savePersistentDeployments } from "./utils/persistentDeployments.js";

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
  write: {
    createGame: (args: [GameInput]) => Promise<Hash>;
    updateGame: (args: [GameInput]) => Promise<Hash>;
  };
};

type CreateGameOpts = {
  name?: string;
  authority?: Hash;
  feePercentBps?: number;
  description?: string;
  imageUri?: string;
  uri?: string;
  category?: string;
  feeRecipient?: Hash;
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

const GAME_NAME = "My Game";
const GAME_DESCRIPTION = "";
const GAME_CATEGORY = "";
const GAME_FEE_BPS = 0;
const EIP712_DOMAIN_NAME = "GameItemNFT";
const GAME_NAME_MAX_LEN = 64;
const DESCRIPTION_MAX_LEN = 700;
const IMAGE_URI_MAX_LEN = 500;
const URI_MAX_LEN = 500;
const CATEGORY_MAX_LEN = 64;

function isSepoliaRun(): boolean {
  if ((process.env.HARDHAT_NETWORK ?? "").trim() === "sepolia") return true;
  const networkFlagIndex = process.argv.findIndex((arg) => arg === "--network");
  if (networkFlagIndex >= 0) return process.argv[networkFlagIndex + 1] === "sepolia";
  return process.argv.some((arg) => arg === "--network=sepolia");
}

function shouldReusePersistentDeployments(): boolean {
  const raw = (process.env.REUSE_PERSISTENT_DEPLOYMENTS ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

describe("GameFactory & GameItemNFT", { concurrency: 1 }, async function () {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const walletClients = await viem.getWalletClients();
  const walletClient = walletClients[0];
  const deployer = walletClient!.account!.address;
  const chainId = await publicClient.getChainId();
  const isSepolia = isSepoliaRun();
  const reusePersistentDeployments = shouldReusePersistentDeployments();
  const factoryAbi = (await hardhat.artifacts.readArtifact("GameFactory")).abi;
  const gameItemAbi = (await hardhat.artifacts.readArtifact("GameItemNFT")).abi;
  let factory: FactoryWithCreateGame;
  let factoryAddress: string;

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

  const expectRevertWithMetrics = async (label: string, send: () => Promise<Hash>, matcher: RegExp) => {
    await assert.rejects(async () => {
      const startedAt = Date.now();
      try {
        const hash = await send();
        await reportGasAndLatency(label, hash);
      } catch (err) {
        // Some clients reject failing txs before broadcast (no hash/receipt).
        // Keep output consistent by printing latency and explicit gas unavailability.
        console.log(`  [Gas] ${label}: n/a (preflight revert)`);
        console.log(`  [Latency] ${label}: ${Date.now() - startedAt}ms`);
        throw err;
      }
    }, matcher);
  };

  const deployFactory = async () => {
    const hash = await walletClient!.deployContract({
      abi: factoryAbi,
      bytecode: (await hardhat.artifacts.readArtifact("GameFactory")).bytecode as Hash,
      account: walletClient!.account!,
    });
    const receipt = await reportGasAndLatency("GameFactory deployment", hash);
    return { address: receipt.contractAddress!, receipt };
  };

  before(async () => {
    if (isSepolia && reusePersistentDeployments) {
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

    if (isSepolia && reusePersistentDeployments) {
      await savePersistentDeployments("sepolia", Number(chainId), { gameFactory: factoryAddress as Hash });
      console.log(`Saved factory deployment to ${currentDeploymentsPath()}`);
    }
  });

  const createGame = async (factoryRef: FactoryWithCreateGame, opts: CreateGameOpts = {}) => {
    const authority = opts.authority ?? deployer;
    const input: GameInput = {
      authority,
      name: opts.name ?? GAME_NAME,
      description: opts.description ?? GAME_DESCRIPTION,
      imageUri: opts.imageUri ?? "",
      uri: opts.uri ?? "",
      category: opts.category ?? GAME_CATEGORY,
      feeRecipient: opts.feeRecipient ?? deployer,
      feePercentBps: opts.feePercentBps ?? GAME_FEE_BPS,
    };
    const hash = await factoryRef.write.createGame([input]);
    await reportGasAndLatency("createGame", hash);
    const gameAddress = await factoryRef.read.gameItems();
    const game = await viem.getContractAt("GameItemNFT", gameAddress);
    return { gameAddress, game: game as unknown as GameForMint, input };
  };

  const signMint = async (game: GameForSign, gameAuthority: Hash, to: Hash, uri: string, amount: bigint, nonce: bigint) => {
    const authoritySigner =
      walletClients.find(
        (wc) => wc.account?.address.toLowerCase() === gameAuthority.toLowerCase(),
      ) ?? walletClient!;
    const domain = { name: EIP712_DOMAIN_NAME, version: "1", chainId, verifyingContract: game.address } as const;
    const types = {
      Mint: [
        { name: "gameAuthority", type: "address" },
        { name: "to", type: "address" },
        { name: "uri", type: "string" },
        { name: "amount", type: "uint256" },
        { name: "nonce", type: "uint256" },
      ],
    } as const;
    return authoritySigner.signTypedData({
      account: authoritySigner.account!,
      domain,
      types,
      primaryType: "Mint",
      message: { gameAuthority, to, uri, amount, nonce },
    });
  };

  const mint = async (game: GameForMint, gameAuthority: Hash, to: Hash, uri: string, nonce: bigint, label?: string) => {
    const signature = await signMint(game, gameAuthority, to, uri, 1n, nonce);
    const hash = await game.write.mintWithSignature([gameAuthority, to, uri, nonce, signature as Hash]);
    return reportGasAndLatency(label ?? "mintWithSignature", hash);
  };

  const sendCreateGameRaw = (sender: NonNullable<(typeof walletClients)[number]>, input: GameInput) =>
    sender.writeContract({
      address: factory.address as Hash,
      abi: factoryAbi,
      functionName: "createGame",
      args: [input],
      account: sender.account!,
      gas: 5_000_000n,
    });

  it("deploys GameFactory and reports deployment gas", async function () {
    assert.ok(factoryAddress);
  });

  it("register_game: success with name only (anchor parity)", async function () {
    const authority = (walletClients[1]?.account?.address ?? "0x0000000000000000000000000000000000000001") as Hash;
    const { input } = await createGame(factory, { authority, name: "My Game", feeRecipient: "0x0000000000000000000000000000000000000000" as Hash });
    const gameData = await factory.read.getGameData([authority]);
    assert.equal(gameData.exists, true);
    assert.equal(gameData.name, input.name);
    assert.equal(gameData.description, "");
    assert.equal(gameData.imageUri, "");
    assert.equal(gameData.uri, "");
    assert.equal(gameData.category, "");
    assert.equal(gameData.feeRecipient.toLowerCase(), authority.toLowerCase());
    assert.equal(gameData.feePercentBps, 0);
  });

  it("register_game: with optional fields (anchor parity)", async function () {
    const authority = (walletClients[2]?.account?.address ?? "0x0000000000000000000000000000000000000002") as Hash;
    const feeRecipient = (walletClients[3]?.account?.address ?? deployer) as Hash;
    await createGame(factory, {
      authority,
      name: "Another Game",
      description: "A cool game",
      imageUri: "https://example.com/game.png",
      uri: "https://example.com",
      category: "RPG",
      feeRecipient,
      feePercentBps: 500,
    });
    const gameData = await factory.read.getGameData([authority]);
    assert.equal(gameData.name, "Another Game");
    assert.equal(gameData.description, "A cool game");
    assert.equal(gameData.imageUri, "https://example.com/game.png");
    assert.equal(gameData.uri, "https://example.com");
    assert.equal(gameData.category, "RPG");
    assert.equal(gameData.feeRecipient.toLowerCase(), feeRecipient.toLowerCase());
    assert.equal(gameData.feePercentBps, 500);
  });

  it("register_game: fail when name too long", async function () {
    const authority = (walletClients[4]?.account?.address ?? "0x0000000000000000000000000000000000000004") as Hash;
    const input: GameInput = {
      authority,
      name: "a".repeat(GAME_NAME_MAX_LEN + 1),
      description: GAME_DESCRIPTION,
      imageUri: "",
      uri: "",
      category: GAME_CATEGORY,
      feeRecipient: deployer,
      feePercentBps: GAME_FEE_BPS,
    };
    await expectRevertWithMetrics(
      "createGame name too long (revert)",
      () => sendCreateGameRaw(walletClient!, input),
      /NameTooLong|revert/,
    );
  });

  it("register_game: fail when description too long", async function () {
    const authority = (walletClients[5]?.account?.address ?? "0x0000000000000000000000000000000000000005") as Hash;
    const input: GameInput = {
      authority,
      name: GAME_NAME,
      description: "x".repeat(DESCRIPTION_MAX_LEN + 1),
      imageUri: "",
      uri: "",
      category: GAME_CATEGORY,
      feeRecipient: deployer,
      feePercentBps: GAME_FEE_BPS,
    };
    await expectRevertWithMetrics(
      "createGame description too long (revert)",
      () => sendCreateGameRaw(walletClient!, input),
      /DescriptionTooLong|revert/,
    );
  });

  it("register_game: fail when image_uri too long", async function () {
    const authority = (walletClients[6]?.account?.address ?? "0x0000000000000000000000000000000000000006") as Hash;
    const input: GameInput = {
      authority,
      name: GAME_NAME,
      description: GAME_DESCRIPTION,
      imageUri: "x".repeat(IMAGE_URI_MAX_LEN + 1),
      uri: "",
      category: GAME_CATEGORY,
      feeRecipient: deployer,
      feePercentBps: GAME_FEE_BPS,
    };
    await expectRevertWithMetrics(
      "createGame image uri too long (revert)",
      () => sendCreateGameRaw(walletClient!, input),
      /ImageUriTooLong|revert/,
    );
  });

  it("register_game: fail when uri too long", async function () {
    const authority = (walletClients[7]?.account?.address ?? "0x0000000000000000000000000000000000000007") as Hash;
    const input: GameInput = {
      authority,
      name: GAME_NAME,
      description: GAME_DESCRIPTION,
      imageUri: "",
      uri: "x".repeat(URI_MAX_LEN + 1),
      category: GAME_CATEGORY,
      feeRecipient: deployer,
      feePercentBps: GAME_FEE_BPS,
    };
    await expectRevertWithMetrics(
      "createGame uri too long (revert)",
      () => sendCreateGameRaw(walletClient!, input),
      /UriTooLong|revert/,
    );
  });

  it("register_game: fail when category too long", async function () {
    const authority = (walletClients[8]?.account?.address ?? "0x0000000000000000000000000000000000000008") as Hash;
    const input: GameInput = {
      authority,
      name: GAME_NAME,
      description: GAME_DESCRIPTION,
      imageUri: "",
      uri: "",
      category: "x".repeat(CATEGORY_MAX_LEN + 1),
      feeRecipient: deployer,
      feePercentBps: GAME_FEE_BPS,
    };
    await expectRevertWithMetrics(
      "createGame category too long (revert)",
      () => sendCreateGameRaw(walletClient!, input),
      /CategoryTooLong|revert/,
    );
  });

  it("register_game: duplicate authority fails", async function () {
    const authority = (walletClients[9]?.account?.address ?? deployer) as Hash;
    await createGame(factory, { authority, name: "First" });
    const input: GameInput = {
      authority,
      name: "Second",
      description: GAME_DESCRIPTION,
      imageUri: "",
      uri: "",
      category: GAME_CATEGORY,
      feeRecipient: deployer,
      feePercentBps: GAME_FEE_BPS,
    };
    await expectRevertWithMetrics(
      "createGame duplicate authority (revert)",
      () => sendCreateGameRaw(walletClient!, input),
      /GameAlreadyRegistered|revert/,
    );
  });

  it("update_game: change fields (anchor parity)", async function () {
    const authority = (walletClients[10]?.account?.address ?? "0x0000000000000000000000000000000000000010") as Hash;
    await createGame(factory, { authority, name: "Original" });
    const updateInput: GameInput = {
      authority,
      name: "Updated Name",
      description: "New description",
      imageUri: "https://new-image.com",
      uri: "https://new-uri.com",
      category: "Action",
      feeRecipient: deployer,
      feePercentBps: 300,
    };
    const hash = await factory.write.updateGame([updateInput]);
    await reportGasAndLatency("updateGame", hash);
    const gameData = await factory.read.getGameData([authority]);
    assert.equal(gameData.name, "Updated Name");
    assert.equal(gameData.description, "New description");
    assert.equal(gameData.imageUri, "https://new-image.com");
    assert.equal(gameData.uri, "https://new-uri.com");
    assert.equal(gameData.category, "Action");
    assert.equal(gameData.feePercentBps, 300);
  });

  it("update_game: wrong platform authority fails", async function () {
    const authority = (walletClients[11]?.account?.address ?? "0x0000000000000000000000000000000000000011") as Hash;
    await createGame(factory, { authority, name: "Only Mine" });
    const otherWallet = walletClients[1];
    if (!otherWallet?.account) return;

    await expectRevertWithMetrics(
      "updateGame wrong platform authority (revert)",
      () =>
        otherWallet.writeContract({
          address: factory.address as Hash,
          abi: factoryAbi,
          functionName: "updateGame",
          args: [{
            authority,
            name: "Hacked",
            description: "",
            imageUri: "",
            uri: "",
            category: "",
            feeRecipient: otherWallet.account!.address as Hash,
            feePercentBps: 0,
          }],
          account: otherWallet.account!,
          gas: 5_000_000n,
        }),
      /Unauthorized|revert/,
    );
  });

  it("mints one item with signature and reports gas", async function () {
    const authority = (walletClients[12]?.account?.address ?? deployer) as Hash;
    const { game } = await createGame(factory, { authority, name: "Mint Game" });
    await mint(game, authority, authority, "", 0n, "mintWithSignature (first)");
    assert.equal(await game.read.uri([0n]), "");
    assert.equal(await game.read.balanceOf([authority, 0n]), 1n);
    assert.equal((await game.read.tokenGameAuthority([0n])).toLowerCase(), authority.toLowerCase());
  });

  it("reverts when reusing the same mint signature", async function () {
    const authority = (walletClients[13]?.account?.address ?? deployer) as Hash;
    const { game } = await createGame(factory, { authority, name: "Replay Game" });
    const uri = "";
    const nonce = 99n;
    await mint(game, authority, authority, uri, nonce);
    const signature = await signMint(game, authority, authority, uri, 1n, nonce);
    await expectRevertWithMetrics(
      "mintWithSignature replay (revert)",
      () =>
        walletClient!.writeContract({
          address: game.address,
          abi: gameItemAbi,
          functionName: "mintWithSignature",
          args: [authority, authority, uri, nonce, signature as Hash],
          account: walletClient!.account!,
          gas: 5_000_000n,
        }),
      /Signature already used|revert/,
    );
  });
});
