/// <reference types="node" />
/// <reference types="node" />
import { AccountInfo, PublicKey } from '@solana/web3.js';
import { BN, Program, web3 } from '@project-serum/anchor';
import { StorageType } from './storage-type';
export declare function getCandyMachineV2Config(walletKeyPair: web3.Keypair, anchorProgram: Program, configPath: any): Promise<{
    storage: StorageType;
    nftStorageKey: string | null;
    nftStorageGateway: string | null;
    ipfsInfuraProjectId: string;
    number: number;
    ipfsInfuraSecret: string;
    pinataJwt: string;
    pinataGateway: string;
    awsS3Bucket: string;
    retainAuthority: boolean;
    mutable: boolean;
    batchSize: number;
    price: BN;
    treasuryWallet: web3.PublicKey;
    splToken: web3.PublicKey | null;
    gatekeeper: null | {
        expireOnUse: boolean;
        gatekeeperNetwork: web3.PublicKey;
    };
    endSettings: null | [number, BN];
    whitelistMintSettings: null | {
        mode: any;
        mint: web3.PublicKey;
        presale: boolean;
        discountPrice: null | BN;
    };
    hiddenSettings: null | {
        name: string;
        uri: string;
        hash: Uint8Array;
    };
    goLiveDate: BN | null;
    uuid: string;
    arweaveJwk: string;
}>;
export declare function shuffle(array: any): any;
export declare const getUnixTs: () => number;
export declare function sleep(ms: number): Promise<void>;
export declare function fromUTF8Array(data: number[]): string;
export declare function parsePrice(price: string, mantissa?: number): number;
export declare function parseDate(date: any): number;
export declare const getMultipleAccounts: (connection: any, keys: string[], commitment: string) => Promise<{
    keys: string[];
    array: AccountInfo<Buffer>[];
}>;
export declare function chunks(array: any, size: any): any;
export declare const getPriceWithMantissa: (price: number, mint: web3.PublicKey, walletKeyPair: any, anchorProgram: Program) => Promise<number>;
export declare function getCluster(name: string): string;
