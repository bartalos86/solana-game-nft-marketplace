"use client"
import React, { useState } from 'react'
import { SwordIcon, Star, Crown, Users, Clock, TrendingUp, Wallet, ArrowLeft } from 'lucide-react'

interface GameItemDetailProps {
  id: string
  name: string
  description: string
  imageUrl: string
  rarity: 'Common' | 'Rare' | 'Epic' | 'Legendary'
  level: number
  price: string
  owner: string
  isListed: boolean
  stats: {
    attack: number
    defense: number
    speed: number
    magic: number
  }
  game: string
  category: string
  currentBid?: string
  minBid?: string
  timeLeft?: string
  biddersCount?: number
  onBack?: () => void
  onPlaceBid?: (amount: string) => void
  onBuyNow?: () => void
}

export function GameItemDetail({
  id,
  name,
  description,
  imageUrl,
  rarity,
  level,
  price,
  owner,
  isListed,
  stats,
  game,
  category,
  currentBid,
  minBid,
  timeLeft,
  biddersCount = 0,
  onBack,
  onPlaceBid,
  onBuyNow
}: GameItemDetailProps) {
  const [bidAmount, setBidAmount] = useState('')
  const [isPlacingBid, setIsPlacingBid] = useState(false)

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'Common': return 'text-gray-300 border-gray-400/30 bg-gray-500/10'
      case 'Rare': return 'text-blue-300 border-blue-400/30 bg-blue-500/10'
      case 'Epic': return 'text-purple-300 border-purple-400/30 bg-purple-500/10'
      case 'Legendary': return 'text-yellow-300 border-yellow-400/30 bg-yellow-500/10'
      default: return 'text-gray-300 border-gray-400/30 bg-gray-500/10'
    }
  }

  const getRarityIcon = (rarity: string) => {
    if (rarity === 'Legendary') return <Crown className="w-4 h-4" />
    return <Star className="w-4 h-4" />
  }

  const handlePlaceBid = async () => {
    if (!bidAmount || parseFloat(bidAmount) <= 0) return

    setIsPlacingBid(true)
    try {
      await onPlaceBid?.(bidAmount)
      setBidAmount('')
    } finally {
      setIsPlacingBid(false)
    }
  }

  const getStatColor = (value: number) => {
    if (value >= 80) return 'text-green-400'
    if (value >= 60) return 'text-yellow-400'
    if (value >= 40) return 'text-orange-400'
    return 'text-red-400'
  }

  return (
    <div className="min-h-screen  py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Back Button */}
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-white/70 hover:text-white transition-colors duration-200 mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Items
          </button>
        )}

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left Column - Item Image & Basic Info */}
          <div className="space-y-6">
            {/* Item Image */}
            <div className="relative">
              <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
                <div className="w-full h-96 bg-gradient-to-br from-blue-400/10 to-indigo-400/10 flex items-center justify-center">
                  <div className="text-8xl">⚔️</div>
                </div>

                {/* Rarity Badge */}
                <div className="absolute top-4 left-4">
                  <div className={`px-3 py-2 rounded-xl text-sm font-semibold border backdrop-blur-sm ${getRarityColor(rarity)}`}>
                    <div className="flex items-center gap-2">
                      {getRarityIcon(rarity)}
                      {rarity}
                    </div>
                  </div>
                </div>

                {/* Level Badge */}
                <div className="absolute top-4 right-4">
                  <div className="px-3 py-2 bg-white/20 border border-white/30 rounded-xl text-sm font-semibold text-white backdrop-blur-sm">
                    Level {level}
                  </div>
                </div>

                {/* Listed Badge */}
                {isListed && (
                  <div className="absolute bottom-4 left-4">
                    <div className="px-3 py-2 bg-green-500/20 border border-green-400/30 rounded-xl text-sm font-semibold text-green-300 backdrop-blur-sm">
                      Listed for Sale
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Basic Info */}
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6">
              <h1 className="text-3xl font-bold text-white mb-4">{name}</h1>
              <p className="text-white/80 text-lg leading-relaxed mb-6">{description}</p>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-white/60">Game:</span>
                  <span className="text-white ml-2">{game}</span>
                </div>
                <div>
                  <span className="text-white/60">Category:</span>
                  <span className="text-white ml-2">{category}</span>
                </div>
                <div>
                  <span className="text-white/60">Owner:</span>
                  <span className="text-white ml-2 font-mono">{owner.slice(0, 6)}...{owner.slice(-4)}</span>
                </div>
                <div>
                  <span className="text-white/60">Price:</span>
                  <span className="text-green-400 ml-2 font-semibold">{price} SOL</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Stats & Betting */}
          <div className="space-y-6">
            {/* Item Stats */}
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Item Stats
              </h2>

              <div className="space-y-4">
                {Object.entries(stats).map(([stat, value]) => (
                  <div key={stat} className="flex items-center justify-between">
                    <span className="text-white/70 capitalize">{stat}</span>
                    <div className="flex items-center gap-3">
                      <div className="w-32 bg-white/10 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${getStatColor(value)}`}
                          style={{ width: `${value}%` }}
                        ></div>
                      </div>
                      <span className={`text-sm font-semibold w-8 text-right ${getStatColor(value)}`}>
                        {value}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Betting Section */}
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <Wallet className="w-5 h-5" />
                Place Your Bet
              </h2>

              {currentBid && (
                <div className="mb-4 p-4 bg-white/5 rounded-xl border border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white/70">Current Highest Bid:</span>
                    <span className="text-green-400 font-semibold">{currentBid} SOL</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-white/60">
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {biddersCount} bidders
                    </div>
                    {timeLeft && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {timeLeft} left
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Bid Input */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">
                    Your Bid Amount (SOL)
                  </label>
                  <input
                    type="number"
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    placeholder={minBid ? `Min: ${minBid} SOL` : "Enter bid amount"}
                    min={minBid ? parseFloat(minBid) : 0}
                    step="0.01"
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handlePlaceBid}
                    disabled={isPlacingBid || !bidAmount || parseFloat(bidAmount) <= 0}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl font-semibold text-white hover:from-blue-600 hover:to-indigo-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isPlacingBid ? 'Placing Bid...' : 'Place Bid'}
                  </button>

                  {onBuyNow && (
                    <button
                      onClick={onBuyNow}
                      className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl font-semibold text-white hover:from-green-600 hover:to-emerald-700 transition-all duration-300"
                    >
                      Buy Now
                    </button>
                  )}
                </div>

                {minBid && (
                  <p className="text-sm text-white/60 text-center">
                    Minimum bid: {minBid} SOL
                  </p>
                )}
              </div>
            </div>

            {/* Additional Info */}
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-3">Item History</h3>
              <div className="space-y-2 text-sm text-white/60">
                <div className="flex justify-between">
                  <span>Created:</span>
                  <span>2 weeks ago</span>
                </div>
                <div className="flex justify-between">
                  <span>Last traded:</span>
                  <span>3 days ago</span>
                </div>
                <div className="flex justify-between">
                  <span>Total trades:</span>
                  <span>5</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
