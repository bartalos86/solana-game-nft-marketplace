'use server'

import { registerGameOnChain } from '@/lib/game-registry-anchor'

export type RegisterGameOnChainParams = {
  name: string
  description?: string | null
  imageUrl?: string | null
  uri?: string | null
  category: string
  authorityAddress: `0x${string}`
  feePercentBps?: number
}

export type RegisterGameOnChainResult =
  | { data: { txHash: `0x${string}` }; error?: undefined }
  | { data?: undefined; error: string }

export async function registerGameOnChainAction(
  params: RegisterGameOnChainParams,
): Promise<RegisterGameOnChainResult> {
  try {
    const txHash = await registerGameOnChain({
      name: params.name,
      description: params.description ?? undefined,
      imageUrl: params.imageUrl ?? undefined,
      uri: params.uri ?? undefined,
      category: params.category,
      authority: params.authorityAddress,
      feePercentBps: params.feePercentBps,
    })
    return { data: { txHash } }
  } catch (e) {
    console.error('registerGameOnChain', e)
    return {
      error: e instanceof Error ? e.message : 'Failed to register game on-chain',
    }
  }
}
