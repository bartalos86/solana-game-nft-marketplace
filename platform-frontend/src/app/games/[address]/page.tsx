'use client'

import { NFTItemsFilter } from '@/components/game-items/game-items-filter'
import { NFTItem, NFTItemsGrid } from '@/components/game-items/game-items-grid'
import { useWallet } from '@solana/wallet-adapter-react'
import { usePathname, useRouter, useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { fromWeb3JsPublicKey } from '@metaplex-foundation/umi-web3js-adapters'
import { getAssetsByOwnerWithMetadata } from 'game-sdk'
import { publicKey } from '@metaplex-foundation/umi'
import Link from 'next/link'
import { Store } from 'lucide-react'

/** On-chain game from game_registry (DecodedGame). */
interface OnChainGameInfo {
  publicKey: string
  authority: string
  name: string
  description: string
  imageUri: string
  uri: string
  category: string
  feeRecipient: string
  bump: number
}

export default function GameDetailPage() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useParams()
  const address = typeof params?.address === 'string' ? params.address : ''

  const [gameInfo, setGameInfo] = useState<OnChainGameInfo | null>(null)
  const [gameError, setGameError] = useState<string | null>(null)
  const [selectedRarity, setSelectedRarity] = useState('All')
  const [selectedPriceRange, setSelectedPriceRange] = useState('All')
  const [items, setItems] = useState<NFTItem[]>([])

  const wallet = useWallet()

  useEffect(() => {
    if (!address) return
    let cancelled = false
    setGameError(null)
    fetch(`/api/onchain/games/${encodeURIComponent(address)}`)
      .then((res) => {
        if (!res.ok && res.status === 404) return null
        if (!res.ok) throw new Error('Failed to load game')
        return res.json()
      })
      .then((data: OnChainGameInfo | null) => {
        if (cancelled) return
        if (data?.authority != null) {
          setGameInfo(data)
        } else {
          setGameError('Game not found')
          setGameInfo(null)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setGameError('Failed to load game')
          setGameInfo(null)
        }
      })
    return () => { cancelled = true }
  }, [address])

  useEffect(() => {
    if (!wallet.publicKey || !address) return
    const metaplexUserPublicKey = fromWeb3JsPublicKey(wallet.publicKey)
    const gamePubkey = publicKey(address)
    getAssetsByOwnerWithMetadata(metaplexUserPublicKey, gamePubkey)
      .then((assets) => {
        setItems(
          assets.map((a) => ({
            id: a.mintAddress.toString(),
            name: a.metadata.name ?? '',
            imageUrl: a.metadata.image ?? '',
            description: a.metadata.description ?? '',
            attributes: (a.metadata.attributes ?? []) as [],
            rarity: 'common' as const,
            level: 0,
            price: '0',
            owner: '',
            isListed: false,
          }))
        )
      })
      .catch(() => setItems([]))
  }, [wallet.publicKey, address])

  const handleItemClick = (itemId: string) => {
    router.push(`${pathname}/items/${itemId}`)
  }

  const gameName = gameInfo?.name ?? 'Game'
  const gameDescription = gameInfo?.description?.trim() || 'Discover unique game items, weapons, and collectibles.'
  const loadingGame = address && gameInfo === null && gameError === null

  if (loadingGame) {
    return (
      <div className="min-h-screen w-full pt-32">
        <div className="mx-auto max-w-6xl px-4 py-12 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-blue-400" />
        </div>
      </div>
    )
  }

  if (gameError && !gameInfo) {
    return (
      <div className="min-h-screen w-full pt-32">
        <div className="mx-auto max-w-6xl px-4 py-12 text-center">
          <h1 className="text-2xl font-semibold text-white">Game not found</h1>
          <p className="mt-2 text-white/50">
            No on-chain game is registered for this address (authority).
          </p>
          <Link
            href="/games"
            className="mt-6 inline-block rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/90 transition hover:bg-white/10"
          >
            Back to games
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full">
      {/* Header */}
      <div className="relative overflow-hidden border-b border-white/6 pb-8 pt-32">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-20 left-1/2 h-[300px] w-[600px] -translate-x-1/2 rounded-full bg-indigo-600/8 blur-[80px]" />
        </div>
        <div className="relative mx-auto max-w-6xl px-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              {gameInfo?.category && (
                <span className="mb-2 inline-block rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-0.5 text-xs font-medium text-blue-300/80">
                  {gameInfo.category}
                </span>
              )}
              <h1 className="text-4xl font-bold tracking-tight text-white">{gameName}</h1>
              <p className="mt-2 text-base text-white/40">{gameDescription}</p>
            </div>
            <Link
              href={`/games/${address}/marketplace`}
              className="flex shrink-0 items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/90 transition hover:bg-white/10 hover:text-white"
            >
              <Store className="h-4 w-4" />
              Marketplace
            </Link>
          </div>
          <iframe
            className="mt-8 w-full max-w-4xl h-165 rounded-2xl border border-white/8 bg-black/20"
            src="http://localhost:3001"
            title="Game"
          />
        </div>
      </div>

      {/* Items */}
      <div className="mx-auto max-w-6xl px-4 py-8">
        <NFTItemsFilter
          selectedRarity={selectedRarity}
          selectedPriceRange={selectedPriceRange}
          onRarityChange={setSelectedRarity}
          onPriceRangeChange={setSelectedPriceRange}
        />

        <NFTItemsGrid items={items} onItemClick={handleItemClick} />
      </div>
    </div>
  )
}
