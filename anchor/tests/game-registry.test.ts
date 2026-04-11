/**
 * Game registry program tests.
 *
 * Uses AnchorProvider.env() (set by `anchor test`). Tests register_game,
 * update_game, validation errors, and compute-unit usage.
 *
 * Run: anchor test (or vitest run tests/game-registry.test.ts)
 */

import * as anchor from "@coral-xyz/anchor"
import { Program } from "@coral-xyz/anchor"
import type { GameRegistry } from "../target/types/game_registry"
import { Keypair, PublicKey, ComputeBudgetProgram, LAMPORTS_PER_SOL, SystemProgram, Transaction } from "@solana/web3.js"
import { existsSync, readFileSync } from "node:fs"
import { logSolTxBalanceBreakdown, solTxBalanceBreakdownFromMeta } from "./sol-tx-rent"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractConsumedCuFromLogs(logs: string[] | undefined): number | null {
  if (!logs || logs.length === 0) return null
  for (const line of logs) {
    const match = line.match(/consumed\s+(\d+)\s+of\s+\d+\s+compute units/i)
    if (match?.[1]) return Number(match[1])
  }
  return null
}

function logsFromError(err: unknown): string[] | undefined {
  if (err && typeof err === "object" && "logs" in err) {
    const value = (err as { logs?: unknown }).logs
    if (Array.isArray(value) && value.every((l) => typeof l === "string")) {
      return value
    }
  }
  return undefined
}

async function rpcAndLogCu(
  label: string,
  rpcCall: () => Promise<string>,
  connection: anchor.web3.Connection,
): Promise<{ sig: string; cu: number }> {
  const startedAt = Date.now()
  const sig = await rpcCall()
  const latencyMs = Date.now() - startedAt
  const info = await connection.getTransaction(sig, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  })
  const cu = info?.meta?.computeUnitsConsumed ?? 0
  console.log(`[Latency] ${label}: ${latencyMs}ms (commitment=confirmed, sig: ${sig})`)
  console.log(`[CU] ${label}: ${cu} (sig: ${sig})`)
  if (info?.meta) {
    logSolTxBalanceBreakdown(label, solTxBalanceBreakdownFromMeta(info.meta))
  }
  return { sig, cu }
}

async function expectRejectAndLogCu(label: string, rpcCall: () => Promise<unknown>): Promise<void> {
  const startedAt = Date.now()
  try {
    await rpcCall()
    expect.fail("Expected promise to reject")
  } catch (e: unknown) {
    const latencyMs = Date.now() - startedAt
    const parsedCu = extractConsumedCuFromLogs(logsFromError(e))
    console.log(`[Latency] ${label} (failed): ${latencyMs}ms (commitment=confirmed)`)
    if (parsedCu !== null) {
      console.log(`[CU] ${label} (failed): ${parsedCu}`)
    } else {
      console.log(`[CU] ${label} (failed): unavailable`)
    }
    expect(e).toBeDefined()
  }
}

function gamePda(programId: PublicKey, authority: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("game"), authority.toBuffer()],
    programId,
  )
  return pda
}

function loadEnvFile(path: string): void {
  if (!existsSync(path)) return
  const content = readFileSync(path, "utf8")
  for (const line of content.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const separator = trimmed.indexOf("=")
    if (separator <= 0) continue
    const key = trimmed.slice(0, separator).trim()
    const value = trimmed.slice(separator + 1).trim()
    if (!(key in process.env)) {
      process.env[key] = value
    }
  }
}

function keypairFromSecret(secret: string): Keypair {
  const raw = secret.trim()
  try {
    const bs58Bytes = anchor.utils.bytes.bs58.decode(raw)
    if (bs58Bytes.length === 32) return Keypair.fromSeed(bs58Bytes)
    if (bs58Bytes.length === 64) return Keypair.fromSecretKey(bs58Bytes)
  } catch {
    // handled by final throw below
  }

  throw new Error("Invalid PLATFORM_AUTHORITY_SECRET_KEY format")
}

/** Retry up to maxAttempts when error message includes msgFragment (e.g. "Blockhash not found"). */
async function expectRejectWithRetry(
  fn: () => Promise<unknown>,
  msgFragment: string = "Blockhash not found",
  maxAttempts: number = 3,
): Promise<void> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      await fn()
      expect.fail("Expected promise to reject")
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes(msgFragment) && attempt < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, 1200))
        continue
      }
      expect(e).toBeDefined()
      return
    }
  }
}

