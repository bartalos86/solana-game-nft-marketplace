import { getServerEnv } from "@/config/env";
import type { Address } from "viem";

/**
 * Returns the game authority private key from env (server-only).
 * Used by the shuffle API route for signing mint authorizations.
 */
export function getGamePrivateKey(): `0x${string}` {
  const raw = getServerEnv().gamePrivateKeyRaw;
  return normalizePrivateKey(raw, "GAME_ETH_PRIVATE_KEY");
}

/**
 * Returns the private key used for Irys uploads.
 * Defaults to GAME_ETH_PRIVATE_KEY if IRYS_ETH_PRIVATE_KEY is not set.
 */
export function getIrysPrivateKey(): `0x${string}` {
  const raw = getServerEnv().irysPrivateKeyRaw;
  return normalizePrivateKey(raw, "IRYS_ETH_PRIVATE_KEY");
}

export function getGameAuthorityAddress(): Address {
  return getServerEnv().gameAuthorityAddress;
}

function normalizePrivateKey(raw: string, envName: string): `0x${string}` {
  const normalized = raw.trim().replace(/^['"]|['"]$/g, "");
  const withPrefix = normalized.startsWith("0x") ? normalized : `0x${normalized}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(withPrefix)) {
    throw new Error(
      `${envName} must be a 32-byte hex key (64 hex chars), with optional 0x prefix.`
    );
  }
  return withPrefix as `0x${string}`;
}