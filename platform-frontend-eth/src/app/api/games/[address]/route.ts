import { NextResponse } from 'next/server'
import { firstZodMessage } from '@/lib/zod'
import { fetchGameByAuthority } from '@/lib/game-registry-anchor'
import { gameAddressParamsSchema, type GameAddressParams } from '@/lib/validations/games'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ address?: string }> }
) {
  try {
    const parsed = gameAddressParamsSchema.safeParse(await params)
    if (!parsed.success) {
      return NextResponse.json(
        { error: firstZodMessage(parsed.error, 'address required') },
        { status: 400 }
      )
    }
    const { address }: GameAddressParams = parsed.data
    const game = await fetchGameByAuthority(address)
    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 })
    }
    return NextResponse.json({
      name: game.name,
      ethereumPublicKey: game.authority,
      imageUrl: game.imageUri || null,
      description: game.description || null,
      category: game.category,
      gameUrl: game.uri || null,
      authority: game.authority,
      publicKey: game.publicKey,
    })
  } catch (e) {
    console.error('GET /api/games/[address]', e)
    return NextResponse.json(
      { error: 'Failed to fetch game' },
      { status: 500 }
    )
  }
}
