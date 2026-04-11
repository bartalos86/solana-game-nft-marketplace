"use client"

import { FC, ReactNode, createContext, useContext, useEffect, useMemo, useState } from 'react'
import { createPublicClient, createWalletClient, custom, http } from 'viem'
import { foundry, sepolia } from 'viem/chains'
import { getConfiguredChain, getRpcUrl } from '@/lib/eth-contracts'

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>
      on?: (event: string, handler: (...args: unknown[]) => void) => void
      removeListener?: (event: string, handler: (...args: unknown[]) => void) => void
    }
  }
}

export type Cluster = 'sepolia' | 'anvil'

type EthereumContextType = {
  cluster: Cluster
  setCluster: (cluster: Cluster) => void
  endpoint: string
  address: `0x${string}` | null
  isConnecting: boolean
  connect: () => Promise<void>
  disconnect: () => void
  publicClient: ReturnType<typeof createPublicClient>
  walletClient: ReturnType<typeof createWalletClient> | null
}

const EthereumContext = createContext<EthereumContextType | undefined>(undefined)

function getEndpoint(cluster: Cluster): string {
  if (cluster === 'anvil') return 'http://127.0.0.1:8545'
  return getRpcUrl()
}

export const useEthereum = () => {
  const context = useContext(EthereumContext)
  if (!context) throw new Error('useEthereum must be used within EvmProvider')
  return context
}

export const useCluster = () => {
  const { cluster, setCluster, endpoint } = useEthereum()
  return { cluster, setCluster, endpoint }
}

export const WalletButton: FC = () => {
  const { address, connect, disconnect, isConnecting } = useEthereum()
  const short = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Connect Wallet'
  return (
    <button
      type="button"
      onClick={() => (address ? disconnect() : connect())}
      disabled={isConnecting}
      className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:border-white/20 hover:bg-white/10 disabled:opacity-60"
    >
      {isConnecting ? 'Connecting...' : short}
    </button>
  )
}

export const ClusterButton: FC = () => {
  const { cluster, setCluster } = useEthereum()
  return (
    <select
      value={cluster}
      onChange={(e) => setCluster(e.target.value as Cluster)}
      className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
    >
      <option value="sepolia">Sepolia</option>
      <option value="anvil">Anvil</option>
    </select>
  )
}

export function EvmProvider({ children }: { children: ReactNode }) {
  const [cluster, setCluster] = useState<Cluster>('sepolia')
  const [address, setAddress] = useState<`0x${string}` | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)

  const endpoint = useMemo(() => getEndpoint(cluster), [cluster])
  const publicClient = useMemo(
    () =>
      createPublicClient({
        chain: cluster === 'anvil' ? foundry : getConfiguredChain(sepolia.id),
        transport: http(endpoint),
      }),
    [cluster, endpoint],
  )

  const walletClient = useMemo(() => {
    if (typeof window === 'undefined' || !window.ethereum) return null
    return createWalletClient({
      chain: cluster === 'anvil' ? foundry : sepolia,
      transport: custom(window.ethereum as Parameters<typeof custom>[0]),
    })
  }, [cluster])

  useEffect(() => {
    if (!walletClient) return
    walletClient.getAddresses().then((accounts) => {
      setAddress((accounts[0] as `0x${string}` | undefined) ?? null)
    })
  }, [walletClient])

  const connect = async () => {
    if (!walletClient) throw new Error('No EVM wallet found. Install MetaMask.')
    setIsConnecting(true)
    try {
      const [selected] = await walletClient.requestAddresses()
      setAddress((selected as `0x${string}` | undefined) ?? null)
    } finally {
      setIsConnecting(false)
    }
  }

  const disconnect = () => {
    setAddress(null)
  }

  return (
    <EthereumContext.Provider
      value={{
        cluster,
        setCluster,
        endpoint,
        address,
        isConnecting,
        connect,
        disconnect,
        publicClient,
        walletClient,
      }}
    >
      {children}
    </EthereumContext.Provider>
  )
}

