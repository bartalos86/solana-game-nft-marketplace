/**
 * Build marketplace list_nft and buy_nft instructions using Anchor.
 * Uses UMI + official Metaplex PDAs internally; converts to web3.js only at Anchor boundary.
 */

import { Program, AnchorProvider, BN } from '@coral-xyz/anchor'
import { Connection, PublicKey, TransactionInstruction } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'
import type { Idl } from '@coral-xyz/anchor'
import { toWeb3JsPublicKey } from '@metaplex-foundation/umi-web3js-adapters'
import { fromWeb3JsPublicKey } from '@metaplex-foundation/umi-web3js-adapters'
import { createMarketplaceUmi } from '@/lib/umi'
import {
  MARKETPLACE_FEE_RECIPIENT,
  getMetadataPda,
  getMasterEditionPda,
  getListingPda,
} from './marketplace'
import idl from './marketplace-idl.json'

const MARKETPLACE_IDL = idl as Idl

const MARKETPLACE_FEE_RECIPIENT_WEB3 = new PublicKey(
  typeof MARKETPLACE_FEE_RECIPIENT === 'string' ? MARKETPLACE_FEE_RECIPIENT : (MARKETPLACE_FEE_RECIPIENT as { toString(): string }).toString()
)

export function getMarketplaceProgram(connection: Connection, payer: PublicKey): Program {
  const provider = new AnchorProvider(
    connection,
    { publicKey: payer, signTransaction: async () => null as never, signAllTransactions: async () => [] },
    { commitment: 'confirmed' }
  )
  return new Program(MARKETPLACE_IDL, provider)
}

export async function buildListNftInstructions(params: {
  connection: Connection
  seller: PublicKey
  mint: PublicKey
  priceLamports: bigint
  expiryUnix: number
}): Promise<TransactionInstruction[]> {
  const { connection, seller, mint, priceLamports, expiryUnix } = params
  const umi = createMarketplaceUmi(connection.rpcEndpoint)
  const sellerUmi = fromWeb3JsPublicKey(seller)
  const mintUmi = fromWeb3JsPublicKey(mint)

  const listingPda = getListingPda(sellerUmi, mintUmi)
  const metadataPda = getMetadataPda(umi, mintUmi)
  const masterEditionPda = getMasterEditionPda(umi, mintUmi)

  const program = getMarketplaceProgram(connection, seller)
  const ix = await program.methods
    .listNft(new BN(priceLamports.toString()), new BN(expiryUnix))
    .accounts({
      seller,
      mint,
      listing: toWeb3JsPublicKey(listingPda),
      metadata: toWeb3JsPublicKey(metadataPda[0]),
      masterEdition: toWeb3JsPublicKey(masterEditionPda[0]),
      sellerTokenRecord: null as unknown as PublicKey,
      escrowTokenRecord: null as unknown as PublicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction()

  return [ix]
}

export async function buildBuyNftInstructions(params: {
  connection: Connection
  buyer: PublicKey
  seller: PublicKey
  mint: PublicKey
  listingPda: PublicKey
  updateAuthorityFeeRecipient: PublicKey
}): Promise<TransactionInstruction[]> {
  const { connection, buyer, seller, mint, listingPda, updateAuthorityFeeRecipient } = params
  const umi = createMarketplaceUmi(connection.rpcEndpoint)
  const mintUmi = fromWeb3JsPublicKey(mint)

  const metadataPda = getMetadataPda(umi, mintUmi)
  const masterEditionPda = getMasterEditionPda(umi, mintUmi)

  const program = getMarketplaceProgram(connection, buyer)
  const ix = await program.methods
    .buyNft()
    .accounts({
      buyer,
      seller,
      marketplaceFeeRecipient: MARKETPLACE_FEE_RECIPIENT_WEB3,
      updateAuthorityFeeRecipient,
      mint,
      listing: listingPda,
      metadata: toWeb3JsPublicKey(metadataPda[0]),
      masterEdition: toWeb3JsPublicKey(masterEditionPda[0]),
      escrowTokenRecord: null as unknown as PublicKey,
      buyerTokenRecord: null as unknown as PublicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction()

  return [ix]
}

export async function buildCancelNftListingInstructions(params: {
  connection: Connection
  seller: PublicKey
  mint: PublicKey
  listingPda: PublicKey
}): Promise<TransactionInstruction[]> {
  const { connection, seller, mint, listingPda } = params
  const umi = createMarketplaceUmi(connection.rpcEndpoint)
  const mintUmi = fromWeb3JsPublicKey(mint)

  const metadataPda = getMetadataPda(umi, mintUmi)
  const masterEditionPda = getMasterEditionPda(umi, mintUmi)

  const program = getMarketplaceProgram(connection, seller)
  const ix = await program.methods
  .cancelListing()
  .accounts({
    seller: seller,
    mint,
    listing: listingPda,
    metadata: toWeb3JsPublicKey(metadataPda[0]),
    masterEdition: toWeb3JsPublicKey(masterEditionPda[0]),
    escrowTokenRecord: null as unknown as PublicKey,
    sellerTokenRecord: null as unknown as PublicKey,
    tokenProgram: TOKEN_PROGRAM_ID,
  })
    .instruction()

  return [ix]
}
