"use client"
import React from 'react'
import { Filter, X } from 'lucide-react'

interface NFTItemsFilterProps {
  selectedRarity: string
  selectedPriceRange: string
  onRarityChange: (rarity: string) => void
  onPriceRangeChange: (range: string) => void
}

export function NFTItemsFilter({
  selectedRarity,
  selectedPriceRange,
  onRarityChange,
  onPriceRangeChange
}: NFTItemsFilterProps) {
  const rarities = ['All', 'Common', 'Rare', 'Epic', 'Legendary']
  const priceRanges = ['All', 'Under 0.1 SOL', '0.1-0.5 SOL', '0.5-1 SOL', 'Over 1 SOL']

  const hasActiveFilters = selectedRarity !== 'All' || selectedPriceRange !== 'All'

  const clearAllFilters = () => {
    onRarityChange('All')
    onPriceRangeChange('All')
  }

  return (
    <div className="w-full mb-8">
      {/* Filter Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-white/60" />
          <span className="text-sm font-medium text-white/60">Filters</span>
        </div>

        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="flex items-center gap-1 px-3 py-1 text-xs text-white/50 hover:text-white/70 transition-colors duration-200"
          >
            <X className="w-3 h-3" />
            Clear all
          </button>
        )}
      </div>

      {/* Filter Groups */}
      <div className="space-y-4">
        {/* Rarity Filter */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-white/70 min-w-[60px]">Rarity</span>
          <div className="flex flex-wrap gap-2">
            {rarities.map((rarity) => (
              <button
                key={rarity}
                onClick={() => onRarityChange(rarity)}
                className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  selectedRarity === rarity
                    ? 'bg-white/20 text-white border border-white/30'
                    : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white/80 border border-white/5'
                }`}
              >
                {rarity}
              </button>
            ))}
          </div>
        </div>

        {/* Price Range Filter */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-white/70 min-w-[60px]">Price</span>
          <div className="flex flex-wrap gap-2">
            {priceRanges.map((range) => (
              <button
                key={range}
                onClick={() => onPriceRangeChange(range)}
                className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  selectedPriceRange === range
                    ? 'bg-white/20 text-white border border-white/30'
                    : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white/80 border border-white/5'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="mt-4 pt-4 border-t border-white/5">
          <div className="flex flex-wrap gap-2">
            {selectedRarity !== 'All' && (
              <div className="px-3 py-1.5 bg-white/10 border border-white/20 rounded-xl text-sm text-white/80">
                Rarity: {selectedRarity}
              </div>
            )}
            {selectedPriceRange !== 'All' && (
              <div className="px-3 py-1.5 bg-white/10 border border-white/20 rounded-xl text-sm text-white/80">
                Price: {selectedPriceRange}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
