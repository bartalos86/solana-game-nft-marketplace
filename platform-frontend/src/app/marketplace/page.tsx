'use client'

import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { PublicKey } from '@solana/web3.js'
import { Transaction } from '@solana/web3.js'
import { MarketplaceItemBox } from '@/components/game-items/marketplace-item-box'
import { buildBuyNftInstructions } from '@/lib/marketplace-client'
import type { MarketplaceListingResponse } from '@/lib/marketplace'
import { Store, ChevronRight, Gamepad2, Loader2 } from 'lucide-react'

const ITEM_LIMIT_PER_GAME = 12
const CHAIN_UPDATE_DELAY_MS = 5000

interface GameRecord {
  id: string
  name: string
  imageUrl: string | null
  description: string | null
  category: string
  gameUrl: string | null
  solanaPublicKey: string
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
              <div
                key={i}
                className="h-72 w-56 shrink-0 animate-pulse rounded-2xl border border-white/6 bg-white/2"
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function CommonMarketplacePage() {
  const router = useRouter()
  const { connection } = useConnection()
  const wallet = useWallet()

  const [gamesWithListings, setGamesWithListings] = useState<GameWithListings[]>([])
  const [loading, setLoading] = useState(true)
  const [buyingListingId, setBuyingListingId] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const gamesRes = await fetch('/api/games')
      if (!gamesRes.ok) {
        setGamesWithListings([])
        return
      }
      const games = (await gamesRes.json()) as GameRecord[]

      const results: GameWithListings[] = []
      for (const game of games) {
        const listRes = await fetch(
          `/api/games/${encodeURIComponent(game.solanaPublicKey)}/marketplace/listings`
        )
        const listings: MarketplaceListingResponse[] = listRes.ok
          ? ((await listRes.json()) as MarketplaceListingResponse[])
          : []
        const limited = listings.slice(0, ITEM_LIMIT_PER_GAME)
        if (limited.length > 0) {
          results.push({ game, listings: limited })
        }
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
  }, [])

  const handleBuy = async (listing: MarketplaceListingResponse) => {
    if (!wallet.publicKey) return
    setBuyingListingId(listing.publicKey)
    try {
      const buyer = wallet.publicKey
      const seller = new PublicKey(listing.seller)
      const mint = new PublicKey(listing.mint)
      const listingPda = new PublicKey(listing.publicKey)
      const updateAuthorityFeeRecipient = new PublicKey(listing.updateAuthorityFeeRecipient)
      const ixs = await buildBuyNftInstructions({
        connection,
        buyer,
        seller,
        mint,
        listingPda,
        updateAuthorityFeeRecipient,
      })
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
      const tx = new Transaction({ feePayer: buyer }).add(...ixs)
      tx.recentBlockhash = blockhash
      const signed = await wallet.signTransaction!(tx)
      const sig = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      })
      await connection.confirmTransaction(
        { signature: sig, blockhash, lastValidBlockHeight },
        'confirmed'
      )
      await new Promise((r) => setTimeout(r, CHAIN_UPDATE_DELAY_MS))
      await fetchAll()
    } finally {
      setBuyingListingId(null)
    }
  }

  const handleItemClick = (gameAddress: string, mint: string) => {
    router.push(`/games/${gameAddress}/items/${mint}`)
  }

  return (
    <div className="min-h-screen w-full">
      {/* Header */}
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
              <p className="mt-1 text-base text-white/40">
                Browse items from all games. Buy and sell in each game&apos;s marketplace.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-6xl px-4 py-8">
        {!wallet.publicKey && (
          <div className="mb-8 rounded-2xl border border-white/6 bg-white/2 px-6 py-5">
            <p className="text-sm text-white/40">
              Connect your wallet to buy items from the marketplace.
            </p>
          </div>
        )}

        {loading || buyingListingId ? (
          buyingListingId ? (
            <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-white/6 bg-white/2 py-24">
              <Loader2 className="h-12 w-12 animate-spin text-amber-400" />
              <div className="text-center">
                <p className="font-semibold text-white/90">Purchase in progress</p>
                <p className="mt-1 text-sm text-white/50">
                  Confirming on chain… Listings will update when complete.
                </p>
              </div>
            </div>
          ) : (
            <LoadingSkeleton />
          )
        ) : gamesWithListings.length === 0 ? (
          <div className="rounded-2xl border border-white/6 bg-white/2 py-16 text-center">
            <div className="text-5xl opacity-50">🛒</div>
            <h2 className="mt-4 text-xl font-semibold text-white/90">No listings yet</h2>
            <p className="mt-2 text-sm text-white/40">
              When games list items for sale, they will appear here by game.
            </p>
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
                    onClick={() =>
                      router.push(`/games/${game.solanaPublicKey}/marketplace`)
                    }
                    className="flex items-center gap-1 text-sm font-medium text-amber-400/90 transition hover:text-amber-300"
                  >
                    View all
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                <div className="overflow-x-auto overflow-y-hidden pb-2">
                  <div className="flex flex-nowrap gap-4">
                    {listings
                      .filter(
                        (item) =>
                          !wallet.publicKey || item.seller !== wallet.publicKey.toString()
                      )
                      .map((item) => (
                      <div
                        key={item.publicKey}
                        className="w-60 shrink-0"
                      >
                        <MarketplaceItemBox
                          name={item.name}
                          description={item.description}
                          imageUrl={item.imageUrl}
                          priceSol={item.price}
                          sellerAddress={item.seller}
                          variant="listed"
                          onClick={() => handleItemClick(game.solanaPublicKey, item.mint)}
                          onAction={wallet.publicKey ? () => handleBuy(item) : undefined}
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
