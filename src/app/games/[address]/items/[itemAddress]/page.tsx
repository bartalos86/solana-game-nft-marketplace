'use client'
import { GameItemDetail } from '@/components/game-items/game-item-detail'
import { useState } from 'react'

// Sample game item data
const sampleGameItem = {
  id: '1',
  name: 'Dragon Slayer Sword',
  description:
    'A legendary weapon forged from dragon scales and blessed by ancient magic. This sword has been passed down through generations of legendary warriors. It grants its wielder immense power, including +50 attack power, fire resistance, and the ability to deal bonus damage to dragon-type enemies. The blade glows with an ethereal blue flame when drawn in battle.',
  imageUrl: '/items/dragon-sword.jpg',
  rarity: 'Legendary' as const,
  level: 85,
  price: '2.5',
  owner: '0x1234567890abcdef1234567890abcdef12345678',
  isListed: true,
  stats: {
    attack: 95,
    defense: 30,
    speed: 75,
    magic: 60,
  },
  game: 'Crypto Warriors',
  category: 'Weapon',
  currentBid: '2.8',
  minBid: '2.9',
  timeLeft: '2h 15m',
  biddersCount: 7,
}

export default function Page() {
  const [currentBid, setCurrentBid] = useState(sampleGameItem.currentBid)
  const [biddersCount, setBiddersCount] = useState(sampleGameItem.biddersCount)

  const handlePlaceBid = async (amount: string) => {
    // Simulate API call
    console.log(`Placing bid of ${amount} SOL on item ${sampleGameItem.id}`)

    // Update local state (in real app, this would come from the blockchain)
    setCurrentBid(amount)
    setBiddersCount((prev) => prev + 1)

    // Show success message
    alert(`Bid placed successfully! Your bid of ${amount} SOL is now the highest.`)
  }

  const handleBuyNow = () => {
    console.log(`Buying item ${sampleGameItem.id} for ${sampleGameItem.price} SOL`)
    alert(`Purchase initiated! Redirecting to payment...`)
  }

  const handleBack = () => {
    console.log('Navigating back to items list')
    // In real app, use Next.js router or custom navigation
    window.history.back()
  }

  return (
    <div className="pt-25 ">
      <GameItemDetail
        {...sampleGameItem}
        currentBid={currentBid}
        biddersCount={biddersCount}
        onBack={handleBack}
        onPlaceBid={handlePlaceBid}
        onBuyNow={handleBuyNow}
      />
    </div>
  )
}
