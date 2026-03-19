'use server'

import { registerGameOnChain } from '@/lib/game-registry-anchor'
import { PublicKey } from '@solana/web3.js'

export type RegisterGameOnChainParams = {
  name: string
  description?: string | null
  imageUrl?: string | null
  uri?: string | null
  category: string
  authorityPublicKey: string
  feePercentBps?: number
}

export type RegisterGameOnChainResult =
  | { data: { signature: string }; error?: undefined }
  | { data?: undefined; error: string }

/** Registers a game on-chain via platform wallet (env). Server-only. */
export async function registerGameOnChainAction(
  params: RegisterGameOnChainParams,
): Promise<RegisterGameOnChainResult> {
  try {
    const signature = await registerGameOnChain({
      name: params.name,
      description: params.description ?? undefined,
      imageUrl: params.imageUrl ?? undefined,
      uri: params.uri ?? undefined,
      category: params.category,
      authority: new PublicKey(params.authorityPublicKey),
      feePercentBps: params.feePercentBps,
    })
    return { data: { signature } }
  } catch (e) {
    console.error('registerGameOnChain', e)
    return {
      error: e instanceof Error ? e.message : 'Failed to register game on-chain',
    }
  }
}
