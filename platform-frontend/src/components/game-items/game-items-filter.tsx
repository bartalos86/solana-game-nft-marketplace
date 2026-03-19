"use client"
import React from 'react'
import { SlidersHorizontal, X } from 'lucide-react'

interface NFTItemsFilterProps {
  selectedRarity: string
  selectedPriceRange: string
  onRarityChange: (rarity: string) => void
  onPriceRangeChange: (range: string) => void
}

const RARITIES = ['All', 'Common', 'Rare', 'Epic', 'Legendary']
// const PRICE_RANGES = ['All', 'Under 0.1 SOL', '0.1-0.5 SOL', '0.5-1 SOL', 'Over 1 SOL']

const RARITY_COLORS: Record<string, string> = {
  Common: 'text-white/60',
  Rare: 'text-blue-400',
  Epic: 'text-purple-400',
  Legendary: 'text-amber-400',
}

export function NFTItemsFilter({
  selectedRarity,
  selectedPriceRange,
  onRarityChange,
  onPriceRangeChange,
}: NFTItemsFilterProps) {
  const hasActiveFilters = selectedRarity !== 'All' || selectedPriceRange !== 'All'

  return (
    <div className="mb-6 space-y-3 rounded-2xl border border-white/7 bg-white/[0.02] p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-white/40">
          <SlidersHorizontal className="h-4 w-4" />
          Filters
        </div>
        {hasActiveFilters && (
          <button
            onClick={() => { onRarityChange('All'); onPriceRangeChange('All') }}
            className="flex items-center gap-1 text-xs text-white/30 transition hover:text-white/60"
          >
            <X className="h-3 w-3" />
            Clear
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-white/30 min-w-[46px]">Rarity</span>
          {RARITIES.map((r) => (
            <button
              key={r}
              onClick={() => onRarityChange(r)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                selectedRarity === r
                  ? 'bg-white/15 text-white border border-white/20'
                  : `border border-white/6 bg-white/3 ${RARITY_COLORS[r] ?? 'text-white/50'} hover:border-white/10 hover:bg-white/6`
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* <div className="flex flex-wrap gap-2">
        <span className="text-xs text-white/30 min-w-[46px] self-center">Price</span>
        {PRICE_RANGES.map((p) => (
          <button
            key={p}
            onClick={() => onPriceRangeChange(p)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              selectedPriceRange === p
                ? 'bg-white/15 text-white border border-white/20'
                : 'border border-white/6 bg-white/3 text-white/50 hover:border-white/10 hover:bg-white/6'
            }`}
          >
            {p}
          </button>
        ))}
      </div> */}
    </div>
  )
}
