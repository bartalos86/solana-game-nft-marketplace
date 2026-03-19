/// <reference types="node" />
/// <reference types="node" />
import { PublicKey, TransactionInstruction } from '@solana/web3.js';
import { CandyMachineData } from './accounts';
export declare function createAssociatedTokenAccountInstruction(associatedTokenAddress: PublicKey, payer: PublicKey, walletAddress: PublicKey, splTokenMintAddress: PublicKey): TransactionInstruction;
export declare function createUpdateMetadataInstruction(metadataAccount: PublicKey, payer: PublicKey, txnData: Buffer): TransactionInstruction;
export declare function createCandyMachineV2Account(anchorProgram: any, candyData: CandyMachineData, payerWallet: any, candyAccount: any): Promise<TransactionInstruction>;
