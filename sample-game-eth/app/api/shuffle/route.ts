import { NextResponse } from "next/server";
// import fs from "node:fs";
// import path from "node:path";
import { createPublicClient, http, isAddress, type Address } from "viem";
import {
  createFeeTransferRequest,
  createMintAuthorizationForTokenUri,
} from "@/lib/eth-mint";
import type { ItemMetadata } from "@/lib/eth-mint";
import { getGamePrivateKey } from "@/utils/keys";
// import { getGamePrivateKey, getIrysPrivateKey } from "@/utils/keys";
import { getRpcUrls, getServerEnv } from "@/config/env";
import { getWeightedRandomItem, type SlotItem } from "@/config/items";
import { GAME_FACTORY_ABI } from "@/lib/eth-factory";
// import {
//   fetchAssetCostToStore,
//   uploadImageAsset,
//   uploadMetadataAsset,
// } from "game-sdk/eth";

const tempItemStore = new Map<string, ItemMetadata>();
// const uploadedImageUris = new Map<string, string>();
// const IRYS_FREE_UPLOAD_BYTES = 100 * 1024;
const GAME_ITEMS_CACHE_TTL_MS = 60_000;
let gameItemsCache:
  | { address: `0x${string}`; chainId: number; cachedAt: number }
  | null = null;

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
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

function encodeMetadataAsBase64DataUri(metadata: ItemMetadata): string {
  const json = JSON.stringify(metadata);
  const base64 = Buffer.from(json, "utf8").toString("base64");
  return `data:application/json;base64,${base64}`;
}

// function encodeMetadataAsUrl(metadata: ItemMetadata): string {
//   // Encode lightweight metadata into query params; no external upload needed.
//   const params = new URLSearchParams({
//     id: metadata.id,
//     name: metadata.name,
//     image: metadata.image,
//     description: metadata.description,
//   });
//   return `https://sample-game-eth.local/metadata?${params.toString()}`;
// }

// function getImagePath(itemName: string): string {
//   const filename = `${itemName}.png`;
//   return path.join(process.cwd(), "public", "assets", filename);
// }
//
// async function estimateShuffleFeeWei(params: {
//   imagePath: string;
//   metadata: ItemMetadata;
//   gamePrivateKey: `0x${string}`;
//   rpcUrl: string;
// }): Promise<bigint> {
//   const { imagePath, metadata, gamePrivateKey, rpcUrl } = params;
//   const imageSizeBytes = uploadedImageUris.has(metadata.name)
//     ? 0
//     : (await fs.promises.stat(imagePath)).size;
//   const metadataSizeBytes = Buffer.byteLength(JSON.stringify(metadata), "utf8");
//   const totalBytes = imageSizeBytes + metadataSizeBytes;
//
//   // Irys upload is free for payloads up to 100KB.
//   if (totalBytes <= IRYS_FREE_UPLOAD_BYTES) {
//     return BigInt(0);
//   }
//
//   const estimatedCost = await fetchAssetCostToStore(
//     imagePath,
//     metadata,
//     gamePrivateKey,
//     rpcUrl
//   );
//   return BigInt(estimatedCost.toString());
// }

async function resolveGameItemsAddress(): Promise<{
  address: `0x${string}` | null;
  error?: string;
}> {
  const { gameFactoryAddress, chainId: expectedChainId } = getServerEnv();
  if (
    gameItemsCache &&
    gameItemsCache.chainId === expectedChainId &&
    Date.now() - gameItemsCache.cachedAt < GAME_ITEMS_CACHE_TTL_MS
  ) {
    return { address: gameItemsCache.address };
  }
  if (!gameFactoryAddress || !isAddress(gameFactoryAddress)) {
    return { address: null, error: "NEXT_PUBLIC_GAME_FACTORY_ADDRESS is missing or invalid." };
  }

  const rpcUrls = getRpcUrls();
  const errors: string[] = [];
  for (const rpcUrl of rpcUrls) {
    const publicClient = createPublicClient({
      transport: http(rpcUrl, { timeout: 7000, retryCount: 0 }),
    });
    try {
      const rpcChainId = await publicClient.getChainId();
      if (rpcChainId !== expectedChainId) {
        errors.push(`${rpcUrl}: wrong chain id ${rpcChainId}, expected ${expectedChainId}`);
        continue;
      }

      const bytecode = await publicClient.getBytecode({ address: gameFactoryAddress });
      if (!bytecode || bytecode === "0x") {
        errors.push(`${rpcUrl}: no contract bytecode at factory address`);
        continue;
      }

      const resolved = await publicClient.readContract({
        address: gameFactoryAddress,
        abi: GAME_FACTORY_ABI,
        functionName: "gameItems",
      });
      if (isAddress(resolved)) {
        gameItemsCache = {
          address: resolved,
          chainId: expectedChainId,
          cachedAt: Date.now(),
        };
        return { address: resolved };
      }
      errors.push(`${rpcUrl}: gameItems() returned invalid address`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`${rpcUrl}: ${message}`);
    }
  }

  return {
    address: null,
    error: `Failed across RPCs. ${errors.join(" | ")}. Try setting NEXT_PUBLIC_RPC_URL to a reliable Sepolia HTTPS RPC.`,
  };
}

