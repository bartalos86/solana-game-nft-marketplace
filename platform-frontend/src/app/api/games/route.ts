import { NextResponse } from 'next/server'
import { fetchAllGamesFromChain } from '@/lib/game-registry-anchor'

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
    solanaPublicKey: g.authority,
    ethereumPublicKey: '',
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
