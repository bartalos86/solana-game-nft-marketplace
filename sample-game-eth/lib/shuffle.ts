import type { Address, Hash, PublicClient, WalletClient } from "viem";
import { GAME_ITEM_NFT_ABI } from "@/lib/eth-mint";
import {
  type ClientSlotItem,
  type Rarity,
} from "@/config/items";

export interface ShuffleGetResponse {
  transfer: {
    to: Address;
    value: string | number | bigint;
  };
  gameItemsAddress: Address;
  itemId: string;
  name: string;
  emoji: string;
  rarity: Rarity;
  points: number;
}

export interface ShufflePostResponse {
  gameAuthority: Address;
  to: Address;
  tokenUri: string;
  nonce: string;
  signature: `0x${string}`;
}

async function fetchJson<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(url, options);
  const data = await res.json();
  if (!res.ok) {
    const message =
      typeof (data as { error?: string }).error === "string"
        ? (data as { error: string }).error
        : "Request failed";
    throw new Error(message);
  }
  return data as T;
}

export function fetchShuffleGet(userWalletAddress: string): Promise<ShuffleGetResponse> {
  return fetchJson<ShuffleGetResponse>(
    `/api/shuffle?userWalletAddress=${encodeURIComponent(userWalletAddress)}`
  );
}

export function fetchShufflePost(params: {
  itemId: string;
  userWalletAddress: string;
}): Promise<ShufflePostResponse> {
  return fetchJson<ShufflePostResponse>("/api/shuffle", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
}

async function waitForReceiptWithRetry(
  publicClient: PublicClient,
  hash: Hash
): Promise<void> {
  // Avoid waitForTransactionReceipt (can throw AbortError on some public RPCs).
  // Poll receipt directly with bounded retries.
  const maxAttempts = 90;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await publicClient.getTransactionReceipt({ hash });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 2_000));
    }
  }
  throw new Error(
    `Timed out while waiting for transaction receipt: ${hash}. Transaction may still finalize on-chain.`
  );
}

/**
 * Runs the full shuffle flow:
 * 1) fetch fee transfer request and send it
 * 2) fetch signed mint authorization
 * 3) submit mintWithSignature from the connected wallet
 * Returns the final slot item for the given outcome, or null if not found.
 */
export async function runShuffleFlow(
  walletClient: WalletClient,
  publicClient: PublicClient,
  userWallet: Address
): Promise<{ finalItem: ClientSlotItem }> {
  const data = await fetchShuffleGet(userWallet);

  const feeValue = BigInt(data.transfer.value);
  if (feeValue > BigInt(0)) {
    const feeTxHash = await walletClient.sendTransaction({
      account: userWallet,
      to: data.transfer.to,
      value: feeValue,
      chain: walletClient.chain,
    });
    await waitForReceiptWithRetry(publicClient, feeTxHash);
  }

  const dataMint = await fetchShufflePost({
    itemId: data.itemId,
    userWalletAddress: userWallet,
  });

  const mintHash = await walletClient.writeContract({
    account: userWallet,
    address: data.gameItemsAddress,
    abi: GAME_ITEM_NFT_ABI,
    functionName: "mintWithSignature",
    args: [
      dataMint.gameAuthority,
      dataMint.to,
      dataMint.tokenUri,
      BigInt(dataMint.nonce),
      dataMint.signature,
    ],
    chain: walletClient.chain,
  });
  await waitForReceiptWithRetry(publicClient, mintHash);

  const finalItem: ClientSlotItem = {
    name: data.name,
    emoji: data.emoji,
    rarity: data.rarity,
    points: data.points,
    // Not used in rendering logic, but keep shape stable.
    description: data.name,
    color: "",
  };
  return { finalItem };
}
