"use client"
import { useState } from 'react'
import { GameItemDetail } from './game-item-detail'

// Sample game item data
const sampleGameItem = {
  id: '1',
  name: 'Dragon Slayer Sword',
  description: 'A legendary weapon forged from dragon scales and blessed by ancient magic. This sword has been passed down through generations of legendary warriors. It grants its wielder immense power, including +50 attack power, fire resistance, and the ability to deal bonus damage to dragon-type enemies. The blade glows with an ethereal blue flame when drawn in battle.',
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
    magic: 60
  },
  game: 'Crypto Warriors',
  category: 'Weapon',
  currentBid: '2.8',
  minBid: '2.9',
  timeLeft: '2h 15m',
  biddersCount: 7
}

export function GameItemDetailPage() {
  const [currentBid, setCurrentBid] = useState(sampleGameItem.currentBid)
  const [biddersCount, setBiddersCount] = useState(sampleGameItem.biddersCount)

  const handlePlaceBid = async (amount: string) => {
    // Simulate API call
    console.log(`Placing bid of ${amount} SOL on item ${sampleGameItem.id}`)

    // Update local state (in real app, this would come from the blockchain)
    setCurrentBid(amount)
    setBiddersCount(prev => prev + 1)

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
    <GameItemDetail
      {...sampleGameItem}
      currentBid={currentBid}
      biddersCount={biddersCount}
      onBack={handleBack}
      onPlaceBid={handlePlaceBid}
      onBuyNow={handleBuyNow}
    />
  )
}

// Alternative usage with different item
export function GameItemDetailExample() {
  const epicItem = {
    ...sampleGameItem,
    id: '2',
    name: 'Shadow Assassin Dagger',
    description: 'A deadly weapon favored by stealth operatives. This dagger is crafted from shadow essence and grants its wielder enhanced stealth capabilities, +40 attack power, and the ability to perform critical strikes with increased probability.',
    rarity: 'Epic' as const,
    level: 65,
    price: '1.2',
    stats: {
      attack: 80,
      defense: 15,
      speed: 95,
      magic: 45
    },
    category: 'Dagger',
    currentBid: '1.3',
    minBid: '1.4',
    timeLeft: '5h 30m',
    biddersCount: 3
  }

  return (
    <GameItemDetail
      {...epicItem}
      onPlaceBid={(amount) => console.log(`Bidding ${amount} SOL on ${epicItem.name}`)}
      onBuyNow={() => console.log(`Buying ${epicItem.name}`)}
    />
  )
}
