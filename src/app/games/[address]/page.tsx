"use client"
import { NFTItemsFilter } from '@/components/game-items/game-items-filter'
import { NFTItemsGrid } from '@/components/game-items/game-items-grid'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'

const sampleNFTItems = [
  {
    id: '1',
    name: 'Dragon Slayer Sword',
    description: 'A legendary weapon forged from dragon scales. Grants +50 attack power and fire resistance.',
    imageUrl: '/items/dragon-sword.jpg',
    rarity: 'Legendary' as const,
    level: 85,
    price: '2.5',
    owner: '0x1234567890abcdef1234567890abcdef12345678',
    isListed: true
  },
  {
    id: '2',
    name: 'Shadow Cloak',
    description: 'Rare stealth equipment that provides invisibility and +30 agility bonus.',
    imageUrl: '/items/shadow-cloak.jpg',
    rarity: 'Rare' as const,
    level: 45,
    price: '0.8',
    owner: '0xabcdef1234567890abcdef1234567890abcdef12',
    isListed: true
  },
  {
    id: '3',
    name: 'Iron Helmet',
    description: 'Basic protective headgear with +15 defense rating. Good for beginners.',
    imageUrl: '/items/iron-helmet.jpg',
    rarity: 'Common' as const,
    level: 10,
    price: '0.1',
    owner: '0x7890abcdef1234567890abcdef1234567890abcd',
    isListed: false
  },
  {
    id: '4',
    name: 'Thunder Hammer',
    description: 'Epic weapon that deals lightning damage and has a chance to stun enemies.',
    imageUrl: '/items/thunder-hammer.jpg',
    rarity: 'Epic' as const,
    level: 65,
    price: '1.2',
    owner: '0xdef1234567890abcdef1234567890abcdef12345',
    isListed: true
  },
  {
    id: '5',
    name: 'Phoenix Ring',
    description: 'Legendary accessory that grants fire immunity and health regeneration.',
    imageUrl: '/items/phoenix-ring.jpg',
    rarity: 'Legendary' as const,
    level: 90,
    price: '3.0',
    owner: '0x4567890abcdef1234567890abcdef1234567890ab',
    isListed: true
  },
  {
    id: '6',
    name: 'Steel Boots',
    description: 'Durable footwear providing +20 defense and +10 movement speed.',
    imageUrl: '/items/steel-boots.jpg',
    rarity: 'Common' as const,
    level: 25,
    price: '0.15',
    owner: '0xbcdef1234567890abcdef1234567890abcdef1234',
    isListed: false
  }
]

export default function Page({gameName} : {gameName: string}) {
  const router = useRouter()
  const pathname = usePathname();
  const [selectedRarity, setSelectedRarity] = useState('All')
  const [selectedPriceRange, setSelectedPriceRange] = useState('All')
  const [items, setItems] = useState(sampleNFTItems)

  // Filter items based on selected criteria
  const filteredItems = items.filter(item => {
    // Rarity filter
    if (selectedRarity !== 'All' && item.rarity !== selectedRarity) {
      return false
    }

    // Price range filter
    if (selectedPriceRange !== 'All') {
      const price = parseFloat(item.price)
      switch (selectedPriceRange) {
        case 'Under 0.1 SOL':
          if (price >= 0.1) return false
          break
        case '0.1-0.5 SOL':
          if (price < 0.1 || price > 0.5) return false
          break
        case '0.5-1 SOL':
          if (price < 0.5 || price > 1) return false
          break
        case 'Over 1 SOL':
          if (price <= 1) return false
          break
      }
    }

    return true
  })

  const handleItemClick = (itemId: string) => {
    console.log(`Navigating to NFT item: ${itemId}`)
    // Use Next.js router for navigation
    router.push(`${pathname}/items/${itemId}`)
  }

  return (
    <div className="w-full px-4 py-8 mt-32 mx-auto container">
      {/* Section Header */}
      <div className="text-center mb-12">
        <h2 className="text-4xl font-bold text-white mb-4">{gameName} Items</h2>
        <p className="text-xl text-blue-100/80 max-w-2xl mx-auto">
          Discover unique game items, weapons, and collectibles. Each NFT has different rarity levels and unique properties.
        </p>
      </div>

      {/* Filters */}
      <NFTItemsFilter
        selectedRarity={selectedRarity}
        selectedPriceRange={selectedPriceRange}
        onRarityChange={setSelectedRarity}
        onPriceRangeChange={setSelectedPriceRange}
      />

      {/* Items Grid */}
      <NFTItemsGrid
        items={filteredItems}
        onItemClick={handleItemClick}
      />
    </div>
  )
}