async function validateGameAuthority(
  gameItemsAddress: Address,
  gameAuthority: Address
): Promise<string | null> {
  const gameItemsAbi = [
    {
      type: "function",
      name: "registry",
      stateMutability: "view",
      inputs: [],
      outputs: [{ type: "address" }],
    },
  ] as const;
  const registryAbi = [
    {
      type: "function",
      name: "getGameRoyaltyConfig",
      stateMutability: "view",
      inputs: [{ name: "authority", type: "address" }],
      outputs: [
        { name: "exists", type: "bool" },
        { name: "feeRecipient", type: "address" },
        { name: "feePercentBps", type: "uint16" },
      ],
    },
  ] as const;

  const rpcUrls = getRpcUrls();
  const errors: string[] = [];

  for (const rpcUrl of rpcUrls) {
    const publicClient = createPublicClient({
      transport: http(rpcUrl, { timeout: 7000, retryCount: 0 }),
    });
    try {
      const registry = await publicClient.readContract({
        address: gameItemsAddress,
        abi: gameItemsAbi,
        functionName: "registry",
      });
      if (!isAddress(registry)) {
        errors.push(`${rpcUrl}: GameItems.registry() returned invalid address`);
        continue;
      }
      const config = await publicClient.readContract({
        address: registry,
        abi: registryAbi,
        functionName: "getGameRoyaltyConfig",
        args: [gameAuthority],
      });
      const exists = Array.isArray(config) ? Boolean(config[0]) : false;
      if (!exists) {
        return `Game authority ${gameAuthority} is not registered in GameRegistry`;
      }
      return null;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`${rpcUrl}: ${message}`);
    }
  }

  return `Game authority validation failed across RPCs. ${errors.join(" | ")}`;
}

export async function GET(req: Request) {
  const userWalletAddress = new URL(req.url).searchParams.get("userWalletAddress");
  if (!userWalletAddress) {
    return errorResponse("Missing userWalletAddress", 400);
  }
  if (!isAddress(userWalletAddress)) {
    return errorResponse("Invalid userWalletAddress", 400);
  }

  const { shuffleDelayMs, feeRecipient, shuffleFeeWei } = getServerEnv();
  await new Promise((resolve) => setTimeout(resolve, shuffleDelayMs));
  const resolved = await resolveGameItemsAddress();
  if (!resolved.address) {
    return errorResponse(
      `Could not resolve GameItemNFT address from GameFactory. ${resolved.error ?? ""}`.trim(),
      500
    );
  }

  const randomItem = getWeightedRandomItem();
  const itemId = crypto.randomUUID();

  const mintedItem = slotItemToMetadata(randomItem, itemId);
  const transfer = createFeeTransferRequest({
    recipient: feeRecipient,
    feeWei: shuffleFeeWei,
  });
  // let feeWei = BigInt(0);
  // try {
  //   feeWei = await estimateShuffleFeeWei({
  //     imagePath: getImagePath(randomItem.name),
  //     metadata: mintedItem,
  //     gamePrivateKey: getGamePrivateKey(),
  //     rpcUrl,
  //   });
  // } catch (err) {
  //   const message = err instanceof Error ? err.message : String(err);
  //   return errorResponse(`Fee estimation failed: ${message}`, 500);
  // }
  tempItemStore.set(itemId, mintedItem);

  return NextResponse.json({
    transfer: {
      ...transfer,
      value: transfer.value.toString(),
    },
    gameItemsAddress: resolved.address,
    itemId: mintedItem.id,
    name: randomItem.name,
    emoji: randomItem.emoji,
    rarity: randomItem.rarity,
    points: randomItem.points,
  });
}

export async function POST(req: Request) {
  let body: { itemId?: string; userWalletAddress?: string; feeTxHash?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const { itemId, userWalletAddress } = body;
  if (!itemId || !userWalletAddress) {
    return errorResponse("Missing itemId or userWalletAddress", 400);
  }
  if (!isAddress(userWalletAddress)) {
    return errorResponse("Invalid userWalletAddress", 400);
  }

  const item = tempItemStore.get(itemId);
  if (!item) {
    return errorResponse("Item not found or expired", 404);
  }

  const { chainId, gameAuthorityAddress } = getServerEnv();
  const resolved = await resolveGameItemsAddress();

  if (!resolved.address) {
    return errorResponse(
      `Could not resolve GameItemNFT address from GameFactory. ${resolved.error ?? ""}`.trim(),
      500
    );
  }
  const authorityValidationError = await validateGameAuthority(
    resolved.address,
    gameAuthorityAddress
  );
  if (authorityValidationError) {
    return errorResponse(authorityValidationError, 400);
  }

  const gamePrivateKey = getGamePrivateKey();
  const metadataUri = encodeMetadataAsBase64DataUri({
    ...item,
    gameAddress: gameAuthorityAddress,
  });
  // const irysPrivateKey = getIrysPrivateKey();
  // let metadataUri: string;
  // try {
  //   let imageUri = uploadedImageUris.get(item.name);
  //   if (!imageUri) {
  //     const uploadedImageUri = await uploadImageAsset(
  //       getImagePath(item.name),
  //       gamePrivateKey,
  //       rpcUrl
  //     );
  //     uploadedImageUris.set(item.name, uploadedImageUri);
  //     imageUri = uploadedImageUri;
  //   }
  //   if (!imageUri) {
  //     throw new Error("Image URI was not resolved");
  //   }
  //   const resolvedImageUri: string = imageUri;
  //
  //   metadataUri = await uploadMetadataAsset(
  //     { ...item, image: resolvedImageUri },
  //     gamePrivateKey,
  //     rpcUrl
  //   );
  // } catch (err) {
  //   const message = err instanceof Error ? err.message : String(err);
  //   return errorResponse(`Irys upload failed: ${message}`, 500);
  // }

  const authorization = await createMintAuthorizationForTokenUri({
    contractAddress: resolved.address,
    gameAuthorityPrivateKey: gamePrivateKey,
    toAddress: userWalletAddress,
    tokenUri: metadataUri,
    chainId,
  });

  tempItemStore.delete(itemId);

  return NextResponse.json({
    ...authorization,
    nonce: authorization.nonce.toString(),
  });
}
