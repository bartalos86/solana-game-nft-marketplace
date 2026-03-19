import { getServerEnv } from "@/config/env";

/**
 * Returns the game keypair secret key from env (server-only).
 * Used by the shuffle API route for signing mint transactions.
 */
export function getGamePrivateKey(): Uint8Array {
  const raw = getServerEnv().gamePrivateKeyRaw;
  return base64ToSolanaSecretKey(raw);
}
/** Decode base64-encoded Solana secret key back to Uint8Array. Use Array.from(result) for number[]. */
function base64ToSolanaSecretKey(base64: string): Uint8Array {
  const normalized = base64.replace(/\s/g, "").trim();
  let bytes: Uint8Array;
  if (typeof Buffer !== "undefined") {
    bytes = new Uint8Array(Buffer.from(normalized, "base64"));
  } else {
    const binary = typeof atob !== "undefined" ? atob(normalized) : "";
    bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
  }
  if (bytes.length !== 64) {
    throw new Error(
      `GAME_PRIVATE_KEY must be base64-encoded 64-byte Solana keypair secret (got ${bytes.length} bytes). ` +
        "Use the Solana private key (base64) from the games register page."
    );
  }
  return bytes;
}