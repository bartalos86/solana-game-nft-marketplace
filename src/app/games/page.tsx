"use client"
import { GameCategoryFilter } from '@/components/games/game-category-filter'
import { GamesGrid } from '@/components/games/games-grid'
import { useState } from 'react'

// Sample game data
const sampleGames = [
  {
    id: '1',
    title: 'Crypto Warriors',
    description: 'Epic battle royale where players fight with unique NFT weapons and armor. Collect rare items and dominate the arena.',
    imageUrl: '/games/crypto-warriors.jpg',
    itemCount: 15420,
    rating: 4.8,
    price: '0.5',
    category: 'Action',
    isFeatured: true
  },
  {
    id: '2',
    title: 'Dragon Quest NFT',
    description: 'Adventure RPG where you collect dragon eggs, train them, and battle other players in epic dragon duels.',
    imageUrl: '/games/dragon-quest.jpg',
    itemCount: 8920,
    rating: 4.6,
    price: '0.3',
    category: 'RPG'
  },
  {
    id: '3',
    title: 'Space Pirates',
    description: 'Space exploration game where you mine asteroids, trade resources, and engage in epic space battles.',
    imageUrl: '/games/space-pirates.jpg',
    itemCount: 12350,
    rating: 4.7,
    price: '0.4',
    category: 'Strategy'
  },
  {
    id: '4',
    title: 'Racing Legends',
    description: 'High-speed racing with customizable NFT cars. Upgrade your vehicle and compete in global tournaments.',
    imageUrl: '/games/racing-legends.jpg',
    itemCount: 6780,
    rating: 4.5,
    price: '0.25',
    category: 'Racing'
  },
  {
    id: '5',
    title: 'Racing Legends',
    description: 'High-speed racing with customizable NFT cars. Upgrade your vehicle and compete in global tournaments.',
    imageUrl: '/games/racing-legends.jpg',
    itemCount: 6780,
    rating: 4.5,
    price: '0.25',
    category: 'Racing'
  }
]

// Available categories
const categories = ['Action', 'RPG', 'Strategy', 'Racing']

export default function Page() {
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [games, setGames] = useState(sampleGames)

  // Filter games by category
  const filteredGames = selectedCategory === 'all'
    ? games
    : games.filter(game => game.category === selectedCategory)

  const handleGameClick = (gameId: string) => {
    console.log(`Navigating to game: ${gameId}`)
    // You can customize this navigation logic
    // For example, use Next.js router or custom navigation
    window.location.href = `/games/${gameId}`
  }

  return (
    <div className="w-full px-4 py-8 mt-32 container mx-auto">
      {/* Section Header */}
      <div className="text-center mb-12">
        <h2 className="text-4xl font-bold text-white mb-4">Featured Games</h2>
        <p className="text-xl text-blue-100/80 max-w-2xl mx-auto">
          Discover amazing blockchain games and collect unique NFT items. Click on any game to explore further.
        </p>
      </div>

      {/* Category Filter */}
      <GameCategoryFilter
        categories={categories}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
      />

      {/* Games Grid */}
      <GamesGrid
        games={filteredGames}
        onGameClick={handleGameClick}
      />
    </div>
  )
}
