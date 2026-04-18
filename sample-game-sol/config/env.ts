/**
 * Centralized env config. Server-only vars (no NEXT_PUBLIC_) are for API/server only.
 * Uses dotenv to load .env when this module is imported early.
 */
import "dotenv/config";

function env(key: string): string;
function env(key: string, fallback: string): string;
function env(key: string, fallback?: string): string {
  const v = process.env[key]?.trim();
  if (fallback === undefined) {
    if (!v) throw new Error(`Missing required env: ${key}`);
    return v;
  }
  return v || fallback;
}

const RPC_URL = "https://api.devnet.solana.com";
export const DEFAULT_CLUSTER = "devnet" as const;
export type Cluster = "devnet" | "testnet" | "mainnet-beta" | "localnet";

export function getClientEnv() {
  return {
    solanaRpcUrl: env("NEXT_PUBLIC_SOLANA_RPC_URL", RPC_URL),
    defaultCluster: (env("NEXT_PUBLIC_DEFAULT_CLUSTER", DEFAULT_CLUSTER) as Cluster) || DEFAULT_CLUSTER,
  };
}

/**
 * Server env used by game-casino API (e.g. shuffle route).
 * GAME_PRIVATE_KEY: base64-encoded Solana keypair secret (64 bytes), as from platform-frontend games register page.
 * GAME_PUBLIC_KEY: Solana wallet address (base58) for the same keypair.
 */
export function getServerEnv() {
  return {
    gamePrivateKeyRaw: env("GAME_PRIVATE_KEY"),
    gameWalletAddress: env("GAME_PUBLIC_KEY"),
    itemImageFilename: env("ITEM_IMAGE_FILENAME", "lemon.png"),
    shuffleDelayMs: Math.max(0, parseInt(env("SHUFFLE_DELAY_MS", "500"), 10) || 500),
  };
}
