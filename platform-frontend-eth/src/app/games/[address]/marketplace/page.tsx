'use client'

import { useParams, useRouter, usePathname } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { MarketplaceGrid, type ListedItem, type YourItem } from '@/components/game-items/marketplace-grid'
import { PutOnSaleDialog } from '@/components/game-items/put-on-sale-dialog'
import { ArrowLeft, Store, Loader2 } from 'lucide-react'
import type { MarketplaceListingResponse } from '@/lib/marketplace'
import { useEthereum } from '@/components/ethereum/evm-provider'
import { fetchItemsByGameAndOwner } from '@/lib/game-items'
import { isAddress, parseEther } from 'viem'
import { gameItemAbi, MARKETPLACE_ADDRESS, marketplaceAbi } from '@/lib/eth-contracts'
import { GAME_FACTORY_ADDRESS, gameFactoryAbi } from '@/lib/marketplace'

const CHAIN_UPDATE_DELAY_MS = 15000

interface GameInfo {
  name: string
  ethereumPublicKey: string
}

function sortListingsWithOwnLast(
  listings: MarketplaceListingResponse[],
  myWalletKey: string | undefined
): MarketplaceListingResponse[] {
  if (!myWalletKey) return listings
  return [...listings].sort((a, b) => {
    const aMine = a.seller === myWalletKey ? 1 : 0
    const bMine = b.seller === myWalletKey ? 1 : 0
    return aMine - bMine
  })
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="animate-pulse rounded-2xl border border-white/6 bg-white/2">
            <div className="aspect-square w-full rounded-t-2xl bg-white/6" />
            <div className="space-y-2 p-4">
              <div className="h-4 w-3/4 rounded-md bg-white/8" />
              <div className="h-3 w-1/2 rounded-md bg-white/6" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function GameMarketplacePage() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useParams()
  const address = typeof params?.address === 'string' ? params.address : ''
  const { publicClient, walletClient, address: walletAddress } = useEthereum()

  const [gameInfo, setGameInfo] = useState<GameInfo | null>(null)
  const [listings, setListings] = useState<MarketplaceListingResponse[]>([])
  const [yourItems, setYourItems] = useState<YourItem[]>([])
  const [loadingListings, setLoadingListings] = useState(true)
  const [putOnSaleItem, setPutOnSaleItem] = useState<YourItem | null>(null)
  const [putOnSaleOpen, setPutOnSaleOpen] = useState(false)
  const [buyingListingId, setBuyingListingId] = useState<string | null>(null)
  const [puttingOnSaleId, setPuttingOnSaleId] = useState<string | null>(null)

  const fetchListings = useCallback(async () => {
    if (!address) return
    setLoadingListings(true)
    try {
      const res = await fetch(`/api/games/${encodeURIComponent(address)}/marketplace/listings`)
      if (res.ok) {
        const data = (await res.json()) as MarketplaceListingResponse[]
        setListings(data)
      } else {
        setListings([])
      }
    } catch {
      setListings([])
    } finally {
      setLoadingListings(false)
    }
  }, [address])

  // useEffect(() => {
  //   fetchListings()
  //   // const t = setInterval(fetchListings, 30_000)
  //   return () => clearInterval(t)
  // }, [fetchListings])

  useEffect(() => {
    fetchListings()
  }, [fetchListings])

  useEffect(() => {
    if (!walletAddress || !address || !isAddress(address)) {
      setYourItems([])
      return
    }
    const listedMints = new Set(listings.map((l) => l.mint))
    fetchItemsByGameAndOwner(walletAddress, address as `0x${string}`)
      .then(({ items: ownedItems }) => {
        const items: YourItem[] = ownedItems
          .filter((a) => !listedMints.has(a.id))
          .map((a) => ({
            id: a.id,
            name: a.name,
            description: a.description,
            imageUrl: a.imageUrl,
          }))
        setYourItems(items)
      })
      .catch(() => setYourItems([]))
  }, [walletAddress, address, listings])

  useEffect(() => {
    if (!address) return
    let cancelled = false
    fetch(`/api/games/${encodeURIComponent(address)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return
        if (data?.name && data?.ethereumPublicKey) {
          setGameInfo({ name: data.name, ethereumPublicKey: data.ethereumPublicKey })
        } else {
          setGameInfo({ name: 'Game', ethereumPublicKey: address })
        }
      })
      .catch(() => {
        if (!cancelled) setGameInfo({ name: 'Game', ethereumPublicKey: address })
      })
    return () => { cancelled = true }
  }, [address])

  const handlePutOnSale = (item: YourItem) => {
    setPutOnSaleItem(item)
    setPutOnSaleOpen(true)
  }

  const handleConfirmPutOnSale = async (priceEth: string, expiryDays: number) => {
    if (!walletAddress || !walletClient || !putOnSaleItem) throw new Error('Wallet or item missing')
    setPuttingOnSaleId(putOnSaleItem.id)
    try {
      const priceWei = parseEther(priceEth)
      const expiryUnix = Math.floor(Date.now() / 1000) + expiryDays * 24 * 60 * 60
      const gameItems = await publicClient.readContract({
        address: GAME_FACTORY_ADDRESS,
        abi: gameFactoryAbi,
        functionName: 'gameItems',
      })
      const approved = await publicClient.readContract({
        address: gameItems,
        abi: gameItemAbi,
        functionName: 'isApprovedForAll',
        args: [walletAddress, MARKETPLACE_ADDRESS],
      })
      const [account] = await walletClient.getAddresses()
      if (!approved) {
        const approvalHash = await walletClient.writeContract({
          account,
          address: gameItems,
          abi: gameItemAbi,
          functionName: 'setApprovalForAll',
          args: [MARKETPLACE_ADDRESS, true],
          chain: walletClient.chain,
        })
        await publicClient.waitForTransactionReceipt({ hash: approvalHash })
      }
      const listHash = await walletClient.writeContract({
        account,
        address: MARKETPLACE_ADDRESS,
        abi: marketplaceAbi,
        functionName: 'listNFT',
        args: [gameItems, BigInt(putOnSaleItem.id), 1n, priceWei, BigInt(expiryUnix)],
        chain: walletClient.chain,
      })
      await publicClient.waitForTransactionReceipt({ hash: listHash })
      await new Promise((r) => setTimeout(r, CHAIN_UPDATE_DELAY_MS))
      await fetchListings()
    } finally {
      setPuttingOnSaleId(null)
    }
  }

  const handleBuy = async (listing: ListedItem) => {
    if (!walletAddress || !walletClient) throw new Error('Connect your wallet to buy')
    setBuyingListingId(listing.publicKey)
    try {
      const [account] = await walletClient.getAddresses()
      const hash = await walletClient.writeContract({
        account,
        address: MARKETPLACE_ADDRESS,
        abi: marketplaceAbi,
        functionName: 'buyNFT',
        args: [BigInt(listing.publicKey)],
        value: BigInt(listing.priceLamports),
        chain: walletClient.chain,
      })
      await publicClient.waitForTransactionReceipt({ hash })
      await new Promise((r) => setTimeout(r, CHAIN_UPDATE_DELAY_MS))
      await fetchListings()
    } finally {
      setBuyingListingId(null)
    }
  }

  const handleCancelListing = async (listing: ListedItem) => {
    if (!walletAddress || !walletClient) throw new Error('Connect your wallet to buy')
      setBuyingListingId(listing.publicKey)
      try {
        const [account] = await walletClient.getAddresses()
        const hash = await walletClient.writeContract({
          account,
          address: MARKETPLACE_ADDRESS,
          abi: marketplaceAbi,
          functionName: 'cancelListing',
          args: [BigInt(listing.publicKey)],
          chain: walletClient.chain,
        })
        await publicClient.waitForTransactionReceipt({ hash })
        await new Promise((r) => setTimeout(r, CHAIN_UPDATE_DELAY_MS))
        await fetchListings()
      } finally {
        setBuyingListingId(null)
      }
  }

  const handleItemClick = (mintOrId: string) => {
    router.push(`${pathname.replace(/\/marketplace\/?$/, '')}/items/${mintOrId}`)
  }

  const gameName = gameInfo?.name ?? 'Game'

  return (
    <div className="min-h-screen w-full">
      {/* Header */}
      <div className="relative overflow-hidden border-b border-white/6 pb-8 pt-32">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-20 left-1/2 h-[300px] w-[600px] -translate-x-1/2 rounded-full bg-amber-500/8 blur-[80px]" />
        </div>
        <div className="relative mx-auto max-w-6xl px-4">
          <button
            type="button"
            onClick={() => router.push(pathname.replace(/\/marketplace\/?$/, ''))}
            className="mb-6 flex items-center gap-1.5 text-sm text-white/40 transition-colors hover:text-white/70"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to {gameName}
          </button>
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10">
              <Store className="h-5 w-5 text-amber-400/80" />
            </div>
            <div>
              <h1 className="text-4xl font-bold tracking-tight text-white">Marketplace</h1>
              <p className="mt-1 text-base text-white/40">
                Buy and sell {gameName} items.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-6xl px-4 py-8">
        {!walletAddress && (
          <div className="mb-8 rounded-2xl border border-white/6 bg-white/2 px-6 py-5">
            <p className="text-sm text-white/40">
              Connect your wallet to list items for sale and to buy items.
            </p>
          </div>
        )}

        {loadingListings || buyingListingId ? (
          buyingListingId ? (
            <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-white/6 bg-white/2 py-24">
              <Loader2 className="h-12 w-12 animate-spin text-amber-400" />
              <div className="text-center">
                <p className="font-semibold text-white/90">Transaction in progress</p>
                <p className="mt-1 text-sm text-white/50">
                  Confirming on chain… Listings will update when complete.
                </p>
              </div>
            </div>
          ) : (
            <LoadingSkeleton />
          )
        ) : (
          <MarketplaceGrid
            listedItems={sortListingsWithOwnLast(listings, walletAddress ?? undefined)}
            yourItems={walletAddress ? yourItems : []}
            onItemClick={handleItemClick}
            onBuy={walletAddress ? handleBuy : undefined}
            onPutOnSale={walletAddress ? handlePutOnSale : undefined}
            onCancelListing={walletAddress ? handleCancelListing : undefined}
            buyingListingId={buyingListingId}
            puttingOnSaleId={puttingOnSaleId}
          />
        )}
      </div>

      <PutOnSaleDialog
        open={putOnSaleOpen}
        onOpenChange={setPutOnSaleOpen}
        itemName={putOnSaleItem?.name ?? ''}
        onConfirm={handleConfirmPutOnSale}
      />
    </div>
  )
}