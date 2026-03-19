import React from 'react'
import { GameBox } from './game-box'
import Link from 'next/link'
import { PlusCircle } from 'lucide-react'

interface Game {
  id: string
  title: string
  description: string
  imageUrl: string
  itemCount: number
  rating: number
  price: string
  category: string
  isFeatured?: boolean
}

interface GamesGridProps {
  games: Game[]
  onGameClick?: (gameId: string) => void
}

export function GamesGrid({ games, onGameClick }: GamesGridProps) {
  const handleGameClick = (gameId: string) => {
    if (onGameClick) {
      onGameClick(gameId)
    } else {
      window.location.href = `/games/${gameId}`
    }
  }

  if (games.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] py-20 text-center">
        <div className="mb-4 text-5xl">🎮</div>
        <h3 className="mb-1 text-lg font-semibold text-white">No games found</h3>
        <p className="mb-6 max-w-xs text-sm text-white/40">
          No games match your current filter, or none have been registered yet.
        </p>
        <Link
          href="/games/register"
          className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/70 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
        >
          <PlusCircle className="h-4 w-4" />
          Register a game
        </Link>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {games.map((game) => (
        <GameBox
          key={game.id}
          {...game}
          onClick={() => handleGameClick(game.id)}
        />
      ))}
    </div>
  )
}
