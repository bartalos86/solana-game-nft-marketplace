import { mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata"
import { base58 } from "@metaplex-foundation/umi"
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults"

export function createDevnetUmi() {
  return createUmi('https://api.devnet.solana.com').use(mplTokenMetadata())
}

export function generateNewKeyPair() {
  return createDevnetUmi().eddsa.generateKeypair()
}

export function generateKeyPairFromSeed(seed: string){
  const seedDeserialized = base58.serialize(seed)
  return createDevnetUmi().eddsa.createKeypairFromSeed(seedDeserialized)
}