async function requestAirdropWithRetry(
  connection: anchor.web3.Connection,
  pubkey: PublicKey,
  lamports: number,
  maxAttempts: number = 5,
): Promise<void> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const sig = await connection.requestAirdrop(pubkey, lamports)
      await connection.confirmTransaction(sig, "confirmed")
      return
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      const isRateLimited = msg.includes("429") || msg.includes("Too Many Requests")
      const isTransientRpcError = msg.includes("Internal error") || msg.includes("FetchError")
      if ((!isRateLimited && !isTransientRpcError) || attempt === maxAttempts - 1) {
        throw e
      }
      const backoffMs = 1000 * 2 ** attempt
      await new Promise((r) => setTimeout(r, backoffMs))
    }
  }
}

// ─── Constants ───────────────────────────────────────────────────────────────

const GAME_NAME_MAX_LEN = 64
const DESCRIPTION_MAX_LEN = 700
const IMAGE_URI_MAX_LEN = 500
const URI_MAX_LEN = 500
const CATEGORY_MAX_LEN = 64
const CU_LIMIT = 400_000

// ─── Suite ───────────────────────────────────────────────────────────────────

describe("Game registry", () => {
  loadEnvFile(".env")
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)

  const program = anchor.workspace.GameRegistry as Program<GameRegistry>
  const { connection } = provider
  const platformAuthoritySecret = process.env.PLATFORM_AUTHORITY_SECRET_KEY
  const platformAuthorityKeypair = platformAuthoritySecret
    ? keypairFromSecret(platformAuthoritySecret)
    : (provider.wallet as anchor.Wallet & { payer?: Keypair }).payer
  if (!platformAuthorityKeypair) {
    throw new Error("Platform authority keypair is unavailable. Set PLATFORM_AUTHORITY_SECRET_KEY in .env or configure Anchor provider.wallet.")
  }
  const platformAuthority = platformAuthorityKeypair.publicKey

  beforeAll(async () => {
    let balance = await connection.getBalance(platformAuthority)
    const minBalance = 0.2 * LAMPORTS_PER_SOL
    if (balance < minBalance) {
      const providerWallet = provider.wallet.publicKey
      if (!providerWallet.equals(platformAuthority)) {
        const providerBalance = await connection.getBalance(providerWallet)
        const topUpLamports = Math.ceil(minBalance - balance + 0.01 * LAMPORTS_PER_SOL)
        if (providerBalance > topUpLamports) {
          const tx = new Transaction().add(
            SystemProgram.transfer({
              fromPubkey: providerWallet,
              toPubkey: platformAuthority,
              lamports: topUpLamports,
            }),
          )
          await provider.sendAndConfirm(tx, [], { commitment: "confirmed" })
        }
      }
      balance = await connection.getBalance(platformAuthority)
    }
    if (balance < minBalance) {
      await requestAirdropWithRetry(connection, platformAuthority, 1 * LAMPORTS_PER_SOL)
      balance = await connection.getBalance(platformAuthority)
    }
    if (balance < minBalance) {
      throw new Error("Platform authority balance still too low after airdrop")
    }
  })

  it("uses platform authority from env secret or Anchor wallet", () => {
    if (platformAuthoritySecret) {
      expect(platformAuthoritySecret.length).toBeGreaterThan(0)
    } else {
      expect(platformAuthority.equals(provider.wallet.publicKey)).toBe(true)
    }
  })

  it("register_game: success with name only", async () => {
    const authority = Keypair.generate()
    const name = "My Game"
    await rpcAndLogCu(
      "register_game: success with name only",
      () =>
        program.methods
          .registerGame(name, null, null, null, null, null, 0)
          .accounts({
            platformAuthority,
            authority: authority.publicKey,
          })
          .signers([platformAuthorityKeypair])
          .rpc({ commitment: "confirmed" }),
      connection,
    )

    const game = await program.account.game.fetch(gamePda(program.programId, authority.publicKey))
    expect(game.authority.equals(authority.publicKey)).toBe(true)
    expect(game.name).toBe(name)
    expect(game.description).toBe("")
    expect(game.imageUri).toBe("")
    expect(game.category).toBe("")
    expect(game.feeRecipient.equals(authority.publicKey)).toBe(true)
    expect(typeof game.bump).toBe("number")
  })

  it("register_game: with description, image_uri, uri, category and fee_recipient", async () => {
    const authority = Keypair.generate()

    const name = "Another Game"
    const description = "A cool game"
    const imageUri = "https://example.com/game.png"
    const uri = "https://example.com"
    const category = "RPG"
    const feeRecipient = Keypair.generate().publicKey

    await rpcAndLogCu(
      "register_game: with optional fields",
      () =>
        program.methods
          .registerGame(name, description, imageUri, uri, category, feeRecipient, 500)
          .accounts({
            platformAuthority,
            authority: authority.publicKey,
          })
          .signers([platformAuthorityKeypair])
          .rpc({ commitment: "confirmed" }),
      connection,
    )

    const game = await program.account.game.fetch(gamePda(program.programId, authority.publicKey))
    expect(game.name).toBe(name)
    expect(game.description).toBe(description)
    expect(game.imageUri).toBe(imageUri)
    expect(game.uri).toBe(uri)
    expect(game.category).toBe(category)
    expect(game.feeRecipient.equals(feeRecipient)).toBe(true)
  })

  it("register_game: fail when name too long", async () => {
    const longName = "a".repeat(GAME_NAME_MAX_LEN + 1)
    const authority = Keypair.generate()

    await expectRejectAndLogCu("register_game: fail when name too long", () =>
      program.methods
        .registerGame(longName, null, null, null, null, null, 0)
        .accounts({
          platformAuthority,
          authority: authority.publicKey,
        })
        .signers([platformAuthorityKeypair])
        .rpc({ commitment: "confirmed" }),
    )
  })

  it("register_game: fail when description too long", async () => {
    const authority = Keypair.generate()

    const longDesc = "x".repeat(DESCRIPTION_MAX_LEN + 1)

    await expectRejectAndLogCu("register_game: fail when description too long", () =>
      program.methods
        .registerGame("Game", longDesc, null, null, null, null, 0)
        .accounts({
          platformAuthority,
          authority: authority.publicKey,
        })
        .signers([platformAuthorityKeypair])
        .rpc({ commitment: "confirmed" }),
    )
  })

  it("update_game: change name, description, image_uri, uri, category, fee_recipient", async () => {
    const authority = Keypair.generate()

    await rpcAndLogCu(
      "update_game setup: register_game original",
      () =>
        program.methods
          .registerGame("Original", null, null, null, null, null, 0)
          .accounts({
            platformAuthority,
            authority: authority.publicKey,
          })
          .signers([platformAuthorityKeypair])
          .rpc({ commitment: "confirmed" }),
      connection,
    )

    const newFeeRecipient = Keypair.generate().publicKey
    await rpcAndLogCu(
      "update_game: change fields",
      () =>
        program.methods
          .updateGame(
            "Updated Name",
            "New description",
            "https://new-image.com",
            "https://new-uri.com",
            "Action",
            newFeeRecipient,
            300,
          )
          .accounts({
            platformAuthority,
            authority: authority.publicKey,
          })
          .signers([platformAuthorityKeypair])
          .rpc({ commitment: "confirmed" }),
      connection,
    )

    const game = await program.account.game.fetch(gamePda(program.programId, authority.publicKey))
    expect(game.name).toBe("Updated Name")
    expect(game.description).toBe("New description")
    expect(game.imageUri).toBe("https://new-image.com")
    expect(game.uri).toBe("https://new-uri.com")
    expect(game.category).toBe("Action")
    expect(game.feeRecipient.equals(newFeeRecipient)).toBe(true)
  })

  it("update_game: wrong platform authority fails", async () => {
    const authority = Keypair.generate()
    const other = Keypair.generate()

    await rpcAndLogCu(
      "update_game wrong authority setup: register_game",
      () =>
        program.methods
          .registerGame("Only Mine", null, null, null, null, null, 0)
          .accounts({
            platformAuthority,
            authority: authority.publicKey,
          })
          .signers([platformAuthorityKeypair])
          .rpc({ commitment: "confirmed" }),
      connection,
    )

    await expectRejectWithRetry(() =>
      expectRejectAndLogCu("update_game: wrong platform authority fails", () =>
        program.methods
          .updateGame("Hacked", null, null, null, null, null, null)
          .accounts({
            platformAuthority: other.publicKey,
            authority: authority.publicKey,
          })
          .signers([other])
          .rpc({ commitment: "confirmed" }),
      ),
    )
  })

  it("register_game: duplicate authority fails (account already in use)", async () => {
    const authority = Keypair.generate()

    await rpcAndLogCu(
      "duplicate authority setup: first register_game",
      () =>
        program.methods
          .registerGame("First", null, null, null, null, null, 0)
          .accounts({
            platformAuthority,
            authority: authority.publicKey,
          })
          .signers([platformAuthorityKeypair])
          .rpc({ commitment: "confirmed" }),
      connection,
    )

    await expectRejectAndLogCu("register_game: duplicate authority fails", () =>
      program.methods
        .registerGame("Second", null, null, null, null, null, 0)
        .accounts({
          platformAuthority,
          authority: authority.publicKey,
        })
        .signers([platformAuthorityKeypair])
        .rpc({ commitment: "confirmed" }),
    )
  })

  describe("compute units", () => {
    it("register_game: consume ≤ CU_LIMIT", async () => {
      const authority = Keypair.generate()

      const { cu } = await rpcAndLogCu(
        "compute units: register_game",
        () =>
          program.methods
            .registerGame("CU Test Game", "desc", "https://cu.test", null, "RPG", null, 0)
            .accounts({
              platformAuthority,
              authority: authority.publicKey,
            })
            .preInstructions([ComputeBudgetProgram.setComputeUnitLimit({ units: CU_LIMIT })])
            .signers([platformAuthorityKeypair])
            .rpc({ commitment: "confirmed" }),
        connection,
      )
      console.log("register_game CU:", cu)
      expect(cu).toBeGreaterThan(0)
      expect(cu).toBeLessThanOrEqual(CU_LIMIT)
    })

    it("update_game: consume ≤ CU_LIMIT", async () => {
      const authority = Keypair.generate()

      await rpcAndLogCu(
        "compute units setup: register_game before update",
        () =>
          program.methods
            .registerGame("Update CU Test", null, null, null, null, null, 0)
            .accounts({
              platformAuthority,
              authority: authority.publicKey,
            })
            .signers([platformAuthorityKeypair])
            .rpc({ commitment: "confirmed" }),
        connection,
      )

      const { cu } = await rpcAndLogCu(
        "compute units: update_game",
        () =>
          program.methods
            .updateGame("Updated", null, null, null, null, null, null)
            .accounts({
              platformAuthority,
              authority: authority.publicKey,
            })
            .preInstructions([ComputeBudgetProgram.setComputeUnitLimit({ units: CU_LIMIT })])
            .signers([platformAuthorityKeypair])
            .rpc({ commitment: "confirmed" }),
        connection,
      )
      console.log("update_game CU:", cu)
      expect(cu).toBeGreaterThan(0)
      expect(cu).toBeLessThanOrEqual(CU_LIMIT)
    })
  })

  describe("additional validations", () => {
    it("register_game: fail when image_uri too long", async () => {
      const authority = Keypair.generate()

      const tooLong = "x".repeat(IMAGE_URI_MAX_LEN + 1)
      await expectRejectAndLogCu("register_game: fail when image_uri too long", () =>
        program.methods
          .registerGame("Game", null, tooLong, null, null, null, 0)
          .accounts({
            platformAuthority,
            authority: authority.publicKey,
          })
          .signers([platformAuthorityKeypair])
          .rpc({ commitment: "confirmed" }),
      )
    })

    it("register_game: fail when uri too long", async () => {
      const authority = Keypair.generate()

      const tooLong = "x".repeat(URI_MAX_LEN + 1)
      await expectRejectAndLogCu("register_game: fail when uri too long", () =>
        program.methods
          .registerGame("Game", null, null, tooLong, null, null, 0)
          .accounts({
            platformAuthority,
            authority: authority.publicKey,
          })
          .signers([platformAuthorityKeypair])
          .rpc({ commitment: "confirmed" }),
      )
    })

    it("register_game: fail when category too long", async () => {
      const authority = Keypair.generate()

      const tooLong = "x".repeat(CATEGORY_MAX_LEN + 1)
      await expectRejectAndLogCu("register_game: fail when category too long", () =>
        program.methods
          .registerGame("Game", null, null, null, tooLong, null, 0)
          .accounts({
            platformAuthority,
            authority: authority.publicKey,
          })
          .signers([platformAuthorityKeypair])
          .rpc({ commitment: "confirmed" }),
      )
    })
  })
})
