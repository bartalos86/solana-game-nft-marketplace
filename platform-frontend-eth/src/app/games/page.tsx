'use client'

import { GameCategoryFilter } from '@/components/games/game-category-filter'
import { GamesGrid } from '@/components/games/games-grid'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, Gamepad2 } from 'lucide-react'

const CATEGORIES = ['Action', 'RPG', 'Strategy', 'Racing', 'Adventure', 'Other']

/** On-chain game from game_registry program (DecodedGame). */
interface OnChainGame {
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

function toGridGame(g: OnChainGame) {
  return {
    id: g.authority,
    title: g.name,
    description: g.description ?? '',
    imageUrl: g.imageUri ?? '',
    itemCount: 0,
    rating: 0,
    price: '0',
    category: g.category || 'Other',
    isFeatured: false,
  }
}

export default function GamesPage() {
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [games, setGames] = useState<ReturnType<typeof toGridGame>[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/onchain/games')
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        if (Array.isArray(data)) {
          setGames(data.map((g: OnChainGame) => toGridGame(g)))
        } else if (data?.error) {
          setError(data.error)
        } else {
          setError('Failed to load games')
        }
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load games')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const filteredGames =
    selectedCategory === 'all'
      ? games
      : games.filter((g) => g.category === selectedCategory)

  return (
    <div className="min-h-screen w-full">
      {/* Page header with gradient top */}
      <div className="relative overflow-hidden border-b border-white/6 pb-10 pt-32">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-20 left-1/2 h-[400px] w-[800px] -translate-x-1/2 rounded-full bg-blue-600/8 blur-[100px]" />
        </div>
        <div className="relative mx-auto max-w-6xl px-4">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs text-blue-300">
                <Gamepad2 className="h-3 w-3" />
                Game Marketplace
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-white">Explore Games</h1>
              <p className="mt-2 text-base text-white/40">
                Browse blockchain games and collect NFT items.
              </p>
            </div>
            <Link
              href="/games/register"
              className="flex shrink-0 items-center gap-2 rounded-xl bg-linear-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:from-blue-500 hover:to-indigo-500"
            >
              <Plus className="h-4 w-4" />
              Register a Game
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-6xl px-4 py-8">
        <GameCategoryFilter
          categories={CATEGORIES}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
        />

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-blue-400" />
          </div>
        )}
        {error && (
          <div className="mt-8 rounded-2xl border border-red-500/20 bg-red-500/5 px-6 py-4 text-center text-sm text-red-400">
            {error}
          </div>
        )}
        {!loading && !error && (
          <GamesGrid games={filteredGames} onGameClick={(id) => (window.location.href = `/games/${id}`)} />
        )}
      </div>
    </div>
  )
}
