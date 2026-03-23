import hardhat from "hardhat";
import { network } from "hardhat";
import {
  currentDeploymentsPath,
  loadPersistentDeployments,
  savePersistentDeployments,
} from "../test/utils/persistentDeployments.js";

type Hash = `0x${string}`;

async function main() {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const wallets = await viem.getWalletClients();
  const deployer = wallets[0]?.account?.address as Hash | undefined;

  if (!deployer) {
    throw new Error("No deployer wallet found");
  }

  const chainId = await publicClient.getChainId();
  const existing = await loadPersistentDeployments("sepolia");
  let marketplace = existing?.marketplace;
  let gameFactory = existing?.gameFactory;

  if (!marketplace) {
    const deployed = await viem.deployContract("NFTMarketplace", [deployer]);
    marketplace = deployed.address as Hash;
    console.log(`Deployed NFTMarketplace: ${marketplace}`);
  } else {
    console.log(`Reusing NFTMarketplace: ${marketplace}`);
  }

  if (!gameFactory) {
    const deployed = await viem.deployContract("GameFactory");
    gameFactory = deployed.address as Hash;
    console.log(`Deployed GameFactory: ${gameFactory}`);
  } else {
    console.log(`Reusing GameFactory: ${gameFactory}`);
  }

  const saved = await savePersistentDeployments("sepolia", Number(chainId), {
    marketplace,
    gameFactory,
  });
  console.log(`Saved deployments to: ${currentDeploymentsPath()}`);
  console.log(saved);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
