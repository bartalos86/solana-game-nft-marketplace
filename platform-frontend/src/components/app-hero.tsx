import React from 'react'

export function AppHero({
  children,
  subtitle,
  title,
}: {
  children?: React.ReactNode
  subtitle?: React.ReactNode
  title?: React.ReactNode
}) {
  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0">
        {/* Geometric shapes */}
        <div className="absolute top-20 left-10 w-32 h-32 bg-blue-500/20 rounded-full blur-2xl"></div>
        <div className="absolute top-40 right-20 w-24 h-24 bg-indigo-500/20 rounded-full blur-2xl"></div>
        <div className="absolute bottom-32 left-1/4 w-40 h-40 bg-cyan-500/20 rounded-full blur-2xl"></div>

        {/* Grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.1)_1px,transparent_1px)] bg-[size:60px_60px]"></div>

        {/* Floating elements */}
        <div className="absolute top-1/3 right-1/4 w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
        <div className="absolute bottom-1/3 left-1/3 w-1 h-1 bg-cyan-400 rounded-full animate-pulse delay-1000"></div>
        <div className="absolute top-2/3 right-1/3 w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse delay-500"></div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex items-center min-h-screen container mx-auto">
        <div className=" px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">

            {/* Left Column - Text Content */}
            <div className="text-center lg:text-left mx-auto">
              {typeof title === 'string' ? (
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
                  {title}
                </h1>
              ) : (
                title
              )}

              {typeof subtitle === 'string' ? (
                <p className="text-lg md:text-xl text-blue-100/90 mb-8 max-w-lg lg:max-w-none leading-relaxed">
                  {subtitle}
                </p>
              ) : (
                subtitle
              )}

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-8">
                <button className="px-8 py-4 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl font-semibold text-white hover:from-blue-600 hover:to-indigo-700 transition-all duration-300 transform hover:scale-105 shadow-lg shadow-blue-500/50">
                  Explore Marketplace
                </button>
                <button className="px-8 py-4 backdrop-blur-lg bg-white/10 border border-white/30 rounded-2xl font-semibold text-white hover:bg-white/20 transition-all duration-300">
                  Register Game
                </button>
              </div>

              {/* Stats */}
              {/* <div className="grid grid-cols-3 gap-6 max-w-md mx-auto lg:mx-0">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-400">10K+</div>
                  <div className="text-sm text-blue-200/70">Users</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-indigo-400">50K+</div>
                  <div className="text-sm text-blue-200/70">NFTs</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-cyan-400">$2M+</div>
                  <div className="text-sm text-blue-200/70">Volume</div>
                </div>
              </div> */}

              {children}
            </div>

            {/* Right Column - Visual Elements */}
            <div className="relative">
              {/* Main NFT Display */}
              <div className="relative mx-auto  max-w-md">
                {/* Primary NFT Card */}
                <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-6 shadow-2xl shadow-blue-500/20 transform rotate-3 hover:rotate-0 transition-transform duration-500">
                  <div className="w-full h-64 bg-gradient-to-br from-blue-400/20 to-indigo-400/20 rounded-2xl mb-4 flex items-center justify-center">
                    <div className="text-6xl">🎮</div>
                  </div>
                  <div className="text-center">
                    <h3 className="text-lg font-semibold text-white mb-2">Epic Game Item</h3>
                    <p className="text-blue-200/80 text-sm">Legendary Sword of Power</p>
                  </div>
                </div>

                {/* Floating NFT Cards */}
                <div className="absolute -top-4 -right-4 backdrop-blur-lg bg-white/10 border border-white/20 rounded-2xl p-4 shadow-xl shadow-blue-500/20 transform -rotate-12 hover:rotate-0 transition-transform duration-500">
                  <div className="w-16 h-16 bg-gradient-to-br from-cyan-400/20 to-blue-400/20 rounded-xl flex items-center justify-center">
                    <div className="text-2xl">⚔️</div>
                  </div>
                </div>

                <div className="absolute -bottom-4 -left-4 backdrop-blur-lg bg-white/10 border border-white/20 rounded-2xl p-4 shadow-xl shadow-blue-500/20 transform rotate-12 hover:rotate-0 transition-transform duration-500">
                  <div className="w-16 h-16 bg-gradient-to-br from-indigo-400/20 to-purple-400/20 rounded-xl flex items-center justify-center">
                    <div className="text-2xl">🛡️</div>
                  </div>
                </div>
              </div>

              {/* Decorative Elements */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-transparent rounded-full blur-3xl"></div>
              <div className="absolute bottom-0 left-0 w-40 h-40 bg-gradient-to-br from-indigo-500/10 to-transparent rounded-full blur-3xl"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
