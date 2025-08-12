import React from 'react'

interface GameCategoryFilterProps {
  categories: string[]
  selectedCategory: string
  onCategoryChange: (category: string) => void
}

export function GameCategoryFilter({ categories, selectedCategory, onCategoryChange }: GameCategoryFilterProps) {
  return (
    <div className="w-full mb-8">
      <div className="flex flex-wrap gap-3 justify-center lg:justify-start">
        {/* All Categories Button */}
        <button
          onClick={() => onCategoryChange('all')}
          className={`px-4 py-2 rounded-2xl font-medium transition-all duration-300 ${
            selectedCategory === 'all'
              ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/50'
              : 'backdrop-blur-lg bg-white/10 border border-white/20 text-white hover:bg-white/20'
          }`}
        >
          All Games
        </button>

        {/* Category Buttons */}
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => onCategoryChange(category)}
            className={`px-4 py-2 rounded-2xl font-medium transition-all duration-300 ${
              selectedCategory === category
                ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/50'
                : 'backdrop-blur-lg bg-white/10 border border-white/20 text-white hover:bg-white/20'
            }`}
          >
            {category}
          </button>
        ))}
      </div>
    </div>
  )
}
