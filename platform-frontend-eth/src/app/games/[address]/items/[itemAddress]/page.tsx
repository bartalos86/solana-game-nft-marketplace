'use client'

import { GameItemDetail } from '@/components/game-items/game-item-detail'
import { fetchTokenMetadata } from '@/lib/game-items'
import { GAME_FACTORY_ADDRESS, createEthPublicClient, gameFactoryAbi } from '@/lib/marketplace'

/** Chain item metadata (matches game-sdk ItemMetadata) */
interface ItemMetadata {
  id: string
  name: string
  image: string
  description: string
  gameAddress: string
  attributes: { trait_type: string; value: string }[] | unknown
}
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

function normalizeMetadata(raw: Record<string, unknown>): ItemMetadata {
  const attrs = raw.attributes
  const attributes = Array.isArray(attrs)
    ? attrs.map((a: unknown) =>
        typeof a === 'object' && a !== null && 'trait_type' in a && 'value' in a
          ? { trait_type: String((a as { trait_type: unknown }).trait_type), value: String((a as { value: unknown }).value) }
          : { trait_type: 'unknown', value: String(a) }
      )
    : []
  return {
    id: typeof raw.id === 'string' ? raw.id : '',
    name: typeof raw.name === 'string' ? raw.name : '',
    image: typeof raw.image === 'string' ? raw.image : '',
    description: typeof raw.description === 'string' ? raw.description : '',
    gameAddress: typeof raw.gameAddress === 'string' ? raw.gameAddress : '',
    attributes,
  }
}

export default function ItemPage() {
  const params = useParams()
  const gameAddress = typeof params?.address === 'string' ? params.address : ''
  const itemAddress = typeof params?.itemAddress === 'string' ? params.itemAddress : ''

  const [metadata, setMetadata] = useState<ItemMetadata | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!itemAddress) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    let tokenId: bigint
    try {
      tokenId = BigInt(itemAddress)
    } catch {
      setLoading(false)
      setError('Invalid item id')
      return
    }
    createEthPublicClient()
      .readContract({
        address: GAME_FACTORY_ADDRESS,
        abi: gameFactoryAbi,
        functionName: 'gameItems',
      })
      .then((gameItems) => fetchTokenMetadata(gameItems, tokenId))
      .then((result) => {
        if (cancelled) return
        if (result) {
          setMetadata(normalizeMetadata({
            id: result.id,
            name: result.name,
            image: result.imageUrl,
            description: result.description,
            gameAddress,
            attributes: result.attributes,
          }))
        } else {
          setMetadata(null)
          setError('Item not found')
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('Failed to load item')
          setMetadata(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [itemAddress, gameAddress])

  const handleBack = () => window.history.back()

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-white/70">Loading item...</p>
      </div>
    )
  }

  if (error || !metadata) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2">
        <p className="text-white/80">{error ?? 'Item not found'}</p>
        <button
          type="button"
          onClick={handleBack}
          className="text-sm text-white/60 hover:text-white"
        >
          Back to items
        </button>
      </div>
    )
  }

  return (
    <div className="pt-25">
      <GameItemDetail
        metadata={metadata}
        mintAddress={itemAddress}
        gameAddress={gameAddress}
        onBack={handleBack}
      />
    </div>
  )
}
