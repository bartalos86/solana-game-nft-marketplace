"use client"
import React from 'react'
import { SwordIcon, Star, Crown } from 'lucide-react'

interface NFTItemBoxProps {
  id: string
  name: string
  description: string
  imageUrl: string
  rarity: 'Common' | 'Rare' | 'Epic' | 'Legendary'
  level: number
  price: string
  owner: string
  isListed: boolean
  onClick: () => void
}

export function NFTItemBox({
  id,
  name,
  description,
  imageUrl,
  rarity,
  level,
  price,
  owner,
  isListed,
  onClick
}: NFTItemBoxProps) {
  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'Common': return 'text-gray-300'
      case 'Rare': return 'text-blue-300'
      case 'Epic': return 'text-purple-300'
      case 'Legendary': return 'text-yellow-300'
      default: return 'text-gray-300'
    }
  }

  return (
    <div
      onClick={onClick}
      className="group relative backdrop-blur-lg bg-white/3 border border-white/5 rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:scale-105 hover:bg-white/8 hover:border-white/10"
    >
      {/* Item Image */}
      <div className="relative h-40 overflow-hidden">
        <div className="w-full h-full bg-gradient-to-br from-blue-400/5 to-indigo-400/5 flex items-center justify-center">
          <div className="text-5xl">⚔️</div>
        </div>

        {/* Simple Rarity Badge */}
        <div className="absolute top-2 left-2">
          <div className={`px-2 py-1 rounded-lg text-xs font-medium ${getRarityColor(rarity)} bg-white/5 backdrop-blur-sm`}>
            {rarity}
          </div>
        </div>

        {/* Level Badge */}
        <div className="absolute top-2 right-2">
          <div className="px-2 py-1 bg-white/10 border border-white/10 rounded-lg text-xs font-medium text-white/80">
            Lv.{level}
          </div>
        </div>
      </div>

      {/* Item Info */}
      <div className="p-4">
        {/* Name */}
        <h3 className="text-base font-semibold text-white/90 mb-2 group-hover:text-white transition-colors duration-300 line-clamp-1">
          {name}
        </h3>

        {/* Description */}
        <p className="text-white/60 text-sm mb-3 line-clamp-2 leading-relaxed">
          {description}
        </p>

        {/* Simple Stats Row */}
        <div className="flex items-center justify-between">
          <div className="text-xs text-white/50">
            Level {level}
          </div>

          {/* Price */}
          <div className="text-right">
            <div className="text-sm font-medium text-green-400/80">{price} SOL</div>
          </div>
        </div>
      </div>

      {/* Subtle Hover Glow */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-500/0 via-blue-400/0 to-indigo-500/0 opacity-0 group-hover:opacity-5 transition-opacity duration-300 pointer-events-none"></div>
    </div>
  )
}
