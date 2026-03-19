import { NextResponse } from 'next/server'
import { PublicKey } from '@solana/web3.js'
import { fetchGameByAuthority } from '@/lib/game-registry-anchor'
import { gameAddressParamsSchema } from '@/lib/validations/games'

/**
 * GET /api/onchain/games/[address]
 * Returns a single game by authority (address = game authority pubkey, same as in URL /games/[address]).
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ address?: string }> }
) {
  try {
    const resolved = await context.params
    const address = resolved?.address ?? new URL(request.url).pathname.split('/').filter(Boolean).pop() ?? ''
    const parsed = gameAddressParamsSchema.safeParse({ address })
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Valid game address (authority) required' },
        { status: 400 }
      )
    }
    const gameAddress = parsed.data.address
    let pubkey: PublicKey
    try {
      pubkey = new PublicKey(gameAddress)
    } catch {
      return NextResponse.json({ error: 'Invalid public key' }, { status: 400 })
    }
    const game = await fetchGameByAuthority(pubkey)
    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 })
    }
    return NextResponse.json(game)
  } catch (e) {
    console.error('GET /api/onchain/games/[address]', e)
    return NextResponse.json(
      { error: 'Failed to fetch game' },
      { status: 500 }
    )
  }
}
