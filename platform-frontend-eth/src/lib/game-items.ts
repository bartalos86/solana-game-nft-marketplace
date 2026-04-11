import {
  createEthPublicClient,
  GAME_FACTORY_ADDRESS,
  gameFactoryAbi,
  gameItemAbi,
} from '@/lib/marketplace'

export interface GameItemMetadata {
  id: string
  name: string
  imageUrl: string
  description: string
  attributes: { trait_type: string; value: string }[]
}

const DEFAULT_LOG_LOOKBACK_BLOCKS = 250_000n
const DEFAULT_LOG_CHUNK_SIZE = 20_000n

function normalizeUri(uri: string): string {
  if (uri.startsWith('ipfs://')) return uri.replace('ipfs://', 'https://ipfs.io/ipfs/')
  return uri
}

function resolveLogChunkSize(): bigint {
  const raw = process.env.NEXT_PUBLIC_GAME_ITEM_LOG_CHUNK_SIZE
  if (!raw || !/^\d+$/.test(raw)) return DEFAULT_LOG_CHUNK_SIZE
  const parsed = BigInt(raw)
  return parsed > 0n ? parsed : DEFAULT_LOG_CHUNK_SIZE
}

async function resolveMintLogsFromBlock(client: ReturnType<typeof createEthPublicClient>): Promise<bigint> {
  const rawFromEnv = process.env.NEXT_PUBLIC_GAME_ITEMS_FROM_BLOCK
  if (rawFromEnv && /^\d+$/.test(rawFromEnv)) {
    return BigInt(rawFromEnv)
  }

  const latest = await client.getBlockNumber()
  return latest > DEFAULT_LOG_LOOKBACK_BLOCKS ? latest - DEFAULT_LOG_LOOKBACK_BLOCKS : 0n
}

async function fetchTokenIdsFromMintLogs(
  owner: `0x${string}`,
  gameAuthority: `0x${string}`,
  gameItems: `0x${string}`,
) {
  const client = createEthPublicClient()
  const fromBlock = await resolveMintLogsFromBlock(client)
  const toBlock = await client.getBlockNumber()
  const chunkSize = resolveLogChunkSize()

  const tokenIds = new Set<bigint>()
  let cursor = fromBlock
  while (cursor <= toBlock) {
    const end = cursor + chunkSize > toBlock ? toBlock : cursor + chunkSize
    const logs = await client.getLogs({
      address: gameItems,
      event: {
        type: 'event',
        name: 'ItemMinted',
        inputs: [
          { indexed: true, name: 'tokenId', type: 'uint256' },
          { indexed: true, name: 'gameAuthority', type: 'address' },
          { indexed: true, name: 'to', type: 'address' },
          { indexed: false, name: 'amount', type: 'uint256' },
          { indexed: false, name: 'uri', type: 'string' },
        ],
      },
      args: { gameAuthority },
      fromBlock: cursor,
      toBlock: end,
    })

    for (const log of logs) {
      const tokenId = log.args.tokenId
      if (typeof tokenId === 'bigint') {
        tokenIds.add(tokenId)
      }
    }
    cursor = end + 1n
  }

  if (tokenIds.size === 0) return []
  const allTokenIds = Array.from(tokenIds)
  const balances = await Promise.all(
    allTokenIds.map((tokenId) =>
      client.readContract({
        address: gameItems,
        abi: gameItemAbi,
        functionName: 'balanceOf',
        args: [owner, tokenId],
      }),
    ),
  )

  return allTokenIds.filter((_, idx) => balances[idx] > 0n)
}

export async function fetchTokenMetadata(gameItems: `0x${string}`, tokenId: bigint): Promise<GameItemMetadata> {
  const client = createEthPublicClient()
  const uri = await client.readContract({
    address: gameItems,
    abi: gameItemAbi,
    functionName: 'uri',
    args: [tokenId],
  })

  let name = `Item #${tokenId.toString()}`
  let imageUrl = ''
  let description = ''
  let attributes: { trait_type: string; value: string }[] = []

  if (uri) {
    try {
      const res = await fetch(normalizeUri(uri))
      const json = (await res.json()) as Record<string, unknown>
      if (typeof json.name === 'string') name = json.name
      if (typeof json.image === 'string') imageUrl = json.image
      if (typeof json.description === 'string') description = json.description
      if (Array.isArray(json.attributes)) {
        attributes = json.attributes
          .filter((a) => typeof a === 'object' && a !== null)
          .map((a) => ({
            trait_type: String((a as { trait_type?: unknown }).trait_type ?? 'trait'),
            value: String((a as { value?: unknown }).value ?? ''),
          }))
      }
    } catch {
      // Keep fallback metadata.
    }
  }

  return {
    id: tokenId.toString(),
    name,
    imageUrl,
    description,
    attributes,
  }
}

export async function fetchItemsByGameAndOwner(owner: `0x${string}`, gameAuthority: `0x${string}`) {
  const client = createEthPublicClient()
  const gameItems = await client.readContract({
    address: GAME_FACTORY_ADDRESS,
    abi: gameFactoryAbi,
    functionName: 'gameItems',
  })
  let tokenIds: readonly bigint[] = []
  try {
    tokenIds = await client.readContract({
      address: gameItems,
      abi: gameItemAbi,
      functionName: 'getPlayerTokenIdsByGame',
      args: [owner, gameAuthority],
    })
  } catch {
    tokenIds = []
  }

  if (tokenIds.length === 0) {
    tokenIds = await fetchTokenIdsFromMintLogs(owner, gameAuthority, gameItems)
  }

  const items = await Promise.all(tokenIds.map((tokenId) => fetchTokenMetadata(gameItems, tokenId)))
  return { gameItems, items }
}
