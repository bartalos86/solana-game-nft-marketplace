/**
 * Marketplace combo benchmark:
 *   - list + buy
 *   - list + cancel
 *
 * Focus: transaction fee + temporary storage lock (new-account rent) per tx
 * and per combo on Solana.
 */

import * as anchor from "@coral-xyz/anchor"
import { BN, Program } from "@coral-xyz/anchor"
import type { Marketplace } from "../target/types/marketplace"
import {
  createMint,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token"
import {
  ComputeBudgetProgram,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js"
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults"
import {
  createMasterEditionV3,
  createMetadataAccountV3,
  mplTokenMetadata,
} from "@metaplex-foundation/mpl-token-metadata"
import { createSignerFromKeypair, none, signerIdentity, signerPayer, some } from "@metaplex-foundation/umi"
import { fromWeb3JsKeypair, fromWeb3JsPublicKey, toWeb3JsLegacyTransaction } from "@metaplex-foundation/umi-web3js-adapters"
import { lamportsToSolString, solTxBalanceBreakdownFromMeta } from "./sol-tx-rent"

type TxStorageCost = {
  txFeeLamports: number
  newAccountRentLamports: number
  existingAccountIncreaseLamports: number
}

const MARKETPLACE_FEE_RECIPIENT = new PublicKey("5GLPnCWkDniHq4B7o7K5fsxRKf4xpprX2ENngRs4VGeB")
const MPL_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s")
const EXPIRY = new BN(Math.floor(Date.now() / 1000) + 7 * 24 * 3600)
const PRICE = new BN(0.01 * LAMPORTS_PER_SOL)
const CU_LIMIT = 100_000_000

describe("Marketplace refund cost combos (Solana)", () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)

  const program = anchor.workspace.Marketplace as Program<Marketplace>
  const { connection } = provider
  const payer = (provider.wallet as anchor.Wallet).payer

  async function requestAirdropWithRetry(pubkey: PublicKey, lamports: number, maxAttempts: number = 5): Promise<void> {
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
        await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt))
      }
    }
  }

  async function sendTx(ixs: TransactionInstruction[], feePayer: Keypair, signers: Keypair[] = [feePayer]): Promise<string> {
    const tx = new Transaction().add(...ixs)
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
    tx.feePayer = feePayer.publicKey
    tx.sign(...signers)
    const sig = await connection.sendRawTransaction(tx.serialize())
    await connection.confirmTransaction(sig, "confirmed")
    return sig
  }

  async function txStorageCost(signature: string): Promise<TxStorageCost> {
    const info = await connection.getTransaction(signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    })
    if (!info?.meta) {
      throw new Error(`Missing confirmed meta for tx ${signature}`)
    }
    const breakdown = solTxBalanceBreakdownFromMeta(info.meta)
    return {
      txFeeLamports: breakdown.txFeeLamports,
      newAccountRentLamports: breakdown.newAccountRentLamports,
      existingAccountIncreaseLamports: breakdown.existingAccountIncreaseLamports,
    }
  }

  function logTxCost(label: string, c: TxStorageCost): void {
    console.log(
      `[SOL] ${label}: fee=${lamportsToSolString(c.txFeeLamports)} SOL | temp_storage(new_accounts)=${lamportsToSolString(c.newAccountRentLamports)} SOL | existing_account_delta_plus=${lamportsToSolString(c.existingAccountIncreaseLamports)} SOL`,
    )
  }

  function logComboCost(label: string, costs: TxStorageCost[]): void {
    const totalFee = costs.reduce((sum, c) => sum + c.txFeeLamports, 0)
    const totalTempStorage = costs.reduce((sum, c) => sum + c.newAccountRentLamports, 0)
    const totalExistingIncrease = costs.reduce((sum, c) => sum + c.existingAccountIncreaseLamports, 0)
    console.log(
      `[SOL][COMBO] ${label}: total_fee=${lamportsToSolString(totalFee)} SOL | total_temp_storage(new_accounts)=${lamportsToSolString(totalTempStorage)} SOL | total_existing_account_delta_plus=${lamportsToSolString(totalExistingIncrease)} SOL`,
    )
  }

  function getUmi() {
    const umi = createUmi(connection).use(mplTokenMetadata())
    const signer = createSignerFromKeypair(umi, fromWeb3JsKeypair(payer))
    return umi.use(signerIdentity(signer)).use(signerPayer(signer))
  }

  async function createNftFixture() {
    const mint = await createMint(connection, payer, payer.publicKey, payer.publicKey, 0)
    const sellerAta = getAssociatedTokenAddressSync(mint, payer.publicKey)
    await sendTx(
      [createAssociatedTokenAccountInstruction(payer.publicKey, sellerAta, payer.publicKey, mint)],
      payer,
    )
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

    const metaTx = toWeb3JsLegacyTransaction(await metadataBuilder.setFeePayer(umi.payer).buildAndSign(umi))
    await sendTx(metaTx.instructions, payer)
    const editionTx = toWeb3JsLegacyTransaction(await masterEditionBuilder.setFeePayer(umi.payer).buildAndSign(umi))
    await sendTx(editionTx.instructions, payer)

    const [listingPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("listing"), payer.publicKey.toBuffer(), mint.toBuffer()],
      program.programId,
    )

    const metadata = PublicKey.findProgramAddressSync(
      [Buffer.from("metadata"), MPL_ID.toBuffer(), mint.toBuffer()],
      MPL_ID,
    )[0]
    const masterEdition = PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        MPL_ID.toBuffer(),
        mint.toBuffer(),
        Buffer.from("edition"),
      ],
      MPL_ID,
    )[0]

    return { mint, listingPda, metadata, masterEdition }
  }

  beforeAll(async () => {
    if ((await connection.getBalance(payer.publicKey)) < 2 * LAMPORTS_PER_SOL) {
      await requestAirdropWithRetry(payer.publicKey, 3 * LAMPORTS_PER_SOL)
    }
    if ((await connection.getBalance(MARKETPLACE_FEE_RECIPIENT)) < 0.2 * LAMPORTS_PER_SOL) {
      await requestAirdropWithRetry(MARKETPLACE_FEE_RECIPIENT, 1 * LAMPORTS_PER_SOL)
    }
  })

  it("measures combo cost: 1 list + 1 buy", async () => {
    const { mint, listingPda, metadata, masterEdition } = await createNftFixture()

    const listSig = await program.methods
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
      .rpc({ commitment: "confirmed" })

    const buySig = await program.methods
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
      .rpc({ commitment: "confirmed" })

    const listCost = await txStorageCost(listSig)
    const buyCost = await txStorageCost(buySig)
    logTxCost("list_nft", listCost)
    logTxCost("buy_nft", buyCost)
    logComboCost("list + buy", [listCost, buyCost])

    expect(listCost.txFeeLamports).toBeGreaterThan(0)
    expect(buyCost.txFeeLamports).toBeGreaterThan(0)
  })

  it("measures combo cost: 1 list + 1 cancel", async () => {
    const { mint, listingPda, metadata, masterEdition } = await createNftFixture()

    const listSig = await program.methods
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
      .rpc({ commitment: "confirmed" })

    const cancelSig = await program.methods
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
      .rpc({ commitment: "confirmed" })

    const listCost = await txStorageCost(listSig)
    const cancelCost = await txStorageCost(cancelSig)
    logTxCost("list_nft", listCost)
    logTxCost("cancel_listing", cancelCost)
    logComboCost("list + cancel", [listCost, cancelCost])

    expect(listCost.txFeeLamports).toBeGreaterThan(0)
    expect(cancelCost.txFeeLamports).toBeGreaterThan(0)
  })
})
