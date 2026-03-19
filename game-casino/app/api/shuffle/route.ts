import { NextResponse } from "next/server";
import path from "node:path";
import { publicKey } from "@metaplex-foundation/umi";
import { serializeTransaction, createDevnetUmi } from "game-sdk";
import {
  createFileUploadFeeTransferTransaction,
  createMintTransaction,
} from "game-sdk/server";
import type { ItemMetadata } from "game-sdk/server";
import { getGamePrivateKey } from "@/utils/keys";
import { getServerEnv } from "@/config/env";
import { getWeightedRandomItem, type SlotItem } from "@/config/items";

const tempItemStore = new Map<string, ItemMetadata>();

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function isErrorResult(x: unknown): x is { error: string } {
  return (
    typeof x === "object" &&
    x !== null &&
    "error" in x &&
    typeof (x as { error: unknown }).error === "string"
  );
}

function slotItemToMetadata(item: SlotItem, itemId: string): ItemMetadata {
  return {
    name: item.name,
    image: item.name + ".png",
    description: item.description,
    id: itemId,
    gameAddress: "",
    attributes: [
      { trait_type: "rarity", value: item.rarity },
      { trait_type: "points", value: String(item.points) },
      { trait_type: "description", value: item.description },
      { trait_type: "emoji", value: item.emoji },
    ],
  };
}

function getImagePath(item: SlotItem): string {
  const filename = item.name + ".png";
  return path.join(process.cwd(), "public", "assets", filename);
}

export async function GET(req: Request) {
  const userWalletAddress = new URL(req.url).searchParams.get("userWalletAddress");
  if (!userWalletAddress) {
    return errorResponse("Missing userWalletAddress", 400);
  }

  const { shuffleDelayMs, gameWalletAddress, itemImageFilename } =
    getServerEnv();
  await new Promise((resolve) => setTimeout(resolve, shuffleDelayMs));

  const randomItem = getWeightedRandomItem();
  const itemId = crypto.randomUUID();
  const imagePath = getImagePath(randomItem);

  const testItem = slotItemToMetadata(randomItem, itemId);
  const umi = createDevnetUmi();

  const transferTransaction = await createFileUploadFeeTransferTransaction(
    publicKey(userWalletAddress),
    publicKey(gameWalletAddress),
    testItem,
    imagePath
  );
  const serialized = serializeTransaction(umi, transferTransaction);
  tempItemStore.set(itemId, testItem);

  return NextResponse.json({
    transaction: serialized,
    itemId: testItem.id,
    name: randomItem.name,
    emoji: randomItem.emoji,
    rarity: randomItem.rarity,
    points: randomItem.points,
  });
}

export async function POST(req: Request) {
  let body: { itemId?: string; userWalletAddress?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const { itemId, userWalletAddress } = body;
  if (!itemId || !userWalletAddress) {
    return errorResponse("Missing itemId or userWalletAddress", 400);
  }

  const item = tempItemStore.get(itemId);
  if (!item) {
    return errorResponse("Item not found or expired", 404);
  }

  const umi = createDevnetUmi();
  const serverKeypair = umi.eddsa.createKeypairFromSecretKey(
    getGamePrivateKey()
  );
  const imagePath = getImagePath(item);

  const transaction = await createMintTransaction(
    item,
    imagePath,
    serverKeypair,
    publicKey(userWalletAddress)
  );

  if (isErrorResult(transaction)) {
    return errorResponse(transaction.error, 400);
  }

  const serialized = serializeTransaction(umi, transaction);
  tempItemStore.delete(itemId);

  return NextResponse.json({
    transaction: serialized,
    gameAddress: serverKeypair.publicKey,
    userAddress: userWalletAddress,
  });
}
