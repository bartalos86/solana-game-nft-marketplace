'use client'

import { WalletButton, useEthereum } from '@/components/ethereum/evm-provider'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function AccountPage() {
  const { address } = useEthereum()
  const router = useRouter()

  useEffect(() => {
    if (address) router.replace(`/account/${address}`)
  }, [address, router])

  return (
    <div className="hero min-h-[10vh] flex items-center justify-center">
      <div className="hero-content text-center flex flex-col items-center justify-center">
        <WalletButton />
      </div>
    </div>
  )
}
