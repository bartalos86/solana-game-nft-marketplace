/**
 * Game registry (Solana): fetch and decode Game accounts.
 * Program: anchor/programs/game_registry. Account seeds: ["game", authority].
 */

import { Connection, PublicKey } from '@solana/web3.js'
import { publicKey as umiPublicKey, type Umi } from '@metaplex-foundation/umi'

const PROGRAM_ID_BASE58 =
  process.env.NEXT_PUBLIC_GAME_REGISTRY_PROGRAM_ID ??
  '4jDnCxk12L9DNAiuMp3ddJYqFgsfpEW7aY4S7m8HFDwx'

export const GAME_REGISTRY_PROGRAM_ID = new PublicKey(PROGRAM_ID_BASE58)

const GAME_ACCOUNT_SIZE = 1123
const GAME_ACCOUNT_DISCRIMINATOR = new Uint8Array([27, 90, 166, 125, 74, 100, 121, 18])

const NAME_LEN = 64
const DESCRIPTION_LEN = 500
const IMAGE_URI_LEN = 200
const URI_LEN = 200
const CATEGORY_LEN = 64

export interface DecodedGame {
  publicKey: string
  authority: string
  name: string
  description: string
  imageUri: string
  uri: string
  category: string
  feeRecipient: string
  /** Fee in basis points (10000 = 100%). */
  feePercentBps: number
  bump: number
}

function readPubkey(data: Uint8Array, offset: number): string {
  return new PublicKey(data.subarray(offset, offset + 32)).toBase58()
}

function readBorshString(
  data: Uint8Array,
  offset: number,
  maxLen: number,
): { value: string; nextOffset: number } {
  const view = new DataView(data.buffer, data.byteOffset + offset, 4)
  const len = Math.min(view.getUint32(0, true), maxLen)
  const end = offset + 4 + len
  const bytes = data.subarray(offset + 4, end)
  const value = new TextDecoder().decode(bytes)
  return { value, nextOffset: end }
}

export function decodeGameAccount(data: Uint8Array, accountPublicKey: string): DecodedGame | null {
  if (data.length < GAME_ACCOUNT_SIZE) return null
  const disc = data.subarray(0, 8)
  if (!disc.every((b, i) => b === GAME_ACCOUNT_DISCRIMINATOR[i])) return null

  let o = 8 + 32
  const nameResult = readBorshString(data, o, NAME_LEN)
  const name = nameResult.value
  o = nameResult.nextOffset
  const descResult = readBorshString(data, o, DESCRIPTION_LEN)
  const description = descResult.value
  o = descResult.nextOffset
  const imageResult = readBorshString(data, o, IMAGE_URI_LEN)
  const imageUri = imageResult.value
  o = imageResult.nextOffset
  const uriResult = readBorshString(data, o, URI_LEN)
  const uri = uriResult.value
  o = uriResult.nextOffset
  const catResult = readBorshString(data, o, CATEGORY_LEN)
  const category = catResult.value
  o = catResult.nextOffset
  const feeRecipient = readPubkey(data, o)
  o += 32
  const feePercentBps = data[o]! | (data[o + 1]! << 8)
  const bump = data[o + 2]!

  return {
    publicKey: accountPublicKey,
    authority: readPubkey(data, 8),
    name,
    description,
    imageUri,
    uri,
    category,
    feeRecipient,
    feePercentBps,
    bump,
  }
}

export function getGamePda(authority: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('game'), authority.toBuffer()],
    GAME_REGISTRY_PROGRAM_ID
  )
  return pda
}

export async function isGameRegistered(
  connection: Connection,
  authority: PublicKey
): Promise<boolean> {
  const pda = getGamePda(authority)
  const account = await connection.getAccountInfo(pda)
  if (!account || account.data.length < GAME_ACCOUNT_SIZE) return false
  const data = account.data as Uint8Array
  return data.subarray(0, 8).every((b, i) => b === GAME_ACCOUNT_DISCRIMINATOR[i])
}

export async function getGameByAuthority(
  connection: Connection,
  authority: PublicKey
): Promise<DecodedGame | null> {
  const pda = getGamePda(authority)
  const account = await connection.getAccountInfo(pda)
  if (!account || account.data.length < GAME_ACCOUNT_SIZE) return null
  const data = account.data as Uint8Array
  return decodeGameAccount(data, pda.toBase58())
}

export async function getAllRegisteredGames(connection: Connection): Promise<DecodedGame[]> {
  const accounts = await connection.getProgramAccounts(GAME_REGISTRY_PROGRAM_ID, {
    commitment: 'confirmed',
  })

  const games: DecodedGame[] = []
  for (const { pubkey, account } of accounts) {
    const data = account.data as Uint8Array
    if (data.length < GAME_ACCOUNT_SIZE) continue
    if (!data.subarray(0, 8).every((b, i) => b === GAME_ACCOUNT_DISCRIMINATOR[i])) continue
    const game = decodeGameAccount(data, pubkey.toBase58())
    if (game) games.push(game)
  }
  return games
}

export async function getAllRegisteredGamesWithUmi(umi: Umi): Promise<DecodedGame[]> {
  const programId = umiPublicKey(PROGRAM_ID_BASE58)
  const accounts = await umi.rpc.getProgramAccounts(programId, {
    dataSlice: { offset: 0, length: GAME_ACCOUNT_SIZE },
    filters: [{ dataSize: GAME_ACCOUNT_SIZE }],
  })

  const games: DecodedGame[] = []
  for (const account of accounts) {
    const data = account.data
    const pubkey =
      typeof account.publicKey === 'string'
        ? account.publicKey
        : (account.publicKey as { toString(): string }).toString()
    const game = decodeGameAccount(data, pubkey)
    if (game) games.push(game)
  }
  return games
}
