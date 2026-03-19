"use client"
import Link from 'next/link'
import { ArrowRight, Gamepad2, Shield, Zap, TrendingUp } from 'lucide-react'

const FEATURES = [
  {
    icon: <Gamepad2 className="h-5 w-5 text-blue-400" />,
    title: 'Game Registry',
    description: 'Register your blockchain game and manage its on-chain identity with Solana and Ethereum keypairs.',
  },
  {
    icon: <Shield className="h-5 w-5 text-indigo-400" />,
    title: 'NFT Items',
    description: 'Browse, collect, and trade unique in-game items as verifiable NFTs on the Solana blockchain.',
  },
  {
    icon: <Zap className="h-5 w-5 text-cyan-400" />,
    title: 'Instant Trades',
    description: 'Fast, low-fee transactions powered by Solana. No middlemen, no delays.',
  },
  {
    icon: <TrendingUp className="h-5 w-5 text-purple-400" />,
    title: 'Open Marketplace',
    description: 'List items for auction or direct sale. Set prices and let the market decide.',
  },
]

export function DashboardFeature() {
  return (
    <div className="w-full">
      {/* Hero section */}
      <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 pt-24 pb-16">
        {/* Ambient blobs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-blue-600/10 blur-[120px]" />
          <div className="absolute top-1/2 -right-40 h-[400px] w-[400px] rounded-full bg-indigo-600/10 blur-[100px]" />
          <div className="absolute bottom-0 -left-20 h-[300px] w-[300px] rounded-full bg-cyan-600/8 blur-[100px]" />
          {/* Grid */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.04)_1px,transparent_1px)] bg-size-[60px_60px]" />
        </div>

        <div className="relative z-10 mx-auto max-w-4xl text-center">
          {/* Badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1.5 text-sm text-blue-300">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
            Built on Solana
          </div>

          {/* Headline */}
          <h1 className="mb-6 text-5xl font-bold leading-tight tracking-tight text-white sm:text-6xl lg:text-7xl">
            The NFT Game{' '}
            <span className="bg-linear-to-r from-blue-400 via-indigo-400 to-cyan-400 bg-clip-text text-transparent">
              Marketplace
            </span>
          </h1>

          <p className="mx-auto mb-10 max-w-xl text-lg leading-relaxed text-white/50">
            Trade legendary game items, weapons, and collectibles on the fastest blockchain.
            Register your game and unlock a new economy for your players.
          </p>

          {/* CTAs */}
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/games"
              className="group flex items-center gap-2 rounded-xl bg-linear-to-r from-blue-600 to-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:from-blue-500 hover:to-indigo-500 hover:shadow-blue-500/40"
            >
              Explore Games
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/games/register"
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/6 px-6 py-3 text-sm font-semibold text-white/80 backdrop-blur-sm transition hover:border-white/20 hover:bg-white/10 hover:text-white"
            >
              Register a Game
            </Link>
          </div>
        </div>

        {/* Floating NFT card preview */}
        <div className="relative z-10 mt-16 w-full max-w-3xl">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { emoji: '⚔️', name: 'Blade of Eternity', rarity: 'Legendary', price: '12.5' },
              { emoji: '🍉', name: 'Epic Melon', rarity: 'Epic', price: '4.2' },
              { emoji: '🦜', name: 'Parrot', rarity: 'Rare', price: '1.8' },
            ].map((item) => (
              <div
                key={item.name}
                className="group rounded-2xl border border-white/10 bg-white/4 p-4 backdrop-blur-xl transition hover:border-white/20 hover:bg-white/7"
              >
                <div className="mb-3 flex h-24 items-center justify-center rounded-xl bg-linear-to-br from-blue-500/10 to-indigo-500/10 text-4xl">
                  {item.emoji}
                </div>
                <p className="text-sm font-semibold text-white">{item.name}</p>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-xs text-blue-300/70">{item.rarity}</span>
                  <span className="text-xs font-medium text-emerald-400">{item.price} SOL</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features section */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-4xl">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-white">Everything you need</h2>
            <p className="mt-3 text-white/40">A complete platform for blockchain gaming economies.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-white/7 bg-white/3 p-6 transition hover:border-white/10 hover:bg-white/5"
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                  {f.icon}
                </div>
                <h3 className="mb-1.5 text-base font-semibold text-white">{f.title}</h3>
                <p className="text-sm leading-relaxed text-white/40">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
