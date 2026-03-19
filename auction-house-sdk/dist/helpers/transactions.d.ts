import { Blockhash, Commitment, Connection, FeeCalculator, Keypair, Transaction, TransactionInstruction } from '@solana/web3.js';
interface BlockhashAndFeeCalculator {
    blockhash: Blockhash;
    feeCalculator: FeeCalculator;
}
export declare const sendTransactionWithRetryWithKeypair: (connection: Connection, wallet: Keypair, instructions: TransactionInstruction[], signers: Keypair[], commitment?: Commitment, includesFeePayer?: boolean, block?: BlockhashAndFeeCalculator, beforeSend?: () => void) => Promise<{
    txid: string;
    slot: number;
}>;
export declare function sendSignedTransaction({ signedTransaction, connection, timeout, }: {
    signedTransaction: Transaction;
    connection: Connection;
    sendingMessage?: string;
    sentMessage?: string;
    successMessage?: string;
    timeout?: number;
}): Promise<{
    txid: string;
    slot: number;
}>;
export {};
