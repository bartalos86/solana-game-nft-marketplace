'use client'

import React from 'react'
import Image from 'next/image'
import { ArrowUpRight, ShoppingBag, Tag, X } from 'lucide-react'
import { useEthereum } from '@/components/ethereum/evm-provider'

export interface MarketplaceItemBoxProps {
  name: string
  description: string
  imageUrl: string
  priceSol?: string
  /** Listed item: show Buy. Your item: show Put on sale. */
  variant: 'listed' | 'yours'
  sellerAddress?: string
  onClick: () => void
  onAction?: () => void
  actionLabel?: string
  actionLoading?: boolean
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

export function MarketplaceItemBox({
  name,
  description,
  imageUrl,
  priceSol,
  variant,
  sellerAddress,
  onClick,
  onAction,
  actionLabel,
  actionLoading = false,
}: MarketplaceItemBoxProps) {
  const { address } = useEthereum()
  const resolvedImageSrc = resolveImageSrc(imageUrl)
  const showPrice = variant === 'listed' && priceSol != null
  const showAction = !!onAction
  const isOwnListing =
    variant === 'listed' && !!address && sellerAddress?.toLowerCase() === address.toLowerCase()

  const { Icon: ActionIcon, label: actionLabelResolved, style: actionStyle } =
    isOwnListing
      ? { Icon: X, label: 'Cancel sale', style: 'border-red-500/15 bg-red-500/10 text-red-500 hover:bg-red-500/15' }
      : variant === 'listed'
        ? { Icon: ShoppingBag, label: actionLabel ?? 'Buy now', style: 'border-white/15 bg-white/10 text-white hover:bg-white/15' }
        : { Icon: Tag, label: actionLabel ?? 'Put on sale', style: 'border-white/15 bg-white/10 text-white hover:bg-white/15' }

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/7 bg-white/3 transition-all duration-200 hover:-translate-y-0.5 hover:border-white/12 hover:bg-white/6">
      {/* Image */}
      <div
        className="relative h-44 cursor-pointer overflow-hidden bg-linear-to-br from-blue-900/20 to-indigo-900/20"
        onClick={onClick}
        onKeyDown={(e) => e.key === 'Enter' && onClick()}
        role="button"
        tabIndex={0}
        aria-label={`View ${name}`}
      >
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
        <div className="absolute inset-0 bg-linear-to-t from-black/40 to-transparent" />
        <div className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-black/30 opacity-0 backdrop-blur-sm transition group-hover:opacity-100">
          <ArrowUpRight className="h-3.5 w-3.5 text-white" />
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-4">
        <h3 className="mb-1 truncate text-sm font-semibold text-white/90 transition-colors group-hover:text-white">
          {name}
        </h3>
        {showPrice && (
          <div className="mb-1 flex items-center gap-1.5">
            <Tag className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-sm font-semibold text-emerald-400">{priceSol} ETH</span>
          </div>
        )}
        {description && (
          <p className="line-clamp-2 text-xs leading-relaxed text-white/40">{description}</p>
        )}
        {showAction && onAction && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onAction()
            }}
            disabled={actionLoading}
            className={`mt-3 flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium transition disabled:opacity-50 ${actionStyle}`}
          >
            <ActionIcon className="h-4 w-4" />
            {actionLoading ? 'Processing…' : actionLabelResolved}
          </button>
        )}
      </div>
    </div>
  )
}
