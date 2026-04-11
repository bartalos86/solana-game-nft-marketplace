import React from 'react'
import Link from 'next/link'

export function AppFooter() {
  return (
    <footer className="border-t border-white/6 bg-black/10 backdrop-blur-sm">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <div className="h-6 w-6 rounded-lg bg-linear-to-br from-indigo-400/70 to-cyan-300/70 ring-1 ring-white/20" />
            <span className="text-sm font-semibold text-white/60">MarktPlace</span>
          </div>

          {/* Nav links */}
          <div className="flex items-center gap-6">
            {[
              { label: 'Games', href: '/games' },
              { label: 'Register', href: '/games/register' },
              { label: 'Account', href: '/account' },
            ].map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                className="text-xs text-white/30 transition hover:text-white/60"
              >
                {label}
              </Link>
            ))}
          </div>

          {/* Copy */}
          <p className="text-xs text-white/20">
            © {new Date().getFullYear()} MarktPlace. Built on Solana.
          </p>
        </div>
      </div>
    </footer>
  )
}
