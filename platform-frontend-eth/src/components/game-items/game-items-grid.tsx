"use client"
import React from 'react'
import { NFTItemBox, Rarity } from './game-item-box'

interface ItemAttribute {
  trait_type: string
  value: string
}

export interface NFTItem {
  id: string
  name: string
  description: string
  imageUrl: string
  attributes: ItemAttribute[]
  rarity?: Rarity
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
      window.location.href = `/items/${itemId}`
    }
  }

  const itemsWithRarity = items.map((item) => ({
    ...item,
    rarity: item.attributes.find((attribute: { trait_type: string; value: string }) => attribute.trait_type === 'rarity')?.value as Rarity,
  }))

  console.log(itemsWithRarity)

  return (
    <div className="w-full">
      {/* Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 md:gap-6">
        {itemsWithRarity.map((item) => (
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
