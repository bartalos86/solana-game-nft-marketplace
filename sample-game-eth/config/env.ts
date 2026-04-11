/**
 * Centralized env config. Server-only vars (no NEXT_PUBLIC_) are for API/server only.
 * Uses dotenv to load .env when this module is imported early.
 */
import "dotenv/config";
import { getAddress, type Address } from "viem";

function env(key: string): string;
function env(key: string, fallback: string): string;
function env(key: string, fallback?: string): string {
  const v = process.env[key]?.trim().replace(/^['"]|['"]$/g, "");
  if (fallback === undefined) {
    if (!v) throw new Error(`Missing required env: ${key}`);
    return v;
  }
  return v || fallback;
}

const DEFAULT_RPC_URL = "https://rpc.sepolia.org";
const DEFAULT_RPC_URLS = [
  "https://ethereum-sepolia-rpc.publicnode.com",
  "https://rpc.sepolia.org",
];
const DEFAULT_CHAIN_ID = 11155111;

function normalizeAddress(value: string): Address {
  const trimmed = value.trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
    throw new Error(`Invalid Ethereum address: ${value}`);
  }
  return getAddress(trimmed.toLowerCase() as Address);
}

function optionalAddress(key: string): Address | "" {
  const raw = env(key, "");
  if (!raw) return "";
  return normalizeAddress(raw);
}

function normalizeToHttpRpcUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("wss://")) return `https://${trimmed.slice(6)}`;
  if (trimmed.startsWith("ws://")) return `http://${trimmed.slice(5)}`;
  return trimmed;
}

function parseRpcList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((part) => normalizeToHttpRpcUrl(part))
    .filter(Boolean);
}

export function getRpcUrls(): string[] {
  const fromEnv = [
    ...parseRpcList(process.env.NEXT_PUBLIC_RPC_URL),
    ...parseRpcList(process.env.RPC_URL),
    ...parseRpcList(process.env.SEPOLIA_RPC_URL),
  ];
  return Array.from(new Set([...fromEnv, ...DEFAULT_RPC_URLS]));
}

export function getClientEnv() {
  const rpcUrls = getRpcUrls();
  return {
    rpcUrl: rpcUrls[0] ?? DEFAULT_RPC_URL,
    rpcUrls,
    chainId: Number(env("NEXT_PUBLIC_CHAIN_ID", String(DEFAULT_CHAIN_ID))),
    gameFactoryAddress: optionalAddress("NEXT_PUBLIC_GAME_FACTORY_ADDRESS"),
  };
}

/**
 * Server env used by game-casino API (e.g. shuffle route).
 */
export function getServerEnv() {
  const client = getClientEnv();
  return {
    rpcUrl: client.rpcUrl,
    gameFactoryAddress: client.gameFactoryAddress,
    chainId: client.chainId,
    gamePrivateKeyRaw: env("GAME_ETH_PRIVATE_KEY"),
    irysPrivateKeyRaw: env("IRYS_ETH_PRIVATE_KEY", env("GAME_ETH_PRIVATE_KEY")),
    gameAuthorityAddress: normalizeAddress(env("GAME_ETH_PUBLIC_KEY")),
    feeRecipient: normalizeAddress(env("GAME_FEE_RECIPIENT", env("GAME_ETH_PUBLIC_KEY"))),
    shuffleFeeWei: BigInt(env("SHUFFLE_FEE_WEI", "0")),
    shuffleDelayMs: Math.max(0, parseInt(env("SHUFFLE_DELAY_MS", "500"), 10) || 500),
  };
}
