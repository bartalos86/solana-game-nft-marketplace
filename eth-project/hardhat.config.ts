// import "@openzeppelin/hardhat-upgrades";
import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import { defineConfig } from "hardhat/config";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function loadEnvFile(filePath: string): void {
  if (!existsSync(filePath)) return;
  const content = readFileSync(filePath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(path.resolve(process.cwd(), ".env"));

function normalizeHttpRpcUrl(url?: string): string {
  const raw = (url ?? "").trim();
  if (!raw) return "";
  if (raw.startsWith("https://") || raw.startsWith("http://")) return raw;
  if (raw.startsWith("wss://")) return `https://${raw.slice("wss://".length)}`;
  if (raw.startsWith("ws://")) return `http://${raw.slice("ws://".length)}`;
  return raw;
}

const sepoliaRpcUrl = normalizeHttpRpcUrl(process.env.SEPOLIA_RPC_URL);
const sepoliaPrivateKey = (process.env.SEPOLIA_PRIVATE_KEY ?? "").trim();

export default defineConfig({
  plugins: [hardhatToolboxViemPlugin],
  solidity: {
    profiles: {
      default: {
        version: "0.8.28",
      },
      production: {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    },
  },
  networks: {
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1",
    },
    hardhatOp: {
      type: "edr-simulated",
      chainType: "op",
    },
    sepolia: {
      type: "http",
      chainType: "l1",
      url: sepoliaRpcUrl,
      accounts: sepoliaPrivateKey ? [sepoliaPrivateKey] : [],
      gas: 12_000_000,
      gasMultiplier: 2,
    },
  },
});
