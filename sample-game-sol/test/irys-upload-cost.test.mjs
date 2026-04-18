import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import "dotenv/config";
import { estimateIrysUploadCost } from "game-sdk/server";

const SAMPLE_ITEM = {
  id: "cost-estimate-item-id",
  name: "Cow",
  image: "https://gateway.irys.xyz/placeholder-image-id",
  description: "A random cow",
  gameAddress: "",
  attributes: [
    { trait_type: "rarity", value: "common" },
    { trait_type: "points", value: "10" },
    { trait_type: "emoji", value: "🐄" },
  ],
};

function base64ToSolanaSecretKey(base64) {
  const normalized = base64.replace(/\s/g, "").trim();
  const bytes = new Uint8Array(Buffer.from(normalized, "base64"));
  if (bytes.length !== 64) {
    throw new Error(
      `GAME_PRIVATE_KEY must be base64-encoded 64-byte Solana keypair secret (got ${bytes.length} bytes).`
    );
  }
  return bytes;
}

function ceilToIntegerString(valueLike) {
  const raw = valueLike.toString();
  if (!raw.includes(".")) return raw;
  const [whole, fraction = ""] = raw.split(".");
  const hasRemainder = fraction.split("").some((digit) => digit !== "0");
  const wholeBigInt = BigInt(whole || "0");
  return (wholeBigInt + (hasRemainder ? BigInt(1) : BigInt(0))).toString();
}

function formatLamportsAsSol(lamportsLike) {
  const lamports = BigInt(ceilToIntegerString(lamportsLike));
  const base = BigInt("1000000000");
  const whole = lamports / base;
  const fraction = (lamports % base).toString().padStart(9, "0").slice(0, 6);
  return `${whole.toString()}.${fraction}`;
}

async function runEstimateForImage(gamePrivateKey, imagePath, label) {
  const estimate = await estimateIrysUploadCost(imagePath, SAMPLE_ITEM, {
    gamePrivateKey,
  });

  console.log(`\nIrys cost estimate (${label})`);
  console.table([
    {
      segment: "image",
      bytes: estimate.imageBytes,
      priceLamports: ceilToIntegerString(estimate.imagePrice),
      priceSOL: formatLamportsAsSol(estimate.imagePrice),
    },
    {
      segment: "metadata",
      bytes: estimate.metadataBytes,
      priceLamports: ceilToIntegerString(estimate.metadataPrice),
      priceSOL: formatLamportsAsSol(estimate.metadataPrice),
    },
    {
      segment: "combined",
      bytes: estimate.totalBytes,
      priceLamports: ceilToIntegerString(estimate.combinedPrice),
      priceSOL: formatLamportsAsSol(estimate.combinedPrice),
    },
    {
      segment: `combined_with_${estimate.multiplier}x_buffer`,
      bytes: estimate.totalBytes,
      priceLamports: ceilToIntegerString(estimate.bufferedCombinedPrice),
      priceSOL: formatLamportsAsSol(estimate.bufferedCombinedPrice),
    },
  ]);

  assert.ok(estimate.totalBytes > estimate.imageBytes);
  assert.ok(estimate.combinedPrice.gte(estimate.imagePrice));
  assert.ok(estimate.combinedPrice.gte(estimate.metadataPrice));
}

test(
  "estimates Solana Irys cost for one game item image + metadata without uploading",
  { timeout: 60_000 },
  async (t) => {
    const gamePrivateKeyRaw = process.env.GAME_PRIVATE_KEY;
    if (!gamePrivateKeyRaw) {
      t.skip("Set GAME_PRIVATE_KEY to query live Irys pricing.");
      return;
    }

    const gamePrivateKey = base64ToSolanaSecretKey(gamePrivateKeyRaw);
    const imagePath = path.join(process.cwd(), "public", "assets", `${SAMPLE_ITEM.name}.png`);
    await runEstimateForImage(gamePrivateKey, imagePath, "real asset");
  }
);

test(
  "estimates Solana Irys cost for one game item with a synthetic 500KB image",
  { timeout: 60_000 },
  async (t) => {
    const gamePrivateKeyRaw = process.env.GAME_PRIVATE_KEY;
    if (!gamePrivateKeyRaw) {
      t.skip("Set GAME_PRIVATE_KEY to query live Irys pricing.");
      return;
    }

    const gamePrivateKey = base64ToSolanaSecretKey(gamePrivateKeyRaw);
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "irys-500kb-sol-"));
    const tmpImagePath = path.join(tmpDir, "synthetic-500kb.png");
    await fs.writeFile(tmpImagePath, Buffer.alloc(500 * 1024, 1));
    t.after(async () => {
      await fs.rm(tmpDir, { recursive: true, force: true });
    });

    await runEstimateForImage(gamePrivateKey, tmpImagePath, "synthetic 500KB image");
  }
);
