"use client"
import React from 'react'
import { NFTItemBox } from './game-item-box'

interface NFTItem {
  id: string
  name: string
  description: string
  imageUrl: string
  rarity: 'Common' | 'Rare' | 'Epic' | 'Legendary'
  level: number
  price: string
  owner: string
  isListed: boolean
}

interface NFTItemsGridProps {
  items: NFTItem[]
  onItemClick?: (itemId: string) => void
}

export function NFTItemsGrid({ items, onItemClick }: NFTItemsGridProps) {
  const handleItemClick = (itemId: string) => {
    if (onItemClick) {
      onItemClick(itemId)
    } else {
      // Default navigation - you can customize this
      window.location.href = `/items/${itemId}`
    }
  }

  return (
    <div className="w-full">
      {/* Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 md:gap-6">
        {items.map((item) => (
          <NFTItemBox
            key={item.id}
            {...item}
            onClick={() => handleItemClick(item.id)}
          />
        ))}
      </div>

      {/* Empty State */}
      {items.length === 0 && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">⚔️</div>
          <h3 className="text-xl font-semibold text-white mb-2">No NFT Items Found</h3>
          <p className="text-blue-100/70">Check back later for new items or try adjusting your filters.</p>
        </div>
      )}
    </div>
  )
}
