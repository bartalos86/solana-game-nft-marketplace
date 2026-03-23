import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type PersistentDeployments = {
  network: string;
  chainId: number;
  marketplace?: `0x${string}`;
  gameFactory?: `0x${string}`;
  updatedAt: string;
};

const DEFAULT_DEPLOYMENTS_FILE = path.resolve(process.cwd(), "deployments", "sepolia.json");

function deploymentsPath(): string {
  return process.env.SEPOLIA_DEPLOYMENTS_FILE?.trim() || DEFAULT_DEPLOYMENTS_FILE;
}

export async function loadPersistentDeployments(expectedNetwork: string): Promise<PersistentDeployments | null> {
  try {
    const raw = await readFile(deploymentsPath(), "utf8");
    const parsed = JSON.parse(raw) as PersistentDeployments;
    if (parsed.network !== expectedNetwork) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function savePersistentDeployments(
  expectedNetwork: string,
  chainId: number,
  next: Partial<PersistentDeployments>,
): Promise<PersistentDeployments> {
  const current = (await loadPersistentDeployments(expectedNetwork)) ?? {
    network: expectedNetwork,
    chainId,
    updatedAt: new Date().toISOString(),
  };
  const merged: PersistentDeployments = {
    ...current,
    ...next,
    network: expectedNetwork,
    chainId,
    updatedAt: new Date().toISOString(),
  };
  const outPath = deploymentsPath();
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(merged, null, 2), "utf8");
  return merged;
}

export function currentDeploymentsPath(): string {
  return deploymentsPath();
}
