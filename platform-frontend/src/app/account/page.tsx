'use client'

import { useWallet } from '@solana/wallet-adapter-react'
import { WalletButton } from '@/components/solana/umi-provider'
import { redirect } from 'next/navigation'

export default function AccountPage() {
  const { publicKey } = useWallet()

  if (publicKey) {
    redirect(`/account/${publicKey.toBase58()}`)
  }

  return (
    <div className="hero min-h-[10vh] flex items-center justify-center">
      <div className="hero-content text-center flex flex-col items-center justify-center">
        <WalletButton />
      </div>
    </div>
  )
}
