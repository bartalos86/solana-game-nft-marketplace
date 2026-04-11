import { isAddress, zeroAddress } from 'viem'
import {
  createEthPublicClient,
  createPlatformWalletClient,
  GAME_FACTORY_ADDRESS,
  gameFactoryAbi,
} from '@/lib/eth-contracts'

const DEFAULT_LOG_LOOKBACK_BLOCKS = 250_000n
const DEFAULT_LOG_CHUNK_SIZE = 20_000n
const DEFAULT_GAMES_CACHE_TTL_MS = 15_000
const DEFAULT_READ_BATCH_SIZE = 20

type GamesCache = {
  expiresAt: number
  data: DecodedGame[]
}

let gamesCache: GamesCache | null = null

export interface DecodedGame {
  publicKey: string
  authority: string
  name: string
  description: string
  imageUri: string
  uri: string
  category: string
  feeRecipient: string
  feePercentBps: number
  bump: number
}

async function resolveLogsFromBlock(client: ReturnType<typeof createEthPublicClient>): Promise<bigint> {
  const rawFromEnv =
    process.env.GAME_FACTORY_FROM_BLOCK ??
    process.env.NEXT_PUBLIC_GAME_FACTORY_FROM_BLOCK
  if (rawFromEnv && /^\d+$/.test(rawFromEnv)) {
    return BigInt(rawFromEnv)
  }

  const latest = await client.getBlockNumber()
  return latest > DEFAULT_LOG_LOOKBACK_BLOCKS ? latest - DEFAULT_LOG_LOOKBACK_BLOCKS : 0n
}

function resolveLogChunkSize(): bigint {
  const raw = process.env.GAME_FACTORY_LOG_CHUNK_SIZE
  if (!raw || !/^\d+$/.test(raw)) return DEFAULT_LOG_CHUNK_SIZE
  const parsed = BigInt(raw)
  return parsed > 0n ? parsed : DEFAULT_LOG_CHUNK_SIZE
}

function resolveGamesCacheTtlMs(): number {
  const raw = process.env.GAMES_CACHE_TTL_MS
  if (!raw || !/^\d+$/.test(raw)) return DEFAULT_GAMES_CACHE_TTL_MS
  return Number(raw)
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return [arr]
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size))
  }
  return out
}

type ChainGame = {
  authority: `0x${string}`
  name: string
  description: string
  imageUri: string
  uri: string
  category: string
  feeRecipient: `0x${string}`
  feePercentBps: number
  exists: boolean
}

function toDecodedGame(game: ChainGame): DecodedGame | null {
  const { authority, name, description, imageUri, uri, category, feeRecipient, feePercentBps, exists } = game
  if (!exists) return null
  return {
    publicKey: authority,
    authority,
    name,
    description,
    imageUri,
    uri,
    category,
    feeRecipient,
    feePercentBps,
    bump: 0,
  }
}

export async function fetchGameByAuthority(authority: string): Promise<DecodedGame | null> {
  if (!isAddress(authority)) return null
  const client = createEthPublicClient()
  const game = (await client.readContract({
    address: GAME_FACTORY_ADDRESS,
    abi: gameFactoryAbi,
    functionName: 'getGame',
    args: [authority],
  })) as unknown as ChainGame
  return toDecodedGame(game)
}

export async function fetchAllGamesFromChain(): Promise<DecodedGame[]> {
  const now = Date.now()
  if (gamesCache && gamesCache.expiresAt > now) {
    return gamesCache.data
  }

  const client = createEthPublicClient()
  const fromBlock = await resolveLogsFromBlock(client)
  const toBlock = await client.getBlockNumber()
  const chunkSize = resolveLogChunkSize()

  const logs: Awaited<ReturnType<typeof client.getLogs>> = []
  let cursor = fromBlock
  while (cursor <= toBlock) {
    const end = cursor + chunkSize > toBlock ? toBlock : cursor + chunkSize
    const chunkLogs = await client.getLogs({
      address: GAME_FACTORY_ADDRESS,
      event: {
        type: 'event',
        name: 'GameRegistered',
        inputs: [
          { indexed: true, name: 'authority', type: 'address' },
          { indexed: false, name: 'name', type: 'string' },
        ],
      },
      fromBlock: cursor,
      toBlock: end,
    })
    logs.push(...chunkLogs)
    cursor = end + 1n
  }

  const authorities = Array.from(new Set(logs.map((log) => log.args.authority).filter(Boolean)))
  const games: Array<DecodedGame | null> = []
  for (const authorityBatch of chunkArray(authorities, DEFAULT_READ_BATCH_SIZE)) {
    const batchGames = await Promise.all(
      authorityBatch.map((authority) =>
        client
          .readContract({
            address: GAME_FACTORY_ADDRESS,
            abi: gameFactoryAbi,
            functionName: 'getGame',
            args: [authority as `0x${string}`],
          })
          .then((game) => toDecodedGame(game as unknown as ChainGame)),
      ),
    )
    games.push(...batchGames)
  }

  const resolvedGames = games
    .filter((game): game is DecodedGame => game !== null)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))

  gamesCache = {
    expiresAt: now + resolveGamesCacheTtlMs(),
    data: resolvedGames,
  }

  return resolvedGames
}

export type RegisterGameOnChainParams = {
  name: string
  description?: string | null
  imageUrl?: string | null
  uri?: string | null
  category: string
  authority: `0x${string}`
  feePercentBps?: number
}

export async function registerGameOnChain(params: RegisterGameOnChainParams): Promise<`0x${string}`> {
  if (!isAddress(params.authority) || params.authority === zeroAddress) {
    throw new Error('Invalid game authority address')
  }

  const client = createEthPublicClient()
  const { account, walletClient } = createPlatformWalletClient()
  const txHash = await walletClient.writeContract({
    address: GAME_FACTORY_ADDRESS,
    abi: gameFactoryAbi,
    functionName: 'createGame',
    args: [
      {
        authority: params.authority,
        name: params.name,
        description: params.description ?? '',
        imageUri: params.imageUrl ?? '',
        uri: params.uri ?? '',
        category: params.category,
        feeRecipient: params.authority,
        feePercentBps: params.feePercentBps ?? 0,
      },
    ],
    account,
    chain: walletClient.chain,
  })
  await client.waitForTransactionReceipt({ hash: txHash })
  gamesCache = null
  return txHash
}
