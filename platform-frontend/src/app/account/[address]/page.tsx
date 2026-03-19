'use client'

import { useConnection } from '@solana/wallet-adapter-react'
import { useQuery } from '@tanstack/react-query'
import { useCluster } from '@/components/solana/umi-provider'
import { useParams } from 'next/navigation'
import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js'

export default function AccountPage() {
  const params = useParams()
  const addressStr = typeof params?.address === 'string' ? params.address : null
  const { connection } = useConnection()
  const { cluster } = useCluster()

  const address = addressStr ? (() => {
    try {
      new PublicKey(addressStr)
      return addressStr
    } catch {
      return null
    }
  })() : null

  const { data: balance, isLoading, error } = useQuery({
    queryKey: ['balance', cluster, address],
    queryFn: () => connection.getBalance(new PublicKey(address!)),
    enabled: !!address,
  })

  if (!address) {
    return (
      <div className="hero min-h-[60vh] flex items-center justify-center">
        <div className="hero-content text-center flex flex-col items-center justify-center">
          <p className="text-white/60">Invalid account address</p>
        </div>
      </div>
    )
  }

  const sol = balance != null ? balance / LAMPORTS_PER_SOL : null

  return (
    <div className="hero min-h-[60vh] flex items-center justify-center">
      <div className="hero-content text-center flex flex-col items-center justify-center gap-4 max-w-md">
        <p className="text-sm text-white/60">{cluster}</p>
        <p className="text-sm font-mono text-white/80 break-all">{address}</p>
        {isLoading && <p className="text-white/60">…</p>}
        {error && <p className="text-red-400">Failed to load balance</p>}
        {!isLoading && !error && (
          <p className="text-3xl font-bold font-mono">
            {sol != null ? `${sol.toFixed(4)} SOL` : '—'}
          </p>
        )}
      </div>
    </div>
  )
}
