/**
 * NFT Marketplace — compute-unit benchmarks using Metaplex Token Metadata SDK
 *
 * Same tests as marketplace-gas.test.ts but uses @metaplex-foundation/mpl-token-metadata
 * createMetadataAccountV3 and createMasterEditionV3 instead of hand-rolled instructions.
 *
 * Run: anchor test (or vitest run tests/marketplace-gas-metaplex-sdk.test.ts)
 * Anchor.toml must clone the Metaplex metadata program (see [test.validator]).
 */

import * as anchor from "@coral-xyz/anchor"
import { BN, Program } from "@coral-xyz/anchor"
import type { Marketplace } from "../target/types/marketplace"
import {
  createMint,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  createInitializeMint2Instruction,
  getMinimumBalanceForRentExemptMint,
  MINT_SIZE,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token"
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  ComputeBudgetProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js"
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults"
import { mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata"
import {
  createMetadataAccountV3,
  createMasterEditionV3,
} from "@metaplex-foundation/mpl-token-metadata"
import type { TransactionBuilder } from "@metaplex-foundation/umi"
import {
  createSignerFromKeypair,
  signerIdentity,
  signerPayer,
  none,
  some,
} from "@metaplex-foundation/umi"
import {
  fromWeb3JsKeypair,
  fromWeb3JsPublicKey,
  toWeb3JsLegacyTransaction,
} from "@metaplex-foundation/umi-web3js-adapters"
import { logSolTxBalanceBreakdown, solTxBalanceBreakdownFromMeta } from "./sol-tx-rent"

// ── Metaplex PDAs (for fixture / Anchor accounts; SDK derives internally) ───

const MPL_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s")

const metadataPda = (mint: PublicKey) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("metadata"), MPL_ID.toBuffer(), mint.toBuffer()],
    MPL_ID,
  )[0]

const masterEditionPda = (mint: PublicKey) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("metadata"), MPL_ID.toBuffer(), mint.toBuffer(), Buffer.from("edition")],
    MPL_ID,
  )[0]

// ── Helpers ─────────────────────────────────────────────────────────────────

async function sendTx(
  connection: anchor.web3.Connection,
  ixs: TransactionInstruction[],
  payer: Keypair,
  signers: Keypair[] = [payer],
): Promise<string> {
  const startedAt = Date.now()
  const tx = new Transaction().add(...ixs)
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
  tx.feePayer = payer.publicKey
  tx.sign(...signers)
  const sig = await connection.sendRawTransaction(tx.serialize())
  await connection.confirmTransaction(sig, "confirmed")
  const latencyMs = Date.now() - startedAt
  console.log(`[Latency] sendTx: ${latencyMs}ms (commitment=confirmed, sig: ${sig})`)
  const info = await connection.getTransaction(sig, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  })
  if (info?.meta) {
    logSolTxBalanceBreakdown("sendTx", solTxBalanceBreakdownFromMeta(info.meta))
  }
  return sig
}

async function cuOf(connection: anchor.web3.Connection, sig: string): Promise<number> {
  const info = await connection.getTransaction(sig, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  })
  const fromMeta = info?.meta?.computeUnitsConsumed
  if (typeof fromMeta === "number" && fromMeta > 0) return fromMeta
  return extractConsumedCuFromLogs(info?.meta?.logMessages) ?? 0
}

function extractConsumedCuFromLogs(logs: string[] | null | undefined): number | null {
  if (!logs || logs.length === 0) return null
  for (const line of logs) {
    const match = line.match(/consumed\s+(\d+)\s+of\s+\d+\s+compute units/i)
    if (match?.[1]) return Number(match[1])
  }
  return null
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
      if (!isRateLimited || attempt === maxAttempts - 1) {
        throw e
      }
      const backoffMs = 1000 * 2 ** attempt
      await new Promise((r) => setTimeout(r, backoffMs))
    }
  }
}

/** Send a UMI-built transaction (with optional compute limit) and return signature */
async function sendUmiTx(
  connection: anchor.web3.Connection,
  umi: ReturnType<typeof createUmi>,
  builder: TransactionBuilder,
  payer: Keypair,
  cuLimit?: number,
): Promise<string> {
  const signed = await builder.setFeePayer(umi.payer).buildAndSign(umi)
  const web3Tx = toWeb3JsLegacyTransaction(signed)
  const ixs: TransactionInstruction[] = [
    ...(cuLimit != null ? [ComputeBudgetProgram.setComputeUnitLimit({ units: cuLimit })] : []),
    ...web3Tx.instructions,
  ]
  return sendTx(connection, ixs, payer)
}

