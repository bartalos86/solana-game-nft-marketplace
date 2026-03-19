/**
 * Shared UMI instance factory for marketplace and Metaplex usage.
 * Use this instead of raw web3.js Connection for fetching accounts and metadata.
 */

import { createUmi } from '@metaplex-foundation/umi-bundle-defaults'
import { mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata'

/**
 * Create a UMI instance with Token Metadata plugin for the given RPC endpoint.
 * Use for server (API routes) and client (with cluster endpoint).
 */
export function createMarketplaceUmi(rpcUrl: string) {
  return createUmi(rpcUrl).use(mplTokenMetadata())
}
