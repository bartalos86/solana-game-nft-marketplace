import { createPublicClient, createWalletClient, fallback, http } from 'viem'
import { foundry, sepolia } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'

const DEFAULT_CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? '11155111')
const DEFAULT_RPC_URLS = [
  'https://ethereum-sepolia-rpc.publicnode.com',
  'https://rpc.sepolia.org',
]

export const GAME_FACTORY_ADDRESS = (process.env.NEXT_PUBLIC_GAME_FACTORY_ADDRESS ??
  '0xee0faee9073855c44c98b7c30f3426459256bf5b') as `0x${string}`

export const MARKETPLACE_ADDRESS = (process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS ??
  '0x46b7a3ba04c4737f8da3230f241b80d53876e879') as `0x${string}`

export function getConfiguredChain(chainId: number = DEFAULT_CHAIN_ID) {
  if (chainId === foundry.id || chainId === 31337) return foundry
  return sepolia
}

export function getRpcUrl() {
  return getRpcUrls()[0]
}

function normalizeToHttpRpcUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('wss://')) return `https://${trimmed.slice(6)}`
  if (trimmed.startsWith('ws://')) return `http://${trimmed.slice(5)}`
  return trimmed
}

function parseRpcList(raw: string | undefined): string[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((part) => normalizeToHttpRpcUrl(part))
    .filter(Boolean)
}

export function getRpcUrls(): string[] {
  const fromEnv = [
    ...parseRpcList(process.env.RPC_URL),
    ...parseRpcList(process.env.NEXT_PUBLIC_RPC_URL),
    ...parseRpcList(process.env.SEPOLIA_RPC_URL),
  ]

  const deduped = Array.from(new Set([...fromEnv, ...DEFAULT_RPC_URLS]))
  return deduped
}

function createRpcTransport() {
  const urls = getRpcUrls()
  const transports = urls.map((url) =>
    http(url, {
      timeout: 30_000,
      retryCount: 3,
      retryDelay: 1_000,
    }),
  )

  return transports.length === 1 ? transports[0] : fallback(transports)
}

export function createEthPublicClient() {
  return createPublicClient({
    chain: getConfiguredChain(),
    transport: createRpcTransport(),
  })
}

function parsePlatformPrivateKey(raw: string | undefined): `0x${string}` {
  if (!raw) {
    throw new Error('PLATFORM_PRIVATE_KEY is not set')
  }
  const trimmed = raw.trim().replace(/^['"]|['"]$/g, '')
  const normalized = trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new Error(
      'PLATFORM_PRIVATE_KEY must be a 32-byte hex key (64 hex chars), with optional 0x prefix',
    )
  }
  return normalized as `0x${string}`
}

export function createPlatformWalletClient() {
  const privateKey = parsePlatformPrivateKey(process.env.PLATFORM_PRIVATE_KEY)
  const account = privateKeyToAccount(privateKey)
  return {
    account,
    walletClient: createWalletClient({
      account,
      chain: getConfiguredChain(),
      transport: createRpcTransport(),
    }),
  }
}

export const gameFactoryAbi = [
  {
    type: 'function',
    name: 'createGame',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'input',
        type: 'tuple',
        components: [
          { name: 'authority', type: 'address' },
          { name: 'name', type: 'string' },
          { name: 'description', type: 'string' },
          { name: 'imageUri', type: 'string' },
          { name: 'uri', type: 'string' },
          { name: 'category', type: 'string' },
          { name: 'feeRecipient', type: 'address' },
          { name: 'feePercentBps', type: 'uint16' },
        ],
      },
    ],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'getGame',
    stateMutability: 'view',
    inputs: [{ name: 'authority', type: 'address' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'authority', type: 'address' },
          { name: 'name', type: 'string' },
          { name: 'description', type: 'string' },
          { name: 'imageUri', type: 'string' },
          { name: 'uri', type: 'string' },
          { name: 'category', type: 'string' },
          { name: 'feeRecipient', type: 'address' },
          { name: 'feePercentBps', type: 'uint16' },
          { name: 'exists', type: 'bool' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'removeGame',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'authority', type: 'address' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'gameItems',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'event',
    name: 'GameRegistered',
    inputs: [
      { name: 'authority', type: 'address', indexed: true },
      { name: 'name', type: 'string', indexed: false },
    ],
  },
] as const

export const gameItemAbi = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'id', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'getPlayerTokenIdsByGame',
    stateMutability: 'view',
    inputs: [
      { name: 'player', type: 'address' },
      { name: 'gameAuthority', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256[]' }],
  },
  {
    type: 'function',
    name: 'uri',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    type: 'function',
    name: 'tokenGameAuthority',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'isApprovedForAll',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'operator', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'setApprovalForAll',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'operator', type: 'address' },
      { name: 'approved', type: 'bool' },
    ],
    outputs: [],
  },
] as const

export const marketplaceAbi = [
  {
    type: 'function',
    name: 'listNFT',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_nft', type: 'address' },
      { name: '_tokenId', type: 'uint256' },
      { name: '_quantity', type: 'uint256' },
      { name: '_price', type: 'uint256' },
      { name: '_expiry', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'buyNFT',
    stateMutability: 'payable',
    inputs: [{ name: '_listingId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'cancelListing',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_listingId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'listingCounter',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'listings',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'uint256' }],
    outputs: [
      { name: 'seller', type: 'address' },
      { name: 'nft', type: 'address' },
      { name: 'tokenId', type: 'uint256' },
      { name: 'quantity', type: 'uint256' },
      { name: 'price', type: 'uint256' },
      { name: 'expiry', type: 'uint256' },
    ],
  },
] as const

