import { NextResponse } from 'next/server'
import { formatEther, getAddress, zeroAddress } from 'viem'
import { firstZodMessage } from '@/lib/zod'
import { gameAddressParamsSchema, type GameAddressParams } from '@/lib/validations/games'
import {
  GAME_FACTORY_ADDRESS,
  MARKETPLACE_ADDRESS,
  createEthPublicClient,
  gameFactoryAbi,
  gameItemAbi,
  marketplaceAbi,
  type MarketplaceListingResponse,
} from '@/lib/marketplace'

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
    const client = createEthPublicClient()
    const gameItemsAddress = await client.readContract({
      address: GAME_FACTORY_ADDRESS,
      abi: gameFactoryAbi,
      functionName: 'gameItems',
    })
    const listingCounter = await client.readContract({
      address: MARKETPLACE_ADDRESS,
      abi: marketplaceAbi,
      functionName: 'listingCounter',
    })
    const now = Math.floor(Date.now() / 1000)
    const listingsWithMetadata: MarketplaceListingResponse[] = []
    for (let i = 0n; i < listingCounter; i++) {
      const listing = (await client.readContract({
        address: MARKETPLACE_ADDRESS,
        abi: marketplaceAbi,
        functionName: 'listings',
        args: [i],
      })) as readonly [`0x${string}`, `0x${string}`, bigint, bigint, bigint, bigint]
      const [seller, nftAddress, tokenId, , priceWei, expiry] = listing
      if (seller === zeroAddress) continue
      if (Number(expiry) < now) continue
      if (getAddress(nftAddress) !== getAddress(gameItemsAddress)) continue

      const tokenGameAuthority = await client.readContract({
        address: gameItemsAddress,
        abi: gameItemAbi,
        functionName: 'tokenGameAuthority',
        args: [tokenId],
      })
      if (getAddress(tokenGameAuthority) !== getAddress(gameAddress)) continue

      let name = 'Unnamed'
      let description = ''
      let imageUrl = ''
      const tokenUri = await client.readContract({
        address: gameItemsAddress,
        abi: gameItemAbi,
        functionName: 'uri',
        args: [tokenId],
      })
      if (tokenUri) {
        try {
          const uri = tokenUri.startsWith('ipfs://')
            ? tokenUri.replace('ipfs://', 'https://ipfs.io/ipfs/')
            : tokenUri
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
        publicKey: i.toString(),
        seller,
        mint: tokenId.toString(),
        price: formatEther(priceWei),
        priceLamports: priceWei.toString(),
        expiry: Number(expiry),
        updateAuthorityFeeRecipient: gameAddress,
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
