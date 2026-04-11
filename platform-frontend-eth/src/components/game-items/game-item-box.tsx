"use client"
import React from 'react'
import Image from 'next/image'
import { ArrowUpRight } from 'lucide-react'
import { NFTItem } from './game-items-grid'

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic'

export const RARITY_COLORS: Record<Rarity, string> = {
  common: 'border-indigo-400/30 bg-indigo-400/5',
  uncommon: 'border-green-400/30 bg-green-400/5',
  rare: 'border-blue-400/40 bg-blue-400/5',
  epic: 'border-purple-400/40 bg-purple-400/5',
  legendary: 'border-amber-400/50 bg-amber-400/5',
  mythic: 'border-pink-400/50 bg-pink-400/5',
}

type NFTItemBoxProps = NFTItem & {
  onClick: () => void
}

function resolveImageSrc(raw: string | null | undefined): string | null {
  if (!raw) return null
  const value = raw.trim()
  if (!value) return null
  if (value.startsWith('ipfs://')) return value.replace('ipfs://', 'https://ipfs.io/ipfs/')
  if (
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('/') ||
    value.startsWith('data:') ||
    value.startsWith('blob:')
  ) {
    return value
  }
  return null
}

export function NFTItemBox({ name, description, rarity, imageUrl, onClick }: NFTItemBoxProps) {
  const rarityColor = rarity ? RARITY_COLORS[rarity] : 'border-white/15 bg-white/10'
  const resolvedImageSrc = resolveImageSrc(imageUrl)

  return (
    <div
      onClick={onClick}
      className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border transition-all duration-200 hover:-translate-y-0.5 hover:opacity-90 ${rarityColor}`}
    >
      {/* Image */}
      <div className="relative h-44 overflow-hidden bg-linear-to-br from-blue-900/20 to-indigo-900/20">
        {resolvedImageSrc ? (
          <Image
            src={resolvedImageSrc}
            alt={name}
            fill
            className="object-cover transition duration-300 group-hover:scale-105"
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl">⚔️</div>
        )}
        <div className="absolute inset-0 bg-linear-to-t from-black/30 to-transparent" />
        <div className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-black/30 opacity-0 backdrop-blur-sm transition group-hover:opacity-100">
          <ArrowUpRight className="h-3.5 w-3.5 text-white" />
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-4">
        <h3 className="mb-1 truncate text-sm font-semibold text-white/90 transition-colors group-hover:text-white">
          {name}
        </h3>
        {description && (
          <p className="line-clamp-2 text-xs leading-relaxed text-white/40">{description}</p>
        )}
      </div>
    </div>
  )
}
