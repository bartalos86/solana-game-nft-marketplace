"use client"
import React, { useState } from "react";
import { Menu, X } from "lucide-react";
import { ClusterButton, WalletButton } from "../solana/solana-provider";
import { ThemeSelect } from "../theme-select";
import Link from "next/link";


export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="mx-auto max-w-6xl px-4">
        {/* Shell */}
        <div
          className="mt-4 p-4 flex items-center justify-between rounded-2xl border border-blue-900/70
                     bg-blue-900/10 backdrop-blur-2xl backdrop-filter shadow-2xl shadow-black/20
                     dark:bg-blue-900/10 dark:border-blue-900/20"
        >
          {/* Brand */}
          <Link href="/" 	replace={true}>
          <div className="group flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-indigo-400/70 to-cyan-300/70 ring-1 ring-white/20" />
            <span className="text-sm font-semibold tracking-wide text-white/90 group-hover:text-white
                           dark:text-white/90 dark:group-hover:text-white">
              MarktPlace
            </span>
          </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-6 md:flex">
            {[
              ["Explore", "/explore"],
              ["Games", "/games"],
              ["Collections", "/collections"],
              ["Stats", "/stats"],
            ].map(([label, href]) => (
              <Link
                key={label}
                href={href}
                className="text-sm text-white/75 transition hover:text-white
                           dark:text-white/75 dark:hover:text-white"
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            {/* <ConnectWalletButton /> */}
            <div className="text-sm flex items-center gap-1">
              <WalletButton />
              <ClusterButton />
              {/* <ThemeSelect /> */}
            </div>

            {/* Mobile menu button */}
            <button
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/20
                         bg-vlue/10 backdrop-blur-xl backdrop-filter shadow-lg shadow-black/20 md:hidden
                         hover:bg-blue/20 transition-all duration-200
                         dark:bg-blue/10 dark:border-blue/20 dark:hover:bg-white/20"
              aria-label="Toggle menu"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {/* Mobile drawer */}
        <div
          className={`md:hidden ${
            open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
          } transition-opacity duration-300`}
        >
          <div className="mt-2 overflow-hidden rounded-2xl border border-white/20 bg-white/10 p-2
                         backdrop-blur-xl backdrop-filter shadow-2xl shadow-black/20
                         dark:bg-white/10 dark:border-white/20">
            {[
              ["Explore", "/explore"],
              ["Games", "/games"],
              ["Collections", "/collections"],
              ["Stats", "/stats"],
            ].map(([label, href]) => (
              <a
                key={label}
                href={href}
                className="block rounded-xl px-3 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white
                           transition-all duration-200
                           dark:text-white/80 dark:hover:bg-white/10 dark:hover:text-white"
              >
                {label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}
