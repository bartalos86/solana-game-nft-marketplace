import React from 'react'
import { GameBox } from './game-box'

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
      // Default navigation - you can customize this
      window.location.href = `/games/${gameId}`
    }
  }

  return (
    <div className="w-full">
      {/* Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {games.map((game) => (
          <GameBox
            key={game.id}
            {...game}
            onClick={() => handleGameClick(game.id)}
          />
        ))}
      </div>

      {/* Empty State */}
      {games.length === 0 && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🎮</div>
          <h3 className="text-xl font-semibold text-white mb-2">No Games Found</h3>
          <p className="text-blue-100/70">Check back later for new games or try adjusting your filters.</p>
        </div>
      )}
    </div>
  )
}
