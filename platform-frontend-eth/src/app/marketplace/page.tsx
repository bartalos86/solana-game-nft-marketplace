'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { MarketplaceItemBox } from '@/components/game-items/marketplace-item-box'
import type { MarketplaceListingResponse } from '@/lib/marketplace'
import { Store, ChevronRight, Gamepad2, Loader2 } from 'lucide-react'
import { useEthereum } from '@/components/ethereum/evm-provider'
import { MARKETPLACE_ADDRESS, marketplaceAbi } from '@/lib/eth-contracts'

const ITEM_LIMIT_PER_GAME = 12
const CHAIN_UPDATE_DELAY_MS = 5000

interface GameRecord {
  id: string
  name: string
  imageUrl: string | null
  description: string | null
  category: string
  gameUrl: string | null
  ethereumPublicKey: string
  createdAt: string
}

interface GameWithListings {
  game: GameRecord
  listings: MarketplaceListingResponse[]
}

function LoadingSkeleton() {
  return (
    <div className="space-y-10">
      {[1, 2].map((s) => (
        <div key={s}>
          <div className="mb-4 h-6 w-48 animate-pulse rounded bg-white/10" />
          <div className="flex gap-4 overflow-hidden">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-72 w-56 shrink-0 animate-pulse rounded-2xl border border-white/6 bg-white/2" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function CommonMarketplacePage() {
  const router = useRouter()
  const { walletClient, publicClient, address: walletAddress } = useEthereum()
  const [gamesWithListings, setGamesWithListings] = useState<GameWithListings[]>([])
  const [loading, setLoading] = useState(true)
  const [buyingListingId, setBuyingListingId] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const gamesRes = await fetch('/api/games')
      if (!gamesRes.ok) return setGamesWithListings([])
      const games = (await gamesRes.json()) as GameRecord[]
      const results: GameWithListings[] = []
      for (const game of games) {
        const listRes = await fetch(`/api/games/${encodeURIComponent(game.ethereumPublicKey)}/marketplace/listings`)
        const listings: MarketplaceListingResponse[] = listRes.ok ? ((await listRes.json()) as MarketplaceListingResponse[]) : []
        const limited = listings.slice(0, ITEM_LIMIT_PER_GAME)
        if (limited.length > 0) results.push({ game, listings: limited })
      }
      setGamesWithListings(results)
    } catch {
      setGamesWithListings([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const handleBuy = async (listing: MarketplaceListingResponse) => {
    if (!walletAddress || !walletClient) return
    setBuyingListingId(listing.publicKey)
    try {
      const [account] = await walletClient.getAddresses()
      const hash = await walletClient.writeContract({
        account,
        address: MARKETPLACE_ADDRESS,
        abi: marketplaceAbi,
        functionName: 'buyNFT',
        args: [BigInt(listing.publicKey)],
        value: BigInt(listing.priceLamports),
        chain: walletClient.chain,
      })
      await publicClient.waitForTransactionReceipt({ hash })
      await new Promise((r) => setTimeout(r, CHAIN_UPDATE_DELAY_MS))
      await fetchAll()
    } finally {
      setBuyingListingId(null)
    }
  }

  return (
    <div className="min-h-screen w-full">
      <div className="relative overflow-hidden border-b border-white/6 pb-8 pt-32">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-20 left-1/2 h-[300px] w-[600px] -translate-x-1/2 rounded-full bg-amber-500/8 blur-[80px]" />
        </div>
        <div className="relative mx-auto max-w-6xl px-4">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10">
              <Store className="h-5 w-5 text-amber-400/80" />
            </div>
            <div>
              <h1 className="text-4xl font-bold tracking-tight text-white">Marketplace</h1>
              <p className="mt-1 text-base text-white/40">Browse items from all games.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8">
        {!walletAddress && (
          <div className="mb-8 rounded-2xl border border-white/6 bg-white/2 px-6 py-5">
            <p className="text-sm text-white/40">Connect your wallet to buy items from the marketplace.</p>
          </div>
        )}

        {loading || buyingListingId ? (
          buyingListingId ? (
            <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-white/6 bg-white/2 py-24">
              <Loader2 className="h-12 w-12 animate-spin text-amber-400" />
              <p className="text-sm text-white/60">Confirming on chain...</p>
            </div>
          ) : (
            <LoadingSkeleton />
          )
        ) : gamesWithListings.length === 0 ? (
          <div className="rounded-2xl border border-white/6 bg-white/2 py-16 text-center">
            <h2 className="mt-4 text-xl font-semibold text-white/90">No listings yet</h2>
          </div>
        ) : (
          <div className="space-y-12">
            {gamesWithListings.map(({ game, listings }) => (
              <section key={game.id}>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-lg font-semibold text-white/90">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5">
                      <Gamepad2 className="h-4 w-4 text-white/70" />
                    </span>
                    {game.name}
                  </h2>
                  <button
                    type="button"
                    onClick={() => router.push(`/games/${game.ethereumPublicKey}/marketplace`)}
                    className="flex items-center gap-1 text-sm font-medium text-amber-400/90 transition hover:text-amber-300"
                  >
                    View all
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                <div className="overflow-x-auto overflow-y-hidden pb-2">
                  <div className="flex flex-nowrap gap-4">
                    {listings
                      .filter((item) => !walletAddress || item.seller.toLowerCase() !== walletAddress.toLowerCase())
                      .map((item) => (
                        <div key={item.publicKey} className="w-60 shrink-0">
                          <MarketplaceItemBox
                            name={item.name}
                            description={item.description}
                            imageUrl={item.imageUrl}
                            priceSol={item.price}
                            sellerAddress={item.seller}
                            variant="listed"
                            onClick={() => router.push(`/games/${game.ethereumPublicKey}/items/${item.mint}`)}
                            onAction={walletAddress ? () => handleBuy(item) : undefined}
                            actionLabel="Buy now"
                            actionLoading={buyingListingId === item.publicKey}
                          />
                        </div>
                      ))}
                  </div>
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

