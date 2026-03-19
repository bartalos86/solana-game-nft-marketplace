import { DataItem } from 'arbundles';
import { StorageType } from '../storage-type';
import { Keypair } from '@solana/web3.js';
import { AssetKey } from '../../types';
export declare const LAMPORTS = 1000000000;
type Manifest = {
    name: string;
    image: string;
    animation_url: string;
    properties: {
        files: Array<{
            type: string;
            uri: string;
        }>;
    };
};
type ProcessedBundleFilePairs = {
    cacheKeys: string[];
    dataItems: DataItem[];
    arweavePathManifestLinks: string[];
    updatedManifests: Manifest[];
};
type UploadGeneratorResult = Omit<ProcessedBundleFilePairs, 'dataItems'>;
export declare function makeArweaveBundleUploadGenerator(storage: StorageType, dirname: string, assets: AssetKey[], env: 'mainnet-beta' | 'devnet', jwk?: any, walletKeyPair?: Keypair, batchSize?: number, rpcUrl?: string): AsyncGenerator<UploadGeneratorResult>;
export declare const withdrawBundlr: (walletKeyPair: Keypair) => Promise<void>;
export {};