async function createFundedWallet(connection: anchor.web3.Connection, amountSol: number = 1): Promise<Keypair> {
  const wallet = Keypair.generate()
  await requestAirdropWithRetry(connection, wallet.publicKey, amountSol * LAMPORTS_PER_SOL)
  return wallet
}

// ── NFT fixture ─────────────────────────────────────────────────────────────

interface NftFixture {
  mint: PublicKey
  sellerAta: PublicKey
  listingPda: PublicKey
  metadata: PublicKey
  masterEdition: PublicKey
}

// ── Suite ───────────────────────────────────────────────────────────────────

describe("NFT Marketplace — compute units (Metaplex SDK)", () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)

  const program = anchor.workspace.Marketplace as Program<Marketplace>
  const { connection } = provider
  const payer = (provider.wallet as anchor.Wallet).payer

  const EXPIRY = new BN(Math.floor(Date.now() / 1000) + 7 * 24 * 3600)
  const PRICE = new BN(0.01 * LAMPORTS_PER_SOL)
  const CU_LIMIT = 100_000_000
  const MARKETPLACE_FEE_RECIPIENT = new PublicKey("5GLPnCWkDniHq4B7o7K5fsxRKf4xpprX2ENngRs4VGeB")

  beforeAll(async () => {
    const minBalance = 2 * LAMPORTS_PER_SOL
    let balance = await connection.getBalance(payer.publicKey)
    if (balance < minBalance) {
      await requestAirdropWithRetry(connection, payer.publicKey, 3 * LAMPORTS_PER_SOL)
      balance = await connection.getBalance(payer.publicKey)
    }
    if (balance < minBalance) {
      throw new Error("Payer balance still too low after airdrop")
    }

    const feeRecipientMin = 0.2 * LAMPORTS_PER_SOL
    const feeRecipientBalance = await connection.getBalance(MARKETPLACE_FEE_RECIPIENT)
    if (feeRecipientBalance < feeRecipientMin) {
      await requestAirdropWithRetry(connection, MARKETPLACE_FEE_RECIPIENT, 1 * LAMPORTS_PER_SOL)
    }
  })

  /** Umi instance bound to current connection and payer */
  function getUmi() {
    const umi = createUmi(connection).use(mplTokenMetadata())
    const signer = createSignerFromKeypair(umi, fromWeb3JsKeypair(payer))
    return umi.use(signerIdentity(signer)).use(signerPayer(signer))
  }

  async function timedRpc(label: string, rpcCall: () => Promise<string>): Promise<string> {
    const startedAt = Date.now()
    const sig = await rpcCall()
    const latencyMs = Date.now() - startedAt
    console.log(`[Latency] ${label}: ${latencyMs}ms (commitment=confirmed, sig: ${sig})`)
    const info = await connection.getTransaction(sig, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    })
    if (info?.meta) {
      logSolTxBalanceBreakdown(label, solTxBalanceBreakdownFromMeta(info.meta))
    }
    return sig
  }

  async function createNftFixture(): Promise<NftFixture> {
    const mint = await createMint(connection, payer, payer.publicKey, payer.publicKey, 0)
    const sellerAta = getAssociatedTokenAddressSync(mint, payer.publicKey)

    await sendTx(connection, [
      createAssociatedTokenAccountInstruction(payer.publicKey, sellerAta, payer.publicKey, mint),
    ], payer)
    await mintTo(connection, payer, mint, sellerAta, payer, 1)

    const umi = getUmi()
    const mintUmi = fromWeb3JsPublicKey(mint)
    const signer = umi.payer

    const metadataBuilder = createMetadataAccountV3(umi, {
      mint: mintUmi,
      mintAuthority: signer,
      data: {
        name: "T",
        symbol: "T",
        uri: "",
        sellerFeeBasisPoints: 0,
        creators: none(),
        collection: none(),
        uses: none(),
      },
      isMutable: true,
      collectionDetails: none(),
    })
    const masterEditionBuilder = createMasterEditionV3(umi, {
      mint: mintUmi,
      mintAuthority: signer,
      updateAuthority: signer,
      maxSupply: some(0),
    })

    const metaSig = await sendUmiTx(connection, umi, metadataBuilder, payer)
    await cuOf(connection, metaSig)
    const editionSig = await sendUmiTx(connection, umi, masterEditionBuilder, payer)
    await cuOf(connection, editionSig)

    const [listingPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("listing"), payer.publicKey.toBuffer(), mint.toBuffer()],
      program.programId,
    )

    return { mint, sellerAta, listingPda, metadata: metadataPda(mint), masterEdition: masterEditionPda(mint) }
  }

  it("list_nft: consume ≤ CU_LIMIT compute units", async () => {
    const { mint, metadata, masterEdition } = await createNftFixture()

    const sig = await timedRpc("list_nft", () =>
      program.methods
        .listNft(PRICE, EXPIRY)
        .accounts({
          seller: payer.publicKey,
          mint,
          metadata,
          masterEdition,
          sellerTokenRecord: null,
          escrowTokenRecord: null,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .preInstructions([ComputeBudgetProgram.setComputeUnitLimit({ units: CU_LIMIT })])
        .rpc({ commitment: "confirmed" }),
    )

    const cu = await cuOf(connection, sig)
    console.log("list_nft CU (SDK fixture):", cu)
    expect(cu).toBeGreaterThan(0)
    expect(cu).toBeLessThanOrEqual(CU_LIMIT)
  })

  it("buy_nft: consume ≤ CU_LIMIT compute units", async () => {
    const { mint, listingPda, metadata, masterEdition } = await createNftFixture()

    await timedRpc("list_nft (setup for buy_nft)", () =>
      program.methods
        .listNft(PRICE, EXPIRY)
        .accounts({
          seller: payer.publicKey,
          mint,
          metadata,
          masterEdition,
          sellerTokenRecord: null,
          escrowTokenRecord: null,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc({ commitment: "confirmed" }),
    )

    // Marketplace fee → static address (must match MARKETPLACE_FEE_RECIPIENT in program); update authority fee → NFT creator (payer).
    const sig = await timedRpc("buy_nft", () =>
      program.methods
        .buyNft()
        .accounts({
          buyer: payer.publicKey,
          seller: payer.publicKey,
          updateAuthorityFeeRecipient: payer.publicKey,
          mint,
          listing: listingPda,
          metadata,
          masterEdition,
          escrowTokenRecord: null,
          buyerTokenRecord: null,
          tokenProgram: TOKEN_PROGRAM_ID,
        } as any)
        .preInstructions([ComputeBudgetProgram.setComputeUnitLimit({ units: CU_LIMIT })])
        .rpc({ commitment: "confirmed" }),
    )

    const cu = await cuOf(connection, sig)
    console.log("buy_nft CU (SDK fixture):", cu)
    expect(cu).toBeGreaterThan(0)
    expect(cu).toBeLessThanOrEqual(CU_LIMIT)
  })

  it("cancel_listing: consume ≤ CU_LIMIT compute units", async () => {
    const { mint, listingPda, metadata, masterEdition } = await createNftFixture()

    await timedRpc("list_nft (setup for cancel_listing)", () =>
      program.methods
        .listNft(PRICE, EXPIRY)
        .accounts({
          seller: payer.publicKey,
          mint,
          metadata,
          masterEdition,
          sellerTokenRecord: null,
          escrowTokenRecord: null,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc({ commitment: "confirmed" }),
    )

    const sig = await timedRpc("cancel_listing", () =>
      program.methods
        .cancelListing()
        .accounts({
          mint,
          listing: listingPda,
          metadata,
          masterEdition,
          escrowTokenRecord: null,
          sellerTokenRecord: null,
          tokenProgram: TOKEN_PROGRAM_ID,
        } as any)
        .preInstructions([ComputeBudgetProgram.setComputeUnitLimit({ units: CU_LIMIT })])
        .rpc({ commitment: "confirmed" }),
    )

    const cu = await cuOf(connection, sig)
    console.log("cancel_listing CU (SDK fixture):", cu)
    expect(cu).toBeGreaterThan(0)
    expect(cu).toBeLessThanOrEqual(CU_LIMIT)
  })

  describe("minting (CU per step) — Metaplex SDK", () => {
    it("create_mint: consume ≤ CU_LIMIT", async () => {
      const mintKp = Keypair.generate()
      const lamports = await getMinimumBalanceForRentExemptMint(connection)
      const sig = await sendTx(
        connection,
        [
          ComputeBudgetProgram.setComputeUnitLimit({ units: CU_LIMIT }),
          SystemProgram.createAccount({
            fromPubkey: payer.publicKey,
            newAccountPubkey: mintKp.publicKey,
            space: MINT_SIZE,
            lamports,
            programId: TOKEN_PROGRAM_ID,
          }),
          createInitializeMint2Instruction(mintKp.publicKey, 0, payer.publicKey, payer.publicKey, TOKEN_PROGRAM_ID),
        ],
        payer,
        [payer, mintKp],
      )
      const cu = await cuOf(connection, sig)
      console.log("create_mint CU:", cu)
      expect(cu).toBeGreaterThan(0)
      expect(cu).toBeLessThanOrEqual(CU_LIMIT)
    })

    it("create_ata: consume ≤ CU_LIMIT", async () => {
      const mint = await createMint(connection, payer, payer.publicKey, payer.publicKey, 0)
      const ata = getAssociatedTokenAddressSync(mint, payer.publicKey)
      const sig = await sendTx(
        connection,
        [
          ComputeBudgetProgram.setComputeUnitLimit({ units: CU_LIMIT }),
          createAssociatedTokenAccountInstruction(payer.publicKey, ata, payer.publicKey, mint),
        ],
        payer,
      )
      const cu = await cuOf(connection, sig)
      console.log("create_ata CU:", cu)
      expect(cu).toBeGreaterThan(0)
      expect(cu).toBeLessThanOrEqual(CU_LIMIT)
    })

    it("mint_to: consume ≤ CU_LIMIT", async () => {
      const mint = await createMint(connection, payer, payer.publicKey, payer.publicKey, 0)
      const ata = getAssociatedTokenAddressSync(mint, payer.publicKey)
      await sendTx(
        connection,
        [createAssociatedTokenAccountInstruction(payer.publicKey, ata, payer.publicKey, mint)],
        payer,
      )
      const sig = await sendTx(
        connection,
        [
          ComputeBudgetProgram.setComputeUnitLimit({ units: CU_LIMIT }),
          createMintToInstruction(mint, ata, payer.publicKey, 1, [], TOKEN_PROGRAM_ID),
        ],
        payer,
      )
      const cu = await cuOf(connection, sig)
      console.log("mint_to CU:", cu)
      expect(cu).toBeGreaterThan(0)
      expect(cu).toBeLessThanOrEqual(CU_LIMIT)
    })

    it("create_metadata (SDK): consume ≤ CU_LIMIT", async () => {
      const mint = await createMint(connection, payer, payer.publicKey, payer.publicKey, 0)
      const umi = getUmi()
      const mintUmi = fromWeb3JsPublicKey(mint)
      const signer = umi.payer
      const builder = createMetadataAccountV3(umi, {
        mint: mintUmi,
        mintAuthority: signer,
        data: {
          name: "T",
          symbol: "T",
          uri: "",
          sellerFeeBasisPoints: 0,
          creators: none(),
          collection: none(),
          uses: none(),
        },
        isMutable: true,
        collectionDetails: none(),
      })
      const sig = await sendUmiTx(connection, umi, builder, payer, CU_LIMIT)
      const cu = await cuOf(connection, sig)
      console.log("create_metadata (SDK) CU:", cu)
      expect(cu).toBeGreaterThan(0)
      expect(cu).toBeLessThanOrEqual(CU_LIMIT)
    })

    it("create_master_edition (SDK): consume ≤ CU_LIMIT", async () => {
      const mint = await createMint(connection, payer, payer.publicKey, payer.publicKey, 0)
      const umi = getUmi()
      const mintUmi = fromWeb3JsPublicKey(mint)
      const signer = umi.payer

      const metadataBuilder = createMetadataAccountV3(umi, {
        mint: mintUmi,
        mintAuthority: signer,
        data: {
          name: "T",
          symbol: "T",
          uri: "",
          sellerFeeBasisPoints: 0,
          creators: none(),
          collection: none(),
          uses: none(),
        },
        isMutable: true,
        collectionDetails: none(),
      })
      await sendUmiTx(connection, umi, metadataBuilder, payer)

      const ata = getAssociatedTokenAddressSync(mint, payer.publicKey)
      await sendTx(
        connection,
        [createAssociatedTokenAccountInstruction(payer.publicKey, ata, payer.publicKey, mint)],
        payer,
      )
      await sendTx(
        connection,
        [createMintToInstruction(mint, ata, payer.publicKey, 1, [], TOKEN_PROGRAM_ID)],
        payer,
      )

      const editionBuilder = createMasterEditionV3(umi, {
        mint: mintUmi,
        mintAuthority: signer,
        updateAuthority: signer,
        maxSupply: some(0),
      })
      const sig = await sendUmiTx(connection, umi, editionBuilder, payer, CU_LIMIT)
      const cu = await cuOf(connection, sig)
      console.log("create_master_edition (SDK) CU:", cu)
      expect(cu).toBeGreaterThan(0)
      expect(cu).toBeLessThanOrEqual(CU_LIMIT)
    })
  })
})
