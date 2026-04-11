import React from 'react'

interface GameCategoryFilterProps {
  categories: string[]
  selectedCategory: string
  onCategoryChange: (category: string) => void
}

export function GameCategoryFilter({ categories, selectedCategory, onCategoryChange }: GameCategoryFilterProps) {
  return (
    <div className="mb-8 flex flex-wrap gap-2">
      <button
        onClick={() => onCategoryChange('all')}
        className={`rounded-lg px-4 py-2 text-sm font-medium transition-all duration-150 ${
          selectedCategory === 'all'
            ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
            : 'border border-white/[0.08] bg-white/[0.04] text-white/50 hover:border-white/[0.15] hover:bg-white/[0.07] hover:text-white/80'
        }`}
      >
        All
      </button>

      {categories.map((category) => (
        <button
          key={category}
          onClick={() => onCategoryChange(category)}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-all duration-150 ${
            selectedCategory === category
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'border border-white/[0.08] bg-white/[0.04] text-white/50 hover:border-white/[0.15] hover:bg-white/[0.07] hover:text-white/80'
          }`}
        >
          {category}
        </button>
      ))}
    </div>
  )
}
