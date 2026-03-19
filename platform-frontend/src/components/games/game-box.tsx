"use client"
import React from 'react'
import Image from 'next/image'
import { SwordIcon, ArrowUpRight } from 'lucide-react'

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
  title,
  description,
  imageUrl,
  itemCount,
  price,
  category,
  isFeatured = false,
  onClick
}: GameBoxProps) {
  return (
    <div
      onClick={onClick}
      className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border bg-white/3 transition-all duration-200 hover:bg-white/6 hover:-translate-y-0.5 ${
        isFeatured
          ? 'border-blue-500/30 shadow-lg shadow-blue-500/10'
          : 'border-white/7 hover:border-white/12'
      }`}
    >
      {/* Featured badge */}
      {isFeatured && (
        <div className="absolute left-3 top-3 z-10 rounded-full bg-linear-to-r from-blue-500 to-indigo-600 px-2.5 py-0.5 text-[10px] font-semibold text-white shadow">
          Featured
        </div>
      )}

      {/* Image */}
      <div className="relative h-44 overflow-hidden bg-linear-to-br from-blue-900/30 to-indigo-900/30">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={title}
            fill
            className="object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-5xl">
            🎮
          </div>
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-linear-to-t from-black/40 to-transparent" />

        {/* Arrow indicator */}
        <div className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-black/30 opacity-0 backdrop-blur-sm transition group-hover:opacity-100">
          <ArrowUpRight className="h-3.5 w-3.5 text-white" />
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-4">
        {/* Category pill */}
        <span className="mb-2 inline-flex self-start rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-medium text-blue-300/80">
          {category}
        </span>

        <h3 className="mb-1 text-base font-semibold text-white transition-colors group-hover:text-blue-200">
          {title}
        </h3>

        {description && (
          <p className="mb-3 line-clamp-2 text-xs leading-relaxed text-white/40">
            {description}
          </p>
        )}

        {/* Footer */}
        <div className="mt-auto flex items-center justify-between border-t border-white/6 pt-3">
          <div className="flex items-center gap-1 text-white/30">
            <SwordIcon className="h-3.5 w-3.5" />
            <span className="text-xs">{itemCount.toLocaleString()} items</span>
          </div>
          <div className="text-right">
            <span className="text-sm font-semibold text-emerald-400">{price}</span>
            <span className="ml-1 text-xs text-white/30">SOL</span>
          </div>
        </div>
      </div>
    </div>
  )
}
