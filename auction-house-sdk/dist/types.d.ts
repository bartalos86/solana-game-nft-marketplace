import { BN } from '@project-serum/anchor';
import { PublicKey } from '@solana/web3.js';
export declare class Creator {
    address: PublicKey;
    verified: boolean;
    share: number;
    constructor(args: {
        address: PublicKey;
        verified: boolean;
        share: number;
    });
}
export interface Config {
    authority: PublicKey;
    data: ConfigData;
}
export declare class ConfigData {
    name: string;
    symbol: string;
    uri: string;
    sellerFeeBasisPoints: number;
    creators: Creator[] | null;
    maxNumberOfLines: BN | number;
    isMutable: boolean;
    maxSupply: BN;
    retainAuthority: boolean;
    constructor(args: {
        name: string;
        symbol: string;
        uri: string;
        sellerFeeBasisPoints: number;
        creators: Creator[] | null;
        maxNumberOfLines: BN;
        isMutable: boolean;
        maxSupply: BN;
        retainAuthority: boolean;
    });
}
export declare enum MetadataKey {
    Uninitialized = 0,
    MetadataV1 = 4,
    EditionV1 = 1,
    MasterEditionV1 = 2,
    MasterEditionV2 = 6,
    EditionMarker = 7
}
export declare class MasterEditionV1 {
    key: MetadataKey;
    supply: BN;
    maxSupply?: BN;
    printingMint: PublicKey;
    oneTimePrintingAuthorizationMint: PublicKey;
    constructor(args: {
        key: MetadataKey;
        supply: BN;
        maxSupply?: BN;
        printingMint: PublicKey;
        oneTimePrintingAuthorizationMint: PublicKey;
    });
}
export declare class MasterEditionV2 {
    key: MetadataKey;
    supply: BN;
    maxSupply?: BN;
    constructor(args: {
        key: MetadataKey;
        supply: BN;
        maxSupply?: BN;
    });
}
export declare class EditionMarker {
    key: MetadataKey;
    ledger: number[];
    constructor(args: {
        key: MetadataKey;
        ledger: number[];
    });
}
export declare class Edition {
    key: MetadataKey;
    parent: PublicKey;
    edition: BN;
    constructor(args: {
        key: MetadataKey;
        parent: PublicKey;
        edition: BN;
    });
}
export declare class Data {
    name: string;
    symbol: string;
    uri: string;
    sellerFeeBasisPoints: number;
    creators: Creator[] | null;
    constructor(args: {
        name: string;
        symbol: string;
        uri: string;
        sellerFeeBasisPoints: number;
        creators: Creator[] | null;
    });
}
export declare class Metadata {
    key: MetadataKey;
    updateAuthority: PublicKey;
    mint: PublicKey;
    data: Data;
    primarySaleHappened: boolean;
    isMutable: boolean;
    masterEdition?: PublicKey;
    edition?: PublicKey;
    constructor(args: {
        updateAuthority: PublicKey;
        mint: PublicKey;
        data: Data;
        primarySaleHappened: boolean;
        isMutable: boolean;
        masterEdition?: PublicKey;
    });
}
export declare const METADATA_SCHEMA: Map<any, any>;
export interface CollectionData {
    mint: PublicKey;
    candyMachine: PublicKey;
}
export type AssetKey = {
    mediaExt: string;
    index: string;
};
