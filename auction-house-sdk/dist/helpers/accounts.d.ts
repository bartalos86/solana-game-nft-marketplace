/// <reference types="node" />
/// <reference types="node" />
import { Keypair, PublicKey, AccountInfo } from '@solana/web3.js';
import * as anchor from '@project-serum/anchor';
import { web3 } from '@project-serum/anchor';
export type AccountAndPubkey = {
    pubkey: string;
    account: AccountInfo<Buffer>;
};
export declare const deserializeAccount: (data: Buffer) => any;
export interface WhitelistMintMode {
    neverBurn: undefined | boolean;
    burnEveryTime: undefined | boolean;
}
export interface CandyMachine {
    authority: anchor.web3.PublicKey;
    wallet: anchor.web3.PublicKey;
    tokenMint: null | anchor.web3.PublicKey;
    itemsRedeemed: anchor.BN;
    data: CandyMachineData;
}
export interface CandyMachineData {
    itemsAvailable: anchor.BN;
    uuid: null | string;
    symbol: string;
    sellerFeeBasisPoints: number;
    isMutable: boolean;
    maxSupply: anchor.BN;
    price: anchor.BN;
    retainAuthority: boolean;
    gatekeeper: null | {
        expireOnUse: boolean;
        gatekeeperNetwork: web3.PublicKey;
    };
    goLiveDate: null | anchor.BN;
    endSettings: null | [number, anchor.BN];
    whitelistMintSettings: null | {
        mode: WhitelistMintMode;
        mint: anchor.web3.PublicKey;
        presale: boolean;
        discountPrice: null | anchor.BN;
    };
    hiddenSettings: null | {
        name: string;
        uri: string;
        hash: Uint8Array;
    };
    creators: {
        address: PublicKey;
        verified: boolean;
        share: number;
    }[];
}
export declare const getTokenMint: (authority: anchor.web3.PublicKey, uuid: string) => Promise<[anchor.web3.PublicKey, number]>;
export declare const getFairLaunch: (tokenMint: anchor.web3.PublicKey) => Promise<[anchor.web3.PublicKey, number]>;
export declare const getCandyMachineCreator: (candyMachine: anchor.web3.PublicKey) => Promise<[anchor.web3.PublicKey, number]>;
export declare const getFairLaunchTicket: (tokenMint: anchor.web3.PublicKey, buyer: anchor.web3.PublicKey) => Promise<[anchor.web3.PublicKey, number]>;
export declare const getFairLaunchLotteryBitmap: (tokenMint: anchor.web3.PublicKey) => Promise<[anchor.web3.PublicKey, number]>;
export declare const getFairLaunchTicketSeqLookup: (tokenMint: anchor.web3.PublicKey, seq: anchor.BN) => Promise<[anchor.web3.PublicKey, number]>;
export declare const getAtaForMint: (mint: anchor.web3.PublicKey, buyer: anchor.web3.PublicKey) => Promise<[anchor.web3.PublicKey, number]>;
export declare const getParticipationMint: (authority: anchor.web3.PublicKey, uuid: string) => Promise<[anchor.web3.PublicKey, number]>;
export declare const getParticipationToken: (authority: anchor.web3.PublicKey, uuid: string) => Promise<[anchor.web3.PublicKey, number]>;
export declare const getTreasury: (tokenMint: anchor.web3.PublicKey) => Promise<[anchor.web3.PublicKey, number]>;
export declare const getMetadata: (mint: anchor.web3.PublicKey) => Promise<anchor.web3.PublicKey>;
export declare const getCollectionPDA: (candyMachineAddress: anchor.web3.PublicKey) => Promise<[anchor.web3.PublicKey, number]>;
export declare const getCollectionAuthorityRecordPDA: (mint: anchor.web3.PublicKey, newAuthority: anchor.web3.PublicKey) => Promise<[anchor.web3.PublicKey, number]>;
export declare const getMasterEdition: (mint: anchor.web3.PublicKey) => Promise<anchor.web3.PublicKey>;
export declare const getEditionMarkPda: (mint: anchor.web3.PublicKey, edition: number) => Promise<anchor.web3.PublicKey>;
export declare const getAuctionHouse: (creator: anchor.web3.PublicKey, treasuryMint: anchor.web3.PublicKey) => Promise<[PublicKey, number]>;
export declare const getAuctionHouseProgramAsSigner: () => Promise<[
    PublicKey,
    number
]>;
export declare const getAuctionHouseFeeAcct: (auctionHouse: anchor.web3.PublicKey) => Promise<[PublicKey, number]>;
export declare const getAuctionHouseTreasuryAcct: (auctionHouse: anchor.web3.PublicKey) => Promise<[PublicKey, number]>;
export declare const getAuctionHouseBuyerEscrow: (auctionHouse: anchor.web3.PublicKey, wallet: anchor.web3.PublicKey) => Promise<[PublicKey, number]>;
export declare const getAuctionHouseTradeState: (auctionHouse: anchor.web3.PublicKey, wallet: anchor.web3.PublicKey, tokenAccount: anchor.web3.PublicKey, treasuryMint: anchor.web3.PublicKey, tokenMint: anchor.web3.PublicKey, tokenSize: anchor.BN, buyPrice: anchor.BN) => Promise<[PublicKey, number]>;
export declare const getTokenEntanglement: (mintA: anchor.web3.PublicKey, mintB: anchor.web3.PublicKey) => Promise<[PublicKey, number]>;
export declare const getTokenEntanglementEscrows: (mintA: anchor.web3.PublicKey, mintB: anchor.web3.PublicKey) => Promise<[PublicKey, number, PublicKey, number]>;
export declare function loadWalletKey(keypair: any): Keypair;
export declare function loadCandyProgram(walletKeyPair: Keypair, env: string, customRpcUrl?: string): Promise<anchor.Program>;
export declare function loadCandyProgramV2(walletKeyPair: Keypair, env: string, customRpcUrl?: string): Promise<anchor.Program>;
export declare function loadFairLaunchProgram(walletKeyPair: Keypair, env: string, customRpcUrl?: string): Promise<anchor.Program>;
export declare function loadAuctionHouseProgram(walletKeyPair: Keypair, env: string, customRpcUrl?: string): Promise<anchor.Program>;
export declare function loadTokenEntanglementProgream(walletKeyPair: Keypair, env: string, customRpcUrl?: string): Promise<anchor.Program>;
export declare function getTokenAmount(anchorProgram: anchor.Program, account: anchor.web3.PublicKey, mint: anchor.web3.PublicKey): Promise<number>;
export declare const getBalance: (account: anchor.web3.PublicKey, env: string, customRpcUrl?: string) => Promise<number>;
export declare function getProgramAccounts(connection: anchor.web3.Connection, programId: string, configOrCommitment?: any): Promise<AccountAndPubkey[]>;
