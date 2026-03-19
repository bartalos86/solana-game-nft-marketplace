'use client'

import React from 'react'
import { MarketplaceItemBox } from './marketplace-item-box'
import { useWallet } from '@solana/wallet-adapter-react'

export interface ListedItem {
  publicKey: string
  seller: string
  mint: string
  price: string
  priceLamports: string
  updateAuthorityFeeRecipient: string
  name: string
  description: string
  imageUrl: string
}

export interface YourItem {
  id: string
  name: string
  description: string
  imageUrl: string
}

interface MarketplaceGridProps {
  listedItems: ListedItem[]
  yourItems: YourItem[]
  onItemClick: (mintOrId: string) => void
  onBuy?: (listing: ListedItem) => void
  onPutOnSale?: (item: YourItem) => void
  onCancelListing?: (listing: ListedItem) => void
  buyingListingId?: string | null
  puttingOnSaleId?: string | null
}

export function MarketplaceGrid({
  listedItems,
  yourItems,
  onItemClick,
  onBuy,
  onCancelListing,
  onPutOnSale,
  buyingListingId,
  puttingOnSaleId,
}: MarketplaceGridProps) {
  const wallet = useWallet()
  const isOwnListing = (listing: ListedItem) => listing.seller === wallet.publicKey?.toString()
  return (
    <div className="w-full space-y-12">
      {/* Listed for sale */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-white/90">For sale</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {listedItems.map((item) => (
            <MarketplaceItemBox
              key={item.publicKey}
              name={item.name}
              description={item.description}
              imageUrl={item.imageUrl}
              priceSol={item.price}
              sellerAddress={item.seller}
              variant="listed"
              onClick={() => onItemClick(item.mint)}
              onAction={isOwnListing(item) ? (onCancelListing ? () => onCancelListing(item) : undefined) : (onBuy ? () => onBuy(item) : undefined)}
              actionLabel={isOwnListing(item) ? 'Cancel listing' : 'Buy now'}
              actionLoading={buyingListingId === item.publicKey}
            />
          ))}
        </div>
        {listedItems.length === 0 && (
          <div className="rounded-2xl border border-white/6 bg-white/2 py-12 text-center">
            <div className="text-5xl opacity-50">🛒</div>
            <h3 className="mt-3 text-base font-medium text-white/70">No items listed yet</h3>
            <p className="mt-1 text-sm text-white/40">
              List your items below to sell them on the marketplace.
            </p>
          </div>
        )}
      </section>

      {/* Your items (can list) */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-white/90">Your items</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {yourItems.map((item) => (
            <MarketplaceItemBox
              key={item.id}
              name={item.name}
              description={item.description}
              imageUrl={item.imageUrl}
              variant="yours"
              onClick={() => onItemClick(item.id)}
              onAction={onPutOnSale ? () => onPutOnSale(item) : undefined}
              actionLabel="Put on sale"
              actionLoading={puttingOnSaleId === item.id}
            />
          ))}
        </div>
        {yourItems.length === 0 && (
          <div className="rounded-2xl border border-white/6 bg-white/2 py-12 text-center">
            <div className="text-5xl opacity-50">⚔️</div>
            <h3 className="mt-3 text-base font-medium text-white/70">No items in your wallet</h3>
            <p className="mt-1 text-sm text-white/40">
              Play the game to earn items, then list them here.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}
