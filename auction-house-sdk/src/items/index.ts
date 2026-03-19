import {
  signBytes,
  verifySignature,
  getUtf8Encoder,
  getBase58Decoder,
  getBase58Encoder,
  SignatureBytes,
} from "@solana/kit";
import { ItemMetada, SignedItemMetadata } from "./metadata";

import { createNoopSigner, createSignerFromKeypair, generateSigner, Keypair, percentAmount, PublicKey, Signer, signerIdentity, signerPayer, transactionBuilder } from '@metaplex-foundation/umi'
import {
  createV1,
  mplTokenMetadata,
  TokenStandard,
} from '@metaplex-foundation/mpl-token-metadata'
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults'

import {serializeTransaction } from "../base"

export async function createMintTransaction(item: ItemMetada, txId:  , keypair: Keypair, userAddress: PublicKey){

  const umi = createUmi('https://api.devnet.solana.com').use(mplTokenMetadata())
  const mint = generateSigner(umi)

  const signer = createSignerFromKeypair(umi, keypair);
  umi.use(signerIdentity(signer))

  const payer = createNoopSigner(userAddress);

   const metadataTransaction = await createV1(umi, {
    mint,
    authority: payer,
    name: 'My NFT',
    payer: payer,
    uri: 'blochains:://item.json',
    sellerFeeBasisPoints: percentAmount(5.5),
    tokenStandard: TokenStandard.NonFungible,
  })
  .setBlockhash(await umi.rpc.getLatestBlockhash())
  .setFeePayer(payer)
  .buildAndSign(umi);

  return metadataTransaction;
}

export async function createSerializedMintTransaction(item: ItemMetada, keypair: Keypair, userAddress: PublicKey){
  const transaction = await createMintTransaction(item, keypair, userAddress);
}


export async function createItemSignature(item: ItemMetada, keypair: CryptoKeyPair){
  // const keys = await generateKeyPair(); //this will be the game's keypair


  const itemData = JSON.stringify(item);

  const message = getUtf8Encoder().encode(itemData);
  const signedBytes = await signBytes(keypair.privateKey, message);

  const signature = getBase58Decoder().decode(signedBytes);

  return {...item, signature: signature} as SignedItemMetadata
}

export async function verifyItemSignature(item: SignedItemMetadata, keypair: CryptoKeyPair){

  const {signature , ...itemProps} = item;

  const itemData = JSON.stringify(itemProps);

  const message = getUtf8Encoder().encode(itemData);
  const encodedSignature = await getBase58Encoder().encode(signature) as SignatureBytes;

  const verified = await verifySignature(keypair.publicKey, encodedSignature, message);
}
