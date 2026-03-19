import { Keypair } from '@solana/web3.js';
import { AssetKey } from '../../types';
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
export type NftStorageBundledAsset = {
    cacheKey: string;
    metadataJsonLink: string;
    updatedManifest: Manifest;
};
export type NftStorageBundleUploadResult = {
    assets: NftStorageBundledAsset[];
};
export declare function nftStorageUploadGenerator({ dirname, assets, env, walletKeyPair, nftStorageKey, nftStorageGateway, batchSize, }: {
    dirname: string;
    assets: AssetKey[];
    env: string;
    walletKeyPair: Keypair;
    nftStorageKey?: string | null;
    nftStorageGateway?: string | null;
    batchSize?: number | null;
}): AsyncGenerator<NftStorageBundleUploadResult>;
export {};
