"use client"
import React from 'react'
import { Users, Star, SwordIcon } from 'lucide-react'
import { Item } from '@radix-ui/react-dropdown-menu'

interface GameBoxProps {
  id: string
  title: string
  description: string
  imageUrl: string
  itemCount: number
  rating: number
  price: string
  category: string
  isFeatured?: boolean
  onClick: () => void
}

export function GameBox({
  id,
  title,
  description,
  imageUrl,
  itemCount,
  rating,
  price,
  category,
  isFeatured = false,
  onClick
}: GameBoxProps) {
  return (
    <div
      onClick={onClick}
      className={`group relative backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl overflow-hidden cursor-pointer transition-all duration-300 hover:scale-105 hover:bg-white/15 hover:border-white/30 ${isFeatured ? 'ring-2 ring-blue-400/50 shadow-2xl shadow-blue-500/30' : 'shadow-xl shadow-blue-500/20'}`}
    >
      {/* Featured Badge */}
      {isFeatured && (
        <div className="absolute top-4 left-4 z-10">
          <div className="px-3 py-1 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full text-xs font-semibold text-white shadow-lg">
            Featured
          </div>
        </div>
      )}

      {/* Game Image */}
      <div className="relative h-48 overflow-hidden">
        <div className="w-full h-full bg-gradient-to-br from-blue-400/20 to-indigo-400/20 flex items-center justify-center">
          <div className="text-6xl">🎮</div>
        </div>
      </div>

      {/* Game Info */}
      <div className="p-6">
        {/* Category */}
        <div className="mb-3">
          <span className="px-3 py-1 bg-blue-500/20 border border-blue-400/30 rounded-full text-xs font-medium text-blue-200">
            {category}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-xl font-bold text-white mb-2 group-hover:text-blue-200 transition-colors duration-300">
          {title}
        </h3>

        {/* Description */}
        <p className="text-blue-100/80 text-sm mb-4 line-clamp-2 leading-relaxed">
          {description}
        </p>

        {/* Stats Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 text-blue-200/80">
              <SwordIcon className="w-4 h-4" />
              <span className="text-sm">{itemCount.toLocaleString()}</span>
            </div>
            {/* <div className="flex items-center gap-1 text-yellow-400">
              <Star className="w-4 h-4 fill-current" />
              <span className="text-sm">{rating}</span>
            </div> */}
          </div>

          {/* Price */}
          <div className="text-right">
            <div className="text-lg font-bold text-green-400">{price}</div>
            <div className="text-xs text-blue-200/60">SOL</div>
          </div>
        </div>
      </div>

      {/* Hover Glow Effect */}
      <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-blue-500/0 via-blue-400/0 to-indigo-500/0 opacity-0 group-hover:opacity-20 transition-opacity duration-300 pointer-events-none"></div>
    </div>
  )
}
