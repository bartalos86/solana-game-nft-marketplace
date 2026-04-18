import * as anchor from '@coral-xyz/anchor'
import { AnchorProvider, Program } from '@coral-xyz/anchor'
import bs58 from 'bs58'
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  Connection,
} from '@solana/web3.js'
import gameRegistryIdl from './idl/game_registry.json'
import type { GameRegistry } from './idl/game_registry-types'
import type { DecodedGame } from '@/lib/game-registry'
import {
  getAllRegisteredGames,
  getGameByAuthority as getGameByAuthorityFallback,
} from '@/lib/game-registry'

const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC ?? 'https://api.devnet.solana.com'

const IDL = gameRegistryIdl as { address: string; accounts?: { name: string }[] }

export const GAME_REGISTRY_PROGRAM_ID = new PublicKey(IDL.address)

export const GAME_REGISTRY_PLATFORM_AUTHORITY = ((): PublicKey => {
  const env = process.env.PLATFORM_GAME_REGISTRY_AUTHORITY
  return env ? new PublicKey(env) : new PublicKey('11111111111111111111111111111111')
})()

const GAME_ACCOUNT_NAMES = [
  IDL.accounts?.[0]?.name,
  'Game',
  'game',
].filter(Boolean) as string[]

function getConnection(): Connection {
  return new Connection(RPC, 'confirmed')
}

export function getPlatformKeypair(): Keypair {
  const raw = process.env.PLATFORM_GAME_REGISTRY_AUTHORITY_PRIVATE_KEY
  if (!raw) {
    throw new Error('PLATFORM_GAME_REGISTRY_AUTHORITY_PRIVATE_KEY is not set')
  }
  const secret = bs58.decode(raw)
  if (secret.length !== 64) {
    throw new Error(
      'PLATFORM_GAME_REGISTRY_AUTHORITY_PRIVATE_KEY must be base58-encoded 64-byte secret key',
    )
  }
  return Keypair.fromSecretKey(secret)
}

function getProgram(payer: PublicKey): Program<GameRegistry> {
  const connection = getConnection()
  const provider = new AnchorProvider(
    connection,
    {
      publicKey: payer,
      signTransaction: async () => null as never,
      signAllTransactions: async () => [],
    },
    { commitment: 'confirmed' },
  )
  anchor.setProvider(provider)
  return new anchor.Program<GameRegistry>(IDL as unknown as GameRegistry, provider)
}

/** Extra lamports on top of rent-exempt minimum for the new authority address. */
const REGISTRATION_ADDRESS_BUFFER_LAMPORTS = 5_000
/** Decoded Game account size (8 discriminator + struct payload). */
const GAME_ACCOUNT_SIZE_BYTES = 1123
/** Safety margin for tx fee/rounding uncertainty. */
const REGISTRATION_TX_FEE_BUFFER_LAMPORTS = 20_000

export function getGamePda(authority: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('game'), authority.toBuffer()],
    GAME_REGISTRY_PROGRAM_ID,
  )
  return pda
}

type DecodedGameAccount = {
  authority: PublicKey
  name: string
  description: string
  imageUri?: string
  uri: string
  category: string
  feeRecipient?: PublicKey
  feePercentBps?: number
  bump: number
}

function normalizeAccount(acc: DecodedGameAccount): Omit<DecodedGame, 'publicKey'> {
  const raw = acc as Record<string, unknown>
  const imageUri = (acc.imageUri ?? raw.image_uri) ?? ''
  const feeRecipientPk = acc.feeRecipient ?? (raw.fee_recipient as PublicKey | undefined)
  const feePercentBps = acc.feePercentBps ?? (raw.fee_percent_bps as number | undefined) ?? 0
  return {
    authority: acc.authority.toBase58(),
    name: acc.name,
    description: acc.description ?? '',
    imageUri: String(imageUri),
    uri: acc.uri ?? '',
    category: acc.category ?? '',
    feeRecipient: feeRecipientPk?.toBase58() ?? '',
    feePercentBps,
    bump: acc.bump,
  }
}

