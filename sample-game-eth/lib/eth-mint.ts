import type { Address, Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { randomBytes } from "node:crypto";

export interface ItemAttribute {
  trait_type: string;
  value: string;
}

export interface ItemMetadata {
  id: string;
  name: string;
  image: string;
  description: string;
  gameAddress: string;
  attributes: ItemAttribute[] | unknown;
}

export const GAME_ITEM_NFT_ABI = [
  {
    name: "mintWithSignature",
    type: "function",
    inputs: [
      { name: "gameAuthority", type: "address" },
      { name: "to", type: "address" },
      { name: "tokenUri", type: "string" },
      { name: "nonce", type: "uint256" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [{ type: "uint256" }],
    stateMutability: "nonpayable",
  },
] as const;

export type MintAuthorization = {
  gameAuthority: Address;
  to: Address;
  tokenUri: string;
  nonce: bigint;
  signature: Hex;
};

export function createFeeTransferRequest(params: {
  recipient: Address;
  feeWei: bigint;
}) {
  return {
    to: params.recipient,
    value: params.feeWei,
  };
}

function metadataToDataUri(metadata: ItemMetadata): string {
  const json = JSON.stringify(metadata);
  const base64 = Buffer.from(json, "utf8").toString("base64");
  return `data:application/json;base64,${base64}`;
}

function createNonce(): bigint {
  const bytes = randomBytes(16);
  let hex = "0x";
  for (const byte of bytes) hex += byte.toString(16).padStart(2, "0");
  return BigInt(hex);
}

export async function createMintAuthorization(params: {
  contractAddress: Address;
  gameAuthorityPrivateKey: `0x${string}`;
  toAddress: Address;
  metadata: ItemMetadata;
  chainId: number;
  nonce?: bigint;
}): Promise<MintAuthorization> {
  const account = privateKeyToAccount(params.gameAuthorityPrivateKey);
  const tokenUri = metadataToDataUri({
    ...params.metadata,
    gameAddress: account.address,
  });
  return createMintAuthorizationForTokenUri({
    contractAddress: params.contractAddress,
    gameAuthorityPrivateKey: params.gameAuthorityPrivateKey,
    toAddress: params.toAddress,
    tokenUri,
    chainId: params.chainId,
    nonce: params.nonce,
  });
}

export async function createMintAuthorizationForTokenUri(params: {
  contractAddress: Address;
  gameAuthorityPrivateKey: `0x${string}`;
  toAddress: Address;
  tokenUri: string;
  chainId: number;
  nonce?: bigint;
}): Promise<MintAuthorization> {
  const account = privateKeyToAccount(params.gameAuthorityPrivateKey);
  const nonce = params.nonce ?? createNonce();

  const signature = await account.signTypedData({
    domain: {
      name: "GameItemNFT",
      version: "1",
      chainId: params.chainId,
      verifyingContract: params.contractAddress,
    },
    primaryType: "Mint",
    types: {
      Mint: [
        { name: "gameAuthority", type: "address" },
        { name: "to", type: "address" },
        { name: "uri", type: "string" },
        { name: "amount", type: "uint256" },
        { name: "nonce", type: "uint256" },
      ],
    },
    message: {
      gameAuthority: account.address,
      to: params.toAddress,
      uri: params.tokenUri,
      amount: BigInt(1),
      nonce,
    },
  });

  return {
    gameAuthority: account.address,
    to: params.toAddress,
    tokenUri: params.tokenUri,
    nonce,
    signature,
  };
}
