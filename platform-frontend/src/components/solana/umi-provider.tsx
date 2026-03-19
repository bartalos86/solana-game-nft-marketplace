"use client"
import { FC, ReactNode, useMemo } from 'react'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  TorusWalletAdapter,
  LedgerWalletAdapter,
} from '@solana/wallet-adapter-wallets'
import { clusterApiUrl } from '@solana/web3.js'
import dynamic from 'next/dynamic'
import '@solana/wallet-adapter-react-ui/styles.css'
import { createContext, useContext, useState } from 'react'

export const WalletButton = dynamic(async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton, {
  ssr: false,
})
export const WalletDisconnectButton = dynamic(async () => (await import('@solana/wallet-adapter-react-ui')).WalletDisconnectButton, {
  ssr: false,
})

export type Cluster = 'devnet' | 'testnet' | 'mainnet-beta' | 'localnet'

export interface ClusterContextType {
  cluster: Cluster
  setCluster: (cluster: Cluster) => void
  endpoint: string
}

const ClusterContext = createContext<ClusterContextType | undefined>(undefined)

export const useCluster = () => {
  const context = useContext(ClusterContext)
  if (!context) {
    throw new Error('useCluster must be used within SolanaProvider')
  }
  return context
}

export const ClusterButton: FC = () => {
  const { cluster, setCluster } = useCluster()

  return (
    <select
      value={cluster}
      onChange={(e) => setCluster(e.target.value as Cluster)}
      className="px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 hover:bg-gray-700 cursor-pointer"
    >
      <option value="devnet">Devnet</option>
      <option value="testnet">Testnet</option>
      <option value="mainnet-beta">Mainnet Beta</option>
      <option value="localnet">Localnet</option>
    </select>
  )
}

export function UmiProvider({ children }: { children: ReactNode }) {
  const [cluster, setCluster] = useState<Cluster>('devnet')

  const endpoint = useMemo(() => {
    if (cluster === 'localnet') {
      return 'http://localhost:8899'
    }
    return clusterApiUrl(cluster as WalletAdapterNetwork)
  }, [cluster])

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      new TorusWalletAdapter(),
      new LedgerWalletAdapter(),
    ],
    []
  )

  return (
    <ClusterContext.Provider value={{ cluster, setCluster, endpoint }}>
      <ConnectionProvider endpoint={endpoint}>
        <WalletProvider wallets={wallets} autoConnect>
          <WalletModalProvider>{children}</WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </ClusterContext.Provider>
  )
}