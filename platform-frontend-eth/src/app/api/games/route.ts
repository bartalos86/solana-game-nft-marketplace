import { NextResponse } from 'next/server'
import { fetchAllGamesFromChain, removeAllGamesOnChain } from '@/lib/game-registry-anchor'

/** Shape expected by marketplace page (on-chain game mapped to legacy format). */
function toGameRecord(g: {
  authority: string
  name: string
  description: string
  imageUri: string
  uri: string
  category: string
}) {
  return {
    id: g.authority,
    name: g.name,
    imageUrl: g.imageUri || null,
    description: g.description || null,
    category: g.category,
    gameUrl: g.uri || null,
    ethereumPublicKey: g.authority,
    createdAt: new Date().toISOString(),
  }
}

export async function GET() {
  try {
    const games = await fetchAllGamesFromChain()
    return NextResponse.json(games.map(toGameRecord))
  } catch (e) {
    console.error('GET /api/games', e)
    return NextResponse.json(
      { error: 'Failed to fetch games' },
      { status: 500 }
    )
  }
}

export async function DELETE() {
  try {
    const result = await removeAllGamesOnChain()
    return NextResponse.json({
      removedCount: result.removed.length,
      failedCount: result.failed.length,
      removed: result.removed,
      failed: result.failed,
    })
  } catch (e) {
    console.error('DELETE /api/games', e)
    return NextResponse.json(
      { error: 'Failed to remove registered games' },
      { status: 500 }
    )
  }
}
