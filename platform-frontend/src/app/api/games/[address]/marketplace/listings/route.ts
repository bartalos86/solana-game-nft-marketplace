import { NextResponse } from 'next/server'
import { publicKey } from '@metaplex-foundation/umi'
import { fetchDigitalAsset } from '@metaplex-foundation/mpl-token-metadata'
import { PublicKey } from '@solana/web3.js'
import { createMarketplaceUmi } from '@/lib/umi'
import { firstZodMessage } from '@/lib/zod'
import { fetchGameByAuthority } from '@/lib/game-registry-anchor'
import { gameAddressParamsSchema, type GameAddressParams } from '@/lib/validations/games'
import {
  MARKETPLACE_PROGRAM_ID,
  LISTING_ACCOUNT_SIZE,
  LISTING_ACCOUNT_DISCRIMINATOR,
  decodeListingAccount,
  lamportsToSol,
  type DecodedListing,
  type MarketplaceListingResponse,
} from '@/lib/marketplace'

const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC ?? 'https://api.devnet.solana.com'

export type { MarketplaceListingResponse }

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ address?: string }> }
) {
  try {
    const parsed = gameAddressParamsSchema.safeParse(await params)
    if (!parsed.success) {
      return NextResponse.json(
        { error: firstZodMessage(parsed.error, 'address required') },
        { status: 400 }
      )
    }
    const { address: gameAddress } = parsed.data as GameAddressParams
    const umi = createMarketplaceUmi(RPC)
    const acceptedUpdateAuthorities = new Set<string>([gameAddress])
    try {
      // URLs currently use game authority; listed NFTs are minted with game PDA as update authority.
      const game = await fetchGameByAuthority(new PublicKey(gameAddress))
      if (game?.publicKey) acceptedUpdateAuthorities.add(game.publicKey)
    } catch {
      // If address is not an authority or cannot be resolved, fall back to direct address match.
    }

    const accounts = await umi.rpc.getProgramAccounts(MARKETPLACE_PROGRAM_ID, {
      dataSlice: { offset: 0, length: LISTING_ACCOUNT_SIZE },
      filters: [{ dataSize: LISTING_ACCOUNT_SIZE }],
    })

    const now = Math.floor(Date.now() / 1000)
    const decoded: DecodedListing[] = []
    for (const account of accounts) {
      const data = account.data
      if (data.length < LISTING_ACCOUNT_SIZE) continue
      if (!data.subarray(0, 8).every((b, i) => b === LISTING_ACCOUNT_DISCRIMINATOR[i])) continue
      const listing = decodeListingAccount(data, account.publicKey.toString())
      if (!listing || listing.expiry < now) continue
      decoded.push(listing)
    }

    const listingsWithMetadata: MarketplaceListingResponse[] = []

    for (const listing of decoded) {
      const mintPubkey = publicKey(listing.mint)
      let asset
      try {
        asset = await fetchDigitalAsset(umi, mintPubkey)
      } catch {
        continue
      }
      if (!acceptedUpdateAuthorities.has(asset.metadata.updateAuthority.toString())) continue

      let name = 'Unnamed'
      let description = ''
      let imageUrl = ''
      const uri = asset.metadata.uri
      if (uri) {
        try {
          const res = await fetch(uri)
          const json = (await res.json()) as Record<string, unknown>
          if (typeof json.name === 'string') name = json.name
          if (typeof json.description === 'string') description = json.description
          if (typeof json.image === 'string') imageUrl = json.image
        } catch {
          // keep defaults
        }
      }

      listingsWithMetadata.push({
        publicKey: listing.publicKey,
        seller: listing.seller,
        mint: listing.mint,
        price: lamportsToSol(listing.price),
        priceLamports: listing.price.toString(),
        expiry: listing.expiry,
        updateAuthorityFeeRecipient: asset.metadata.updateAuthority.toString(),
        name,
        description,
        imageUrl,
      })
    }

    return NextResponse.json(listingsWithMetadata)
  } catch (e) {
    console.error('GET /api/games/[address]/marketplace/listings', e)
    return NextResponse.json(
      { error: 'Failed to fetch marketplace listings' },
      { status: 500 }
    )
  }
}
