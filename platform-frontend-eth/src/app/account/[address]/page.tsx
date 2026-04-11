'use client'

import { useQuery } from '@tanstack/react-query'
import { useEthereum } from '@/components/ethereum/evm-provider'
import { useParams } from 'next/navigation'
import { formatEther, isAddress } from 'viem'

export default function AccountPage() {
  const params = useParams()
  const addressStr = typeof params?.address === 'string' ? params.address : null
  const { publicClient, cluster } = useEthereum()

  const address = addressStr && isAddress(addressStr) ? addressStr : null

  const { data: balance, isLoading, error } = useQuery({
    queryKey: ['balance', cluster, address],
    queryFn: () => publicClient.getBalance({ address: address! }),
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

  const eth = balance != null ? formatEther(balance) : null

  return (
    <div className="hero min-h-[60vh] flex items-center justify-center">
      <div className="hero-content text-center flex flex-col items-center justify-center gap-4 max-w-md">
        <p className="text-sm text-white/60">{cluster}</p>
        <p className="text-sm font-mono text-white/80 break-all">{address}</p>
        {isLoading && <p className="text-white/60">…</p>}
        {error && <p className="text-red-400">Failed to load balance</p>}
        {!isLoading && !error && (
          <p className="text-3xl font-bold font-mono">
            {eth != null ? `${Number(eth).toFixed(4)} ETH` : '—'}
          </p>
        )}
      </div>
    </div>
  )
}
