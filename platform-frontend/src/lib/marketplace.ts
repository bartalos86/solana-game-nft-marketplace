/**
 * Marketplace program constants and helpers.
 * Uses Metaplex UMI and official mpl-token-metadata PDAs where possible.
 * Listing PDA seeds: ["listing", seller, mint]
 * Program ID matches anchor/programs/marketplace/src/lib.rs declare_id!
 */

import { publicKey, type Context, type PublicKey } from '@metaplex-foundation/umi'
import { findMetadataPda, findMasterEditionPda } from '@metaplex-foundation/mpl-token-metadata'
import { PublicKey as Web3PublicKey } from '@solana/web3.js'

// ─── Constants (UMI PublicKey) ─────────────────────────────────────────────

const MARKETPLACE_PROGRAM_ID_BASE58 = '31vF6b8JkjfCU6nc5V8SpJC9QSxNyqfyKn5EAYRXjN1V'
const MARKETPLACE_FEE_RECIPIENT_BASE58 = '5GLPnCWkDniHq4B7o7K5fsxRKf4xpprX2ENngRs4VGeB'

export const MARKETPLACE_PROGRAM_ID = publicKey(MARKETPLACE_PROGRAM_ID_BASE58)
export const MARKETPLACE_FEE_RECIPIENT = publicKey(MARKETPLACE_FEE_RECIPIENT_BASE58)

/** Anchor account discriminator for ListingAccount */
export const LISTING_ACCOUNT_DISCRIMINATOR = new Uint8Array([59, 89, 136, 25, 21, 196, 183, 13])

export const LISTING_ACCOUNT_SIZE = 8 + 32 + 32 + 8 + 8 + 1 // discriminator + seller + mint + price + expiry + bump

export interface DecodedListing {
  publicKey: string
  seller: string
  mint: string
  price: bigint
  expiry: number
  bump: number
}

/** Decode listing account data from UMI RPC (Uint8Array). */
export function decodeListingAccount(data: Uint8Array, accountPublicKey: string): DecodedListing | null {
  if (data.length < LISTING_ACCOUNT_SIZE) return null
  const disc = data.subarray(0, 8)
  if (!disc.every((b, i) => b === LISTING_ACCOUNT_DISCRIMINATOR[i])) return null
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  return {
    publicKey: accountPublicKey,
    seller: base58Encode(data.subarray(8, 40)),
    mint: base58Encode(data.subarray(40, 72)),
    price: view.getBigUint64(72, true),
    expiry: Number(view.getBigInt64(80, true)),
    bump: data[88]!,
  }
}

function base58Encode(bytes: Uint8Array): string {
  return new Web3PublicKey(bytes).toBase58()
}

/**
 * Derive listing PDA for the marketplace program.
 * Uses web3.js findProgramAddressSync for compatibility with Anchor seeds.
 */
export function getListingPda(seller: PublicKey, mint: PublicKey): PublicKey {
  const sellerB58 = typeof seller === 'string' ? seller : (seller as { toString(): string }).toString()
  const mintB58 = typeof mint === 'string' ? mint : (mint as { toString(): string }).toString()
  const [pda] = Web3PublicKey.findProgramAddressSync(
    [
      Buffer.from('listing'),
      new Web3PublicKey(sellerB58).toBuffer(),
      new Web3PublicKey(mintB58).toBuffer(),
    ],
    new Web3PublicKey(MARKETPLACE_PROGRAM_ID_BASE58)
  )
  return publicKey(pda.toBase58())
}

/**
 * Official Metaplex metadata PDA for a mint.
 */
export function getMetadataPda(context: Pick<Context, 'eddsa' | 'programs'>, mint: PublicKey) {
  return findMetadataPda(context, { mint })
}

/**
 * Official Metaplex master edition PDA for a mint.
 */
export function getMasterEditionPda(context: Pick<Context, 'eddsa' | 'programs'>, mint: PublicKey) {
  return findMasterEditionPda(context, { mint })
}

export function lamportsToSol(lamports: bigint): string {
  return (Number(lamports) / 1e9).toFixed(4)
}

/** Response shape from GET /api/games/[address]/marketplace/listings */
export interface MarketplaceListingResponse {
  publicKey: string
  seller: string
  mint: string
  price: string
  priceLamports: string
  expiry: number
  updateAuthorityFeeRecipient: string
  name: string
  description: string
  imageUrl: string
}
