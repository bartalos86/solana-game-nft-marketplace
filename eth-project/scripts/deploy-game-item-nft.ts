// scripts/deploy-game-item-nft.ts
import hre from "hardhat";

async function main() {
  const [deployer] = await hre.network.getSigners();

  const contract = await hre.viem.deployContract("GameItemNFT", [
    "My Game Items",   // name
    "MGIT",            // symbol
    deployer.account.address, // gameAuthority (owner, can mint)
    550,               // royaltyBps — 5.5%, same as your sellerFeeBasisPoints(5.5)
  ]);

  console.log("GameItemNFT deployed to:", contract.address);
}

main().catch(console.error);