function toDecodedGame(publicKey: string, acc: DecodedGameAccount): DecodedGame {
  return { publicKey, ...normalizeAccount(acc) }
}

async function fetchGameAccount(
  pda: PublicKey,
): Promise<DecodedGameAccount | null> {
  const program = getProgram(SystemProgram.programId)
  const accountNamespace = program.account as unknown as Record<
    string,
    { fetchNullable: (key: PublicKey) => Promise<DecodedGameAccount | null> }
  >
  for (const name of GAME_ACCOUNT_NAMES) {
    const fetcher = accountNamespace[name]?.fetchNullable
    if (fetcher) {
      try {
        const account = await fetcher(pda)
        if (account) return account
      } catch {
        continue
      }
    }
  }
  return null
}

export async function fetchGameByAuthority(
  authority: PublicKey,
): Promise<DecodedGame | null> {
  const pda = getGamePda(authority)
  try {
    const account = await fetchGameAccount(pda)
    if (account) return toDecodedGame(pda.toBase58(), account)
  } catch (err) {
    console.warn('fetchGameByAuthority: Anchor failed, falling back to RPC', err)
  }
  return getGameByAuthorityFallback(getConnection(), authority)
}

/** Fetches all Game accounts from chain via RPC + manual decode (same path as single-game fetch). */
export async function fetchAllGamesFromChain(): Promise<DecodedGame[]> {
  const games = await getAllRegisteredGames(getConnection())
  return games.sort((a, b) =>
    (a.name ?? '').localeCompare(b.name ?? '', undefined, { sensitivity: 'base' }),
  )
}

export type BuildRegisterGameParams = {
  name: string
  description?: string | null
  imageUrl?: string | null
  uri?: string | null
  category: string
  feePercentBps?: number
  payer: PublicKey
  authorityKeypair: Keypair
}

/** Builds a partial register_game tx (platform signs; payer pays fee). Serialized base64 for client to sign and send. */
export async function buildRegisterGameTransaction(
  params: BuildRegisterGameParams,
): Promise<string> {
  const platformKeypair = getPlatformKeypair()
  const program = getProgram(platformKeypair.publicKey)
  const authority = params.authorityKeypair.publicKey
  const ix = await program.methods
    .registerGame(
      params.name,
      params.description ?? null,
      params.imageUrl ?? null,
      params.uri ?? null,
      params.category ?? null,
      null,
      params.feePercentBps ?? 0,
    )
    .accountsStrict({
      platformAuthority: platformKeypair.publicKey,
      authority,
      game: getGamePda(authority),
      systemProgram: SystemProgram.programId,
    })
    .instruction()

  const connection = getConnection()
  const { blockhash } = await connection.getLatestBlockhash('confirmed')
  const tx = new Transaction({ feePayer: params.payer }).add(ix)
  tx.recentBlockhash = blockhash
  tx.partialSign(platformKeypair)
  return Buffer.from(
    tx.serialize({ requireAllSignatures: false, verifySignatures: false }),
  ).toString('base64')
}

export type RegisterGameOnChainParams = {
  name: string
  description?: string | null
  imageUrl?: string | null
  uri?: string | null
  category: string
  authority: PublicKey
  feePercentBps?: number
}

