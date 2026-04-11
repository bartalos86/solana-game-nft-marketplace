'use client'

import React from 'react'
import { ArrowLeft } from 'lucide-react'
import Image from 'next/image'
import { RARITY_COLORS, type Rarity } from './game-item-box'

/** Chain metadata shape (matches game-sdk ItemMetadata) */
interface ItemMetadata {
  id: string
  name: string
  image: string
  description: string
  gameAddress: string
  attributes: { trait_type: string; value: string }[] | unknown
}

interface GameItemDetailProps {
  metadata: ItemMetadata
  mintAddress: string
  gameAddress: string
  onBack?: () => void
}

function isItemAttribute(a: unknown): a is { trait_type: string; value: string } {
  return (
    typeof a === 'object' &&
    a !== null &&
    'trait_type' in a &&
    'value' in a &&
    typeof (a as { trait_type: unknown }).trait_type === 'string' &&
    typeof (a as { value: unknown }).value === 'string'
  )
}

export function GameItemDetail({
  metadata,
  mintAddress,
  gameAddress,
  onBack,
}: GameItemDetailProps) {
  const { name, image, description, gameAddress: metaGameAddress, attributes } = metadata
  const attrsList = Array.isArray(attributes) ? attributes.filter(isItemAttribute) : []
  const resolvedGameAddress = metaGameAddress || gameAddress
  const rarity = attrsList.find((a) => a.trait_type === 'rarity')?.value as Rarity | undefined
  const imageBorderClass =
    rarity && RARITY_COLORS[rarity] ? RARITY_COLORS[rarity] : 'border-white/8 bg-black/20'

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-white/40 transition-colors hover:text-white/70"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to items
        </button>
      )}
      <div className="grid gap-8 lg:grid-cols-2">
      {/* ── Left column: image ── */}
      <div className="space-y-4">
        <div
          className={`relative overflow-hidden rounded-2xl border ${imageBorderClass}`}
        >
          {/* subtle inner glow */}
          <div className="pointer-events-none absolute inset-0 z-10">
            <div className="absolute left-1/2 top-0 h-[200px] w-[400px] -translate-x-1/2 rounded-full bg-indigo-600/10 blur-[60px]" />
          </div>
          <div className="relative aspect-square w-full">
            {image ? (
              <Image
                src={image}
                alt={name || 'Item'}
                fill
                className="object-contain"
                unoptimized
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-8xl" aria-hidden>
                ⚔️
              </div>
            )}
          </div>
        </div>

        {/* On-chain addresses */}
        <div className="rounded-2xl border border-white/6 bg-white/2 p-5">
          <p className="mb-3 text-xs font-medium uppercase tracking-widest text-white/30">
            On-chain info
          </p>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-white/40">Mint</span>
              <span
                className="font-mono text-xs text-white/70"
                title={mintAddress}
              >
                {mintAddress}
              </span>
            </div>
            <div className="h-px bg-white/6" />
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-white/40">Game</span>
              <span
                className="font-mono text-xs text-white/70"
                title={resolvedGameAddress}
              >
                {resolvedGameAddress}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right column: details ── */}
      <div className="space-y-6">

        {/* Name + description */}
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white">
            {name || 'Unnamed Item'}
          </h2>
          {description && (
            <p className="mt-3 text-base leading-relaxed text-white/50">{description}</p>
          )}
        </div>

        {/* Attributes */}
        <div className="rounded-2xl border border-white/6 bg-white/2 p-5">
          <p className="mb-4 text-xs font-medium uppercase tracking-widest text-white/30">
            Attributes
          </p>

          {attrsList.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {attrsList.map((attr, i) => (
                <div
                  key={`${attr.trait_type}-${i}`}
                  className="rounded-xl border border-white/6 bg-white/2 px-4 py-3 transition-colors hover:border-white/12 hover:bg-white/4"
                >
                  <p className="text-xs capitalize text-white/40">{attr.trait_type}</p>
                  <p className="mt-0.5 text-sm font-medium text-white">{attr.value}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-white/30">No attributes on-chain.</p>
          )}
        </div>

      </div>
      </div>
    </div>
  )
}