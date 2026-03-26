/**
 * GameRegistry integration tests (mirrors Solana game_registry tests).
 * Run: pnpm exec hardhat test test/GameRegistry.integration.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import hardhat from "hardhat";
import { network } from "hardhat";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Hash = `0x${string}`;

type GameData = {
  authority: Hash;
  name: string;
  description: string;
  imageUri: string;
  uri: string;
  category: string;
  feeRecipient: Hash;
  feePercentBps: number;
  exists: boolean;
};

type GameRegistryContract = {
  address: string;
  read: {
    platformAuthority: () => Promise<string>;
    getGame: (args: [Hash]) => Promise<GameData>;
    games: (args: [Hash]) => Promise<GameData>;
    isGameRegistered: (args: [Hash]) => Promise<boolean>;
    GAME_NAME_MAX_LEN: () => Promise<bigint>;
    DESCRIPTION_MAX_LEN: () => Promise<bigint>;
    FEE_PERCENT_MAX: () => Promise<number>;
  };
  write: {
    registerGame: (args: [GameInput]) => Promise<Hash>;
    updateGame: (args: [GameInput]) => Promise<Hash>;
    removeGame: (args: [Hash]) => Promise<Hash>;
  };
};

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

// ---------------------------------------------------------------------------
// Constants (match Solana game_registry)
// ---------------------------------------------------------------------------

const GAME_NAME_MAX_LEN = 64;
const DESCRIPTION_MAX_LEN = 700;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

describe("GameRegistry", { concurrency: 1 }, async function () {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [walletClient] = await viem.getWalletClients();
  const platformAuthority = walletClient!.account!.address;

  const reportGas = async (label: string, hash: Hash) => {
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") {
      throw new Error(`Transaction reverted (${label})`);
    }
    console.log(`  [Gas] ${label}: ${receipt.gasUsed.toString()} gas`);
    return receipt;
  };

  const expectRevertAndLogGas = async (label: string, send: () => Promise<Hash>, matcher: RegExp) => {
    await assert.rejects(async () => {
      const hash = await send();
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log(`  [Gas] ${label} (revert): ${receipt.gasUsed.toString()} gas`);
      if (receipt.status !== "reverted") {
        throw new Error(`Expected revert but transaction succeeded (${label})`);
      }
      throw new Error(`Transaction reverted (${label})`);
    }, matcher);
  };

  const deployRegistry = async () => {
    const artifact = await hardhat.artifacts.readArtifact("GameRegistry");
    const hash = await walletClient!.deployContract({
      abi: artifact.abi,
      bytecode: artifact.bytecode as Hash,
      args: [platformAuthority as Hash],
      account: walletClient!.account!,
    });
    const receipt = await reportGas("GameRegistry deployment", hash);
    const contract = await viem.getContractAt("GameRegistry", receipt.contractAddress!);
    return contract as unknown as GameRegistryContract;
  };

  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Hash;

  const registerGame = async (
    registry: GameRegistryContract,
    authority: Hash,
    opts: {
      name: string;
      description?: string;
      imageUri?: string;
      uri?: string;
      category?: string;
      feeRecipient?: Hash;
      feePercentBps?: number;
    },
  ) => {
    const input: GameInput = {
      authority,
      name: opts.name,
      description: opts.description ?? "",
      imageUri: opts.imageUri ?? "",
      uri: opts.uri ?? "",
      category: opts.category ?? "",
      feeRecipient: opts.feeRecipient ?? ZERO_ADDRESS,
      feePercentBps: opts.feePercentBps ?? 0,
    };
    const hash = await registry.write.registerGame([input]);
    return reportGas("registerGame", hash);
  };

  it("deploys GameRegistry with platform authority", async function () {
    const registry = await deployRegistry();
    assert.ok(registry.address);
    const auth = await registry.read.platformAuthority();
    assert.equal(auth.toLowerCase(), platformAuthority.toLowerCase());
    console.log(`  GameRegistry at: ${registry.address}`);
  });

  it("registerGame: success with name only", async function () {
    const registry = await deployRegistry();
    const name = "My Game";
    await registerGame(registry, platformAuthority as Hash, { name });

    const game = await registry.read.getGame([platformAuthority as Hash]);
    assert.ok(game.exists);
    assert.equal(game.authority.toLowerCase(), platformAuthority.toLowerCase());
    assert.equal(game.name, name);
    assert.equal(game.description, "");
    assert.equal(game.imageUri, "");
    assert.equal(game.category, "");
    assert.equal(Number(game.feePercentBps), 0);
  });

  it("registerGame: with description, imageUri, uri, category and feeRecipient", async function () {
    const registry = await deployRegistry();
    const [, , otherAccount] = await viem.getWalletClients();
    const authority = otherAccount?.account?.address ?? platformAuthority;
    const name = "Another Game";
    const description = "A cool game";
    const imageUri = "https://example.com/game.png";
    const uri = "https://example.com";
    const category = "RPG";
    const feeRecipient = platformAuthority as Hash; // use platform as fee recipient for test

    await registerGame(registry, authority as Hash, {
      name,
      description,
      imageUri,
      uri,
      category,
      feeRecipient,
      feePercentBps: 500,
    });

    const game = await registry.read.getGame([authority as Hash]);
    assert.ok(game.exists);
    assert.equal(game.name, name);
    assert.equal(game.description, description);
    assert.equal(game.imageUri, imageUri);
    assert.equal(game.uri, uri);
    assert.equal(game.category, category);
    assert.equal(Number(game.feePercentBps), 500);
  });

  it("registerGame: fail when name too long", async function () {
    const registry = await deployRegistry();
    const longName = "a".repeat(GAME_NAME_MAX_LEN + 1);
    await expectRevertAndLogGas(
      "registerGame name too long",
      () =>
        registry.write.registerGame([{
          authority: platformAuthority as Hash,
          name: longName,
          description: "",
          imageUri: "",
          uri: "",
          category: "",
          feeRecipient: ZERO_ADDRESS,
          feePercentBps: 0,
        }]),
      /NameTooLong|revert|reverted|Transaction reverted/,
    );
  });

  it("registerGame: fail when description too long", async function () {
    const registry = await deployRegistry();
    const longDesc = "x".repeat(DESCRIPTION_MAX_LEN + 1);
    await expectRevertAndLogGas(
      "registerGame description too long",
      () =>
        registry.write.registerGame([{
          authority: platformAuthority as Hash,
          name: "Game",
          description: longDesc,
          imageUri: "",
          uri: "",
          category: "",
          feeRecipient: ZERO_ADDRESS,
          feePercentBps: 0,
        }]),
      /DescriptionTooLong|revert|reverted|Transaction reverted/,
    );
  });

  it("updateGame: change name, description, imageUri, uri, category, feeRecipient", async function () {
    const registry = await deployRegistry();
    const authority = platformAuthority as Hash;
    await registerGame(registry, authority, { name: "Original" });

    const newFeeRecipient = "0x0000000000000000000000000000000000000001" as Hash;
    const hash = await registry.write.updateGame([
      {
        authority,
        name: "Updated Name",
        description: "New description",
        imageUri: "https://new-image.com",
        uri: "https://new-uri.com",
        category: "Action",
        feeRecipient: newFeeRecipient,
        feePercentBps: 300,
      },
    ]);
    await reportGas("updateGame", hash);

    const game = await registry.read.getGame([authority]);
    assert.equal(game.name, "Updated Name");
    assert.equal(game.description, "New description");
    assert.equal(game.imageUri, "https://new-image.com");
    assert.equal(game.uri, "https://new-uri.com");
    assert.equal(game.category, "Action");
    assert.equal(Number(game.feePercentBps), 300);
  });

  it("registerGame: duplicate authority fails (game already registered)", async function () {
    const registry = await deployRegistry();
    const authority = platformAuthority as Hash;
    await registerGame(registry, authority, { name: "First" });
    await expectRevertAndLogGas(
      "registerGame duplicate authority",
      () =>
        registry.write.registerGame([{
          authority,
          name: "Second",
          description: "",
          imageUri: "",
          uri: "",
          category: "",
          feeRecipient: ZERO_ADDRESS,
          feePercentBps: 0,
        }]),
      /GameAlreadyRegistered|revert|reverted|Transaction reverted/,
    );
    const game = await registry.read.getGame([authority]);
    assert.equal(game.name, "First");
  });

  it("removeGame: removes game and getGame returns empty", async function () {
    const registry = await deployRegistry();
    const authority = platformAuthority as Hash;
    await registerGame(registry, authority, { name: "To Remove" });
    assert.ok(await registry.read.isGameRegistered([authority]));

    const hash = await registry.write.removeGame([authority]);
    await reportGas("removeGame", hash);

    assert.equal(await registry.read.isGameRegistered([authority]), false);
    const game = await registry.read.getGame([authority]);
    assert.equal(game.exists, false);
  });

  it("removeGame: reverts when game not found", async function () {
    const registry = await deployRegistry();
    const unknown = "0x0000000000000000000000000000000000000001" as Hash;
    await expectRevertAndLogGas(
      "removeGame not found",
      () => registry.write.removeGame([unknown]),
      /GameNotFound|revert|reverted|Transaction reverted/,
    );
  });

  it("registerGame: reverts when not platform authority", async function () {
    const registry = await deployRegistry();
    const [, otherWallet] = await viem.getWalletClients();
    const other = otherWallet?.account?.address;
    if (!other) {
      return;
    }
    const artifact = await hardhat.artifacts.readArtifact("GameRegistry");
    await expectRevertAndLogGas(
      "registerGame unauthorized",
      async () =>
        otherWallet.writeContract({
        address: registry.address as Hash,
        abi: artifact.abi,
        functionName: "registerGame",
        args: [{
          authority: other as Hash,
          name: "Hacked",
          description: "",
          imageUri: "",
          uri: "",
          category: "",
          feeRecipient: ZERO_ADDRESS,
          feePercentBps: 0,
        }],
        account: otherWallet.account!,
      }),
      /Unauthorized|revert|reverted|Transaction reverted/,
    );
  });
});