/** Builds, signs, and sends register_game. Uses platform keypair from env. Server-only. */
export async function registerGameOnChain(
  params: RegisterGameOnChainParams,
): Promise<string> {
  const platformKeypair = getPlatformKeypair()
  const program = getProgram(platformKeypair.publicKey)
  const { authority, feePercentBps = 0 } = params

  const connection = getConnection()
  const rentExemptMin = await connection.getMinimumBalanceForRentExemption(0)
  const transferLamports = rentExemptMin + REGISTRATION_ADDRESS_BUFFER_LAMPORTS
  const gameAccountRentLamports = await connection.getMinimumBalanceForRentExemption(
    GAME_ACCOUNT_SIZE_BYTES,
  )
  const platformBalanceLamports = await connection.getBalance(platformKeypair.publicKey, 'confirmed')
  const requiredLamports =
    transferLamports + gameAccountRentLamports + REGISTRATION_TX_FEE_BUFFER_LAMPORTS
  if (platformBalanceLamports < requiredLamports) {
    throw new Error(
      `Insufficient platform SOL for registration. Required at least ${requiredLamports} lamports, current balance is ${platformBalanceLamports} lamports.`,
    )
  }

  const transferIx = SystemProgram.transfer({
    fromPubkey: platformKeypair.publicKey,
    toPubkey: authority,
    lamports: transferLamports,
  })

  const ix = await program.methods
    .registerGame(
      params.name,
      params.description ?? null,
      params.imageUrl ?? null,
      params.uri ?? null,
      params.category ?? null,
      null,
      feePercentBps,
    )
    .accountsStrict({
      platformAuthority: platformKeypair.publicKey,
      authority,
      game: getGamePda(authority),
      systemProgram: SystemProgram.programId,
    })
    .instruction()

  const { blockhash } = await connection.getLatestBlockhash('confirmed')
  const tx = new Transaction({ feePayer: platformKeypair.publicKey })
    .add(transferIx, ix)
  tx.recentBlockhash = blockhash
  tx.sign(platformKeypair)

  const sig = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  })
  await connection.confirmTransaction(sig, 'confirmed')
  return sig
}

export type BuildRemoveGameParams = {
  authority: PublicKey
}

/** Builds a signed remove_game tx. Caller sends (e.g. server or client). */
export async function buildRemoveGameTransaction(
  params: BuildRemoveGameParams,
): Promise<Transaction> {
  const platformKeypair = getPlatformKeypair()
  const program = getProgram(platformKeypair.publicKey)
  const { authority } = params

  const ix = await program.methods
    .removeGame()
    .accountsStrict({
      platformAuthority: platformKeypair.publicKey,
      authority,
      game: getGamePda(authority),
    })
    .instruction()

  const connection = getConnection()
  const { blockhash } = await connection.getLatestBlockhash('confirmed')
  const tx = new Transaction({ feePayer: platformKeypair.publicKey }).add(ix)
  tx.recentBlockhash = blockhash
  tx.partialSign(platformKeypair)
  return tx
}

export type RemoveGameOnChainParams = {
  authority: PublicKey
}

/** Sends remove_game for a single game authority. Server-only. */
export async function removeGameOnChain(
  params: RemoveGameOnChainParams,
): Promise<string> {
  const platformKeypair = getPlatformKeypair()
  const connection = getConnection()
  const tx = await buildRemoveGameTransaction({ authority: params.authority })
  const { blockhash } = await connection.getLatestBlockhash('confirmed')
  tx.recentBlockhash = blockhash
  tx.sign(platformKeypair)

  const sig = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  })
  await connection.confirmTransaction(sig, 'confirmed')
  return sig
}

export type RemoveAllGamesOnChainResult = {
  removed: Array<{ authority: string; signature: string }>
  failed: Array<{ authority: string; error: string }>
}

/** Removes all currently registered games via remove_game instruction. Server-only. */
export async function removeAllGamesOnChain(): Promise<RemoveAllGamesOnChainResult> {
  const games = await fetchAllGamesFromChain()
  const removed: RemoveAllGamesOnChainResult['removed'] = []
  const failed: RemoveAllGamesOnChainResult['failed'] = []

  for (const game of games) {
    try {
      const signature = await removeGameOnChain({
        authority: new PublicKey(game.authority),
      })
      removed.push({ authority: game.authority, signature })
    } catch (error) {
      failed.push({
        authority: game.authority,
        error: error instanceof Error ? error.message : 'Failed to remove game',
      })
    }
  }

  return { removed, failed }
}
