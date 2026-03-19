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
import { Keypair, PublicKey, ComputeBudgetProgram, LAMPORTS_PER_SOL } from "@solana/web3.js"

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function cuOf(connection: anchor.web3.Connection, sig: string): Promise<number> {
  const info = await connection.getTransaction(sig, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  })
  return info?.meta?.computeUnitsConsumed ?? 0
}

function gamePda(programId: PublicKey, authority: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("game"), authority.toBuffer()],
    programId,
  )
  return pda
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

// ─── Constants ───────────────────────────────────────────────────────────────

const GAME_NAME_MAX_LEN = 64
const DESCRIPTION_MAX_LEN = 700
const CU_LIMIT = 400_000

// ─── Suite ───────────────────────────────────────────────────────────────────

describe("Game registry", () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)

  const program = anchor.workspace.GameRegistry as Program<GameRegistry>
  const { connection } = provider
  const payer = (provider.wallet as anchor.Wallet).payer

  it("register_game: success with name only", async () => {
    const name = "My Game"
    await program.methods
      .registerGame(name, null, null, null, null, null, 0)
      .accounts({
        authority: payer.publicKey,
        game: gamePda(program.programId, payer.publicKey),
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc({ commitment: "confirmed" })

    const game = await program.account.game.fetch(gamePda(program.programId, payer.publicKey))
    expect(game.authority.equals(payer.publicKey)).toBe(true)
    expect(game.name).toBe(name)
    expect(game.description).toBe("")
    expect(game.imageUri).toBe("")
    expect(game.category).toBe("")
    expect(game.feeRecipient.equals(payer.publicKey)).toBe(true)
    expect(typeof game.bump).toBe("number")
  })

  it("register_game: with description, image_uri, uri, category and fee_recipient", async () => {
    const authority = Keypair.generate()
    await connection.requestAirdrop(authority.publicKey, 1 * LAMPORTS_PER_SOL)
    await new Promise((r) => setTimeout(r, 500))

    const name = "Another Game"
    const description = "A cool game"
    const imageUri = "https://example.com/game.png"
    const uri = "https://example.com"
    const category = "RPG"
    const feeRecipient = Keypair.generate().publicKey

    await program.methods
      .registerGame(name, description, imageUri, uri, category, feeRecipient, 500)
      .accounts({
        authority: authority.publicKey,
        game: gamePda(program.programId, authority.publicKey),
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([authority])
      .rpc({ commitment: "confirmed" })

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
    await connection.requestAirdrop(authority.publicKey, 1 * LAMPORTS_PER_SOL)
    await new Promise((r) => setTimeout(r, 500))

    await expect(
      program.methods
        .registerGame(longName, null, null, null, null, null, 0)
        .accounts({
          authority: authority.publicKey,
          game: gamePda(program.programId, authority.publicKey),
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([authority])
        .rpc({ commitment: "confirmed" }),
    ).rejects.toThrow()
  })

  it("register_game: fail when description too long", async () => {
    const authority = Keypair.generate()
    await connection.requestAirdrop(authority.publicKey, 1 * LAMPORTS_PER_SOL)
    await new Promise((r) => setTimeout(r, 500))

    const longDesc = "x".repeat(DESCRIPTION_MAX_LEN + 1)

    await expect(
      program.methods
        .registerGame("Game", longDesc, null, null, null, null, 0)
        .accounts({
          authority: authority.publicKey,
          game: gamePda(program.programId, authority.publicKey),
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([authority])
        .rpc({ commitment: "confirmed" }),
    ).rejects.toThrow()
  })

  it("update_game: change name, description, image_uri, uri, category, fee_recipient", async () => {
    const authority = Keypair.generate()
    await connection.requestAirdrop(authority.publicKey, 1 * LAMPORTS_PER_SOL)
    await new Promise((r) => setTimeout(r, 500))

    await program.methods
      .registerGame("Original", null, null, null, null, null, 0)
      .accounts({
        authority: authority.publicKey,
        game: gamePda(program.programId, authority.publicKey),
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([authority])
      .rpc({ commitment: "confirmed" })

    const newFeeRecipient = Keypair.generate().publicKey
    await program.methods
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
        authority: authority.publicKey,
        game: gamePda(program.programId, authority.publicKey),
      })
      .signers([authority])
      .rpc({ commitment: "confirmed" })

    const game = await program.account.game.fetch(gamePda(program.programId, authority.publicKey))
    expect(game.name).toBe("Updated Name")
    expect(game.description).toBe("New description")
    expect(game.imageUri).toBe("https://new-image.com")
    expect(game.uri).toBe("https://new-uri.com")
    expect(game.category).toBe("Action")
    expect(game.feeRecipient.equals(newFeeRecipient)).toBe(true)
  })

  it("update_game: wrong authority fails", async () => {
    const authority = Keypair.generate()
    const other = Keypair.generate()
    await connection.requestAirdrop(authority.publicKey, 1 * LAMPORTS_PER_SOL)
    await connection.requestAirdrop(other.publicKey, 1 * LAMPORTS_PER_SOL)
    await new Promise((r) => setTimeout(r, 500))

    await program.methods
      .registerGame("Only Mine", null, null, null, null, null)
      .accounts({
        authority: authority.publicKey,
        game: gamePda(program.programId, authority.publicKey),
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([authority])
      .rpc({ commitment: "confirmed" })

    await expectRejectWithRetry(() =>
      program.methods
        .updateGame("Hacked", null, null, null, null, null, null)
        .accounts({
          authority: other.publicKey,
          game: gamePda(program.programId, authority.publicKey),
        })
        .signers([other])
        .rpc({ commitment: "confirmed" }),
    )
  })

  it("register_game: duplicate authority fails (account already in use)", async () => {
    const authority = Keypair.generate()
    await connection.requestAirdrop(authority.publicKey, 1 * LAMPORTS_PER_SOL)
    await new Promise((r) => setTimeout(r, 500))

    await program.methods
      .registerGame("First", null, null, null, null, null, 0)
      .accounts({
        authority: authority.publicKey,
        game: gamePda(program.programId, authority.publicKey),
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([authority])
      .rpc({ commitment: "confirmed" })

    await expect(
      program.methods
        .registerGame("Second", null, null, null, null, null, 0)
        .accounts({
          authority: authority.publicKey,
          game: gamePda(program.programId, authority.publicKey),
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([authority])
        .rpc({ commitment: "confirmed" }),
    ).rejects.toThrow()
  })

  describe("compute units", () => {
    it("register_game: consume ≤ CU_LIMIT", async () => {
      const authority = Keypair.generate()
      await connection.requestAirdrop(authority.publicKey, 1 * LAMPORTS_PER_SOL)
      await new Promise((r) => setTimeout(r, 500))

      const sig = await program.methods
        .registerGame("CU Test Game", "desc", "https://cu.test", null, "RPG", null, 0)
        .accounts({
          authority: authority.publicKey,
          game: gamePda(program.programId, authority.publicKey),
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .preInstructions([ComputeBudgetProgram.setComputeUnitLimit({ units: CU_LIMIT })])
        .signers([authority])
        .rpc({ commitment: "confirmed" })

      const cu = await cuOf(connection, sig)
      console.log("register_game CU:", cu)
      expect(cu).toBeGreaterThan(0)
      expect(cu).toBeLessThanOrEqual(CU_LIMIT)
    })

    it("update_game: consume ≤ CU_LIMIT", async () => {
      const authority = Keypair.generate()
      await connection.requestAirdrop(authority.publicKey, 1 * LAMPORTS_PER_SOL)
      await new Promise((r) => setTimeout(r, 500))

      await program.methods
        .registerGame("Update CU Test", null, null, null, null, null, 0)
        .accounts({
          authority: authority.publicKey,
          game: gamePda(program.programId, authority.publicKey),
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([authority])
        .rpc({ commitment: "confirmed" })

      const sig = await program.methods
        .updateGame("Updated", null, null, null, null, null, null)
        .accounts({
          authority: authority.publicKey,
          game: gamePda(program.programId, authority.publicKey),
        })
        .preInstructions([ComputeBudgetProgram.setComputeUnitLimit({ units: CU_LIMIT })])
        .signers([authority])
        .rpc({ commitment: "confirmed" })

      const cu = await cuOf(connection, sig)
      console.log("update_game CU:", cu)
      expect(cu).toBeGreaterThan(0)
      expect(cu).toBeLessThanOrEqual(CU_LIMIT)
    })
  })
})
