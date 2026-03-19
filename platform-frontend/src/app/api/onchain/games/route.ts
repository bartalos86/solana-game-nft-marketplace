import { NextResponse } from 'next/server'
import { fetchAllGamesFromChain } from '@/lib/game-registry-anchor'

/**
 * GET /api/onchain/games
 * Returns all games registered on-chain (decoded via Anchor program).
 */
export async function GET() {
  try {
    const games = await fetchAllGamesFromChain()
    return NextResponse.json(games)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    const stack = e instanceof Error ? e.stack : undefined
    console.error('GET /api/onchain/games', message, stack)
    return NextResponse.json(
      { error: 'Failed to fetch on-chain games' },
      { status: 500 }
    )
  }
}
