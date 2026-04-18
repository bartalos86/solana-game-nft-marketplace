import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import "dotenv/config";

import { getIrysUploader } from "game-sdk/eth";

const DEFAULT_RPC_URL = "https://ethereum-sepolia-rpc.publicnode.com";
const SAMPLE_ITEM = {
  id: "cost-estimate-item-id",
  name: "Cow",
  image: "https://gateway.irys.xyz/placeholder-image-id",
  description: "A random cow",
  gameAddress: "0x0000000000000000000000000000000000000000",
  attributes: [
    { trait_type: "rarity", value: "common" },
    { trait_type: "points", value: "10" },
    { trait_type: "emoji", value: "🐄" },
  ],
};

function formatWeiAsEth(weiLike) {
  const raw = weiLike.toString();
  let wei;
  if (raw.includes(".")) {
    const [whole, fraction = ""] = raw.split(".");
    const hasRemainder = fraction.split("").some((digit) => digit !== "0");
    wei = BigInt(whole || "0") + (hasRemainder ? BigInt(1) : BigInt(0));
  } else {
    wei = BigInt(raw);
  }
  const base = BigInt("1000000000000000000");
  const whole = wei / base;
  const fraction = (wei % base).toString().padStart(18, "0").slice(0, 8);
  return `${whole.toString()}.${fraction}`;
}

function resolveRpcUrl() {
  const candidates = [
    process.env.IRYS_RPC_URL,
    process.env.RPC_URL,
    process.env.NEXT_PUBLIC_RPC_URL,
    process.env.SEPOLIA_RPC_URL,
  ];
  for (const candidate of candidates) {
    if (candidate && candidate.trim().length > 0) return candidate.trim();
  }
  return DEFAULT_RPC_URL;
}

async function runEstimateForImage(gamePrivateKey, imagePath, label) {
  const { size: imageBytes } = await fs.stat(imagePath);
  assert.ok(imageBytes > 0, "Expected non-empty image file.");

  const metadataJson = JSON.stringify(SAMPLE_ITEM);
  const metadataBytes = Buffer.byteLength(metadataJson, "utf8");
  const totalBytes = imageBytes + metadataBytes;

  const irys = await getIrysUploader(gamePrivateKey, resolveRpcUrl());
  const [imagePriceWei, metadataPriceWei, totalPriceWei] = await Promise.all([
    irys.getPrice(imageBytes),
    irys.getPrice(metadataBytes),
    irys.getPrice(totalBytes),
  ]);

  // Keep parity with SDK estimator that applies 20% overhead buffer.
  const bufferedTotalPriceWei = totalPriceWei.multipliedBy(1.2);

  console.log(`\nIrys cost estimate (${label})`);
  console.table([
    {
      segment: "image",
      bytes: imageBytes,
      priceWei: imagePriceWei.toString(),
      priceEth: formatWeiAsEth(imagePriceWei),
    },
    {
      segment: "metadata",
      bytes: metadataBytes,
      priceWei: metadataPriceWei.toString(),
      priceEth: formatWeiAsEth(metadataPriceWei),
    },
    {
      segment: "combined",
      bytes: totalBytes,
      priceWei: totalPriceWei.toString(),
      priceEth: formatWeiAsEth(totalPriceWei),
    },
    {
      segment: "combined_with_20pct_buffer",
      bytes: totalBytes,
      priceWei: bufferedTotalPriceWei.toString(),
      priceEth: formatWeiAsEth(bufferedTotalPriceWei),
    },
  ]);

  assert.ok(totalPriceWei.gte(imagePriceWei), "Total price should include image price.");
  assert.ok(totalPriceWei.gte(metadataPriceWei), "Total price should include metadata price.");
}

test(
  "estimates Irys cost for one game item image + metadata without uploading",
  { timeout: 60_000 },
  async (t) => {
    const gamePrivateKey = process.env.GAME_ETH_PRIVATE_KEY;
    if (!gamePrivateKey) {
      t.skip("Set GAME_ETH_PRIVATE_KEY to query live Irys pricing.");
      return;
    }

    const imagePath = path.join(process.cwd(), "public", "assets", `${SAMPLE_ITEM.name}.png`);
    await runEstimateForImage(gamePrivateKey, imagePath, "real asset");
  }
);

test(
  "estimates Irys cost for one game item with a synthetic 500KB image",
  { timeout: 60_000 },
  async (t) => {
    const gamePrivateKey = process.env.GAME_ETH_PRIVATE_KEY;
    if (!gamePrivateKey) {
      t.skip("Set GAME_ETH_PRIVATE_KEY to query live Irys pricing.");
      return;
    }

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "irys-500kb-eth-"));
    const tmpImagePath = path.join(tmpDir, "synthetic-500kb.png");
    await fs.writeFile(tmpImagePath, Buffer.alloc(500 * 1024, 1));
    t.after(async () => {
      await fs.rm(tmpDir, { recursive: true, force: true });
    });

    await runEstimateForImage(gamePrivateKey, tmpImagePath, "synthetic 500KB image");
  }
);
