import { Transaction, Umi } from "@metaplex-foundation/umi";
export declare function serializeTransaction(umi: Umi, transaction: Transaction): any;
export declare function deserializeTransaction(umi: any, encodedTransaction: string): any;
