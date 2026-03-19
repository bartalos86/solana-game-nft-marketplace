import { deserializeTransaction } from "game-sdk";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  createSignerFromWalletAdapter,
  walletAdapterIdentity,
} from "@metaplex-foundation/umi-signer-wallet-adapters";
import { base58 } from "@metaplex-foundation/umi";
import type { WalletContextState } from "@solana/wallet-adapter-react";
import {
  CLIENT_SLOT_ITEMS,
  type ClientSlotItem,
  type Rarity,
} from "@/config/items";

export interface ShuffleGetResponse {
  transaction: string;
  itemId: string;
  name: string;
  emoji: string;
  rarity: Rarity;
  points: number;
}

export interface ShufflePostResponse {
  transaction: string;
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
  txId: string;
  itemId: string;
  userWalletAddress: string;
}): Promise<ShufflePostResponse> {
  return fetchJson<ShufflePostResponse>("/api/shuffle", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
}

/**
 * Runs the full shuffle flow: fetch fee tx → sign & send → fetch mint tx → sign & send.
 * Returns the final slot item for the given outcome, or null if not found.
 */
export async function runShuffleFlow(
  wallet: WalletContextState,
  endpoint: string
): Promise<{ finalItem: ClientSlotItem | null }> {
  const userWallet = wallet.publicKey?.toBase58();
  if (!userWallet) throw new Error("Wallet not connected");

  const data = await fetchShuffleGet(userWallet);

  const umi = createUmi(endpoint);
  umi.use(walletAdapterIdentity(wallet));

  const feeTransferTransaction = deserializeTransaction(umi, data.transaction);
  const signer = createSignerFromWalletAdapter(wallet);
  const signedFeeTransferTx = await signer.signTransaction(feeTransferTransaction);
  const transferFeeTxId = base58.deserialize(
    await umi.rpc.sendTransaction(signedFeeTransferTx)
  )[0];

  const dataMint = await fetchShufflePost({
    txId: transferFeeTxId,
    itemId: data.itemId,
    userWalletAddress: userWallet,
  });

  const mintTransaction = deserializeTransaction(umi, dataMint.transaction);
  const signedMintTx = await signer.signTransaction(mintTransaction);
  await umi.rpc.sendTransaction(signedMintTx);

  const finalItem =
    CLIENT_SLOT_ITEMS.find((item) => item.name === data.name) ?? null;
  return { finalItem };
}
