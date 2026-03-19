"use client"
import React, { useState, useEffect } from "react"
import { Menu, X } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ClusterButton, WalletButton } from '@/components/solana/umi-provider'

const NAV_LINKS = [
  { label: "Games", href: "/games" },
  { label: "Marketplace", href: "/marketplace" },
  { label: "Register Game", href: "/games/register" },
  { label: "Account", href: "/account" },
]

export function Navbar() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  function isActive(href: string) {
    if (href === '/') return pathname === '/'
    if (!pathname.startsWith(href)) return false
    // Yield to a more specific nav link if one also matches
    const moreSpecific = NAV_LINKS.some(
      (link) =>
        link.href !== href &&
        link.href.length > href.length &&
        pathname.startsWith(link.href),
    )
    return !moreSpecific
  }

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="mx-auto max-w-6xl px-4">
        <div
          className={`mt-3 flex items-center justify-between rounded-2xl border px-4 py-3 transition-all duration-300 ${
            scrolled
              ? 'border-white/10 bg-black/60 shadow-xl shadow-black/20 backdrop-blur-2xl'
              : 'border-white/7 bg-white/3 backdrop-blur-xl'
          }`}
        >
          {/* Brand */}
          <Link href="/" className="group flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-linear-to-br from-indigo-400 to-cyan-400 shadow-md shadow-indigo-500/30" />
            <span className="text-sm font-bold tracking-wide text-white/80 transition group-hover:text-white">
              MarktPlace
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 md:flex">
            {NAV_LINKS.map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                  isActive(href)
                    ? 'bg-white/10 text-white'
                    : 'text-white/50 hover:bg-white/6 hover:text-white/80'
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-1 md:flex">
              <WalletButton />
              <ClusterButton />
            </div>

            {/* Mobile toggle */}
            <button
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/60 transition hover:bg-white/10 hover:text-white md:hidden"
              aria-label="Toggle menu"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X size={16} /> : <Menu size={16} />}
            </button>
          </div>
        </div>

        {/* Mobile drawer */}
        <div
          className={`transition-all duration-200 md:hidden ${
            open ? 'pointer-events-auto mt-2 opacity-100' : 'pointer-events-none mt-0 opacity-0'
          }`}
        >
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/70 p-2 backdrop-blur-2xl">
            {NAV_LINKS.map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`block rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                  isActive(href)
                    ? 'bg-white/10 text-white'
                    : 'text-white/50 hover:bg-white/6 hover:text-white/80'
                }`}
              >
                {label}
              </Link>
            ))}
            <div className="mt-2 flex gap-2 border-t border-white/6 pt-2">
              <WalletButton />
              <ClusterButton />
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
