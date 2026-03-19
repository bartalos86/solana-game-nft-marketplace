import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AuctionHouse } from "../types/auction-house";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  Token
} from "@solana/spl-token";
import { assert } from "chai";
import {
  getAuctionHouse,
  getAuctionHouseFeeAcct,
  getAuctionHouseTreasuryAcct,
  getAtaForMint,
  getAuctionHouseBuyerEscrow,
  getAuctionHouseTradeState,
  getAuctionHouseProgramAsSigner,
  getMetadata,
  getTokenAmount,
  loadAuctionHouseProgram,
} from "../src/helpers/accounts";
import { WRAPPED_SOL_MINT } from "../src/helpers/constants";
import { getPriceWithMantissa } from "../src/helpers/various";
import { before } from "node:test";
// import { sendTransactionWithRetryWithKeypair } from "./helpers/transactions";

describe("Auction House", async () => {
  // Configure the client to use the local cluster
  // anchor.setProvider(anchor.AnchorProvider.env());

  // const program = anchor.workspace.AuctionHouse as Program<AuctionHouse>;
  const provider = anchor.AnchorProvider.env();
  const wallet = anchor.web3.Keypair.generate();

  const program = await loadAuctionHouseProgram(wallet, "localhost");

  let auctionHouseKey;
  let auctionHouseBump;
  let feeAccount;
  let treasuryAccount;

  // Test wallets
  let authority;
  let seller;
  let buyer;

  // Test NFT
  // let mintKey: anchor.web3.PublicKey;
  // let sellerTokenAccount: anchor.web3.PublicKey;

  before(async () => {
    // Airdrop SOL to test wallets
    authority = anchor.web3.Keypair.generate();
    seller = anchor.web3.Keypair.generate();
    buyer = anchor.web3.Keypair.generate();

    // await provider.connection.confirmTransaction(
    //   await provider.connection.requestAirdrop(
    //     authority.publicKey,
    //     10 * anchor.web3.LAMPORTS_PER_SOL
    //   )
    // );

    // await provider.connection.confirmTransaction(
    //   await provider.connection.requestAirdrop(
    //     seller.publicKey,
    //     10 * anchor.web3.LAMPORTS_PER_SOL
    //   )
    // );

    // await provider.connection.confirmTransaction(
    //   await provider.connection.requestAirdrop(
    //     buyer.publicKey,
    //     10 * anchor.web3.LAMPORTS_PER_SOL
    //   )
    // );
  });

  it("Creates an auction house", async () => {
    const sfbp = 200; // 2% seller fee
    const requiresSignOff = false;
    const canChangeSalePrice = true;

    const tMintKey = WRAPPED_SOL_MINT;
    const twdKey = authority.publicKey;
    const fwdKey = authority.publicKey;

    const twdAta = tMintKey.equals(WRAPPED_SOL_MINT)
      ? twdKey
      : (await getAtaForMint(tMintKey, twdKey))[0];

    [auctionHouseKey, auctionHouseBump] = await getAuctionHouse(
      authority.publicKey,
      tMintKey
    );

    const [feeAcct, feeBump] = await getAuctionHouseFeeAcct(auctionHouseKey);
    const [treasuryAcct, treasuryBump] = await getAuctionHouseTreasuryAcct(
      auctionHouseKey
    );

    feeAccount = feeAcct;
    treasuryAccount = treasuryAcct;

    const tx = await program.rpc.createAuctionHouse(
      auctionHouseBump,
      feeBump,
      treasuryBump,
      sfbp,
      requiresSignOff,
      canChangeSalePrice,
      {
        accounts: {
          treasuryMint: tMintKey,
          payer: authority.publicKey,
          authority: authority.publicKey,
          feeWithdrawalDestination: fwdKey,
          treasuryWithdrawalDestination: twdAta,
          treasuryWithdrawalDestinationOwner: twdKey,
          auctionHouse: auctionHouseKey,
          auctionHouseFeeAccount: feeAccount,
          auctionHouseTreasury: treasuryAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
          ataProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        },
        signers: [authority],
      }
    );

    console.log("Created auction house:", auctionHouseKey.toBase58());
    console.log("Transaction signature:", tx);

    // Verify the auction house was created
    const auctionHouseAccount = await program.account.auctionHouse.fetch(
      auctionHouseKey
    );

    assert.equal(
      auctionHouseAccount.authority.toBase58(),
      authority.publicKey.toBase58()
    );
    assert.equal(auctionHouseAccount.sellerFeeBasisPoints, sfbp);
    assert.equal(auctionHouseAccount.requiresSignOff, requiresSignOff);
    assert.equal(auctionHouseAccount.canChangeSalePrice, canChangeSalePrice);
  });

  it("Deposits funds into buyer escrow", async () => {
    const depositAmount = 5; // 5 SOL

    const auctionHouseObj = await program.account.auctionHouse.fetch(
      auctionHouseKey
    );

    const amountAdjusted = await getPriceWithMantissa(
      depositAmount,
      auctionHouseObj.treasuryMint,
      buyer,
      program
    );

    const [escrowPaymentAccount, bump] = await getAuctionHouseBuyerEscrow(
      auctionHouseKey,
      buyer.publicKey
    );

    const isNative = auctionHouseObj.treasuryMint.equals(WRAPPED_SOL_MINT);

    const tx = await program.rpc.deposit(
      bump,
      new anchor.BN(amountAdjusted),
      {
        accounts: {
          wallet: buyer.publicKey,
          paymentAccount: buyer.publicKey,
          transferAuthority: anchor.web3.SystemProgram.programId,
          escrowPaymentAccount,
          treasuryMint: auctionHouseObj.treasuryMint,
          authority: auctionHouseObj.authority,
          auctionHouse: auctionHouseKey,
          auctionHouseFeeAccount: auctionHouseObj.auctionHouseFeeAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        },
        signers: [buyer],
      }
    );

    console.log("Deposited funds, signature:", tx);

    // Verify the balance
    const balance = await getTokenAmount(
      program,
      escrowPaymentAccount,
      auctionHouseObj.treasuryMint
    );

    assert.isAtLeast(balance, amountAdjusted);
  });

  // it("Creates a sell order", async () => {
  //   // First, create a test NFT
  //   const mintAuthority = anchor.web3.Keypair.generate();
  //   const mint = await Token.createMint(
  //     provider.connection,
  //     seller,
  //     mintAuthority.publicKey,
  //     null,
  //     0,
  //     TOKEN_PROGRAM_ID
  //   );

  //   mintKey = mint.publicKey;

  //   // Create token account and mint NFT
  //   sellerTokenAccount = await mint.createAccount(seller.publicKey);
  //   await mint.mintTo(
  //     sellerTokenAccount,
  //     mintAuthority,
  //     [mintAuthority],
  //     1
  //   );

  //   const auctionHouseObj = await program.account.auctionHouse.fetch(
  //     auctionHouseKey
  //   );

  //   const buyPrice = 1; // 1 SOL
  //   const tokenSize = 1;

  //   const buyPriceAdjusted = new anchor.BN(
  //     await getPriceWithMantissa(
  //       buyPrice,
  //       auctionHouseObj.treasuryMint,
  //       seller,
  //       program
  //     )
  //   );

  //   const tokenSizeAdjusted = new anchor.BN(
  //     await getPriceWithMantissa(tokenSize, mintKey, seller, program)
  //   );

  //   const [programAsSigner, programAsSignerBump] =
  //     await getAuctionHouseProgramAsSigner();

  //   const [tradeState, tradeBump] = await getAuctionHouseTradeState(
  //     auctionHouseKey,
  //     seller.publicKey,
  //     sellerTokenAccount,
  //     auctionHouseObj.treasuryMint,
  //     mintKey,
  //     tokenSizeAdjusted,
  //     buyPriceAdjusted
  //   );

  //   const [freeTradeState, freeTradeBump] = await getAuctionHouseTradeState(
  //     auctionHouseKey,
  //     seller.publicKey,
  //     sellerTokenAccount,
  //     auctionHouseObj.treasuryMint,
  //     mintKey,
  //     tokenSizeAdjusted,
  //     new anchor.BN(0)
  //   );

  //   const metadata = await getMetadata(mintKey);

  //   const tx = await program.rpc.sell(
  //     tradeBump,
  //     freeTradeBump,
  //     programAsSignerBump,
  //     buyPriceAdjusted,
  //     tokenSizeAdjusted,
  //     {
  //       accounts: {
  //         wallet: seller.publicKey,
  //         metadata,
  //         tokenAccount: sellerTokenAccount,
  //         authority: auctionHouseObj.authority,
  //         auctionHouse: auctionHouseKey,
  //         auctionHouseFeeAccount: auctionHouseObj.auctionHouseFeeAccount,
  //         sellerTradeState: tradeState,
  //         freeSellerTradeState: freeTradeState,
  //         tokenProgram: TOKEN_PROGRAM_ID,
  //         systemProgram: anchor.web3.SystemProgram.programId,
  //         programAsSigner,
  //         rent: anchor.web3.SYSVAR_RENT_PUBKEY,
  //       },
  //       signers: [seller],
  //     }
  //   );

  //   console.log("Created sell order, signature:", tx);

  //   // Verify trade state exists
  //   const tradeStateAccount = await provider.connection.getAccountInfo(
  //     tradeState
  //   );
  //   assert.isNotNull(tradeStateAccount);
  // });

  // it("Creates a buy order", async () => {
  //   const auctionHouseObj = await program.account.auctionHouse.fetch(
  //     auctionHouseKey
  //   );

  //   const buyPrice = 1; // 1 SOL
  //   const tokenSize = 1;

  //   const buyPriceAdjusted = new anchor.BN(
  //     await getPriceWithMantissa(
  //       buyPrice,
  //       auctionHouseObj.treasuryMint,
  //       buyer,
  //       program
  //     )
  //   );

  //   const tokenSizeAdjusted = new anchor.BN(
  //     await getPriceWithMantissa(tokenSize, mintKey, buyer, program)
  //   );

  //   const [escrowPaymentAccount, escrowBump] =
  //     await getAuctionHouseBuyerEscrow(auctionHouseKey, buyer.publicKey);

  //   const [tradeState, tradeBump] = await getAuctionHouseTradeState(
  //     auctionHouseKey,
  //     buyer.publicKey,
  //     sellerTokenAccount,
  //     auctionHouseObj.treasuryMint,
  //     mintKey,
  //     tokenSizeAdjusted,
  //     buyPriceAdjusted
  //   );

  //   const metadata = await getMetadata(mintKey);

  //   const tx = await program.rpc.buy(
  //     tradeBump,
  //     escrowBump,
  //     buyPriceAdjusted,
  //     tokenSizeAdjusted,
  //     {
  //       accounts: {
  //         wallet: buyer.publicKey,
  //         paymentAccount: buyer.publicKey,
  //         transferAuthority: buyer.publicKey,
  //         metadata,
  //         tokenAccount: sellerTokenAccount,
  //         escrowPaymentAccount,
  //         treasuryMint: auctionHouseObj.treasuryMint,
  //         authority: auctionHouseObj.authority,
  //         auctionHouse: auctionHouseKey,
  //         auctionHouseFeeAccount: auctionHouseObj.auctionHouseFeeAccount,
  //         buyerTradeState: tradeState,
  //         tokenProgram: TOKEN_PROGRAM_ID,
  //         systemProgram: anchor.web3.SystemProgram.programId,
  //         rent: anchor.web3.SYSVAR_RENT_PUBKEY,
  //       },
  //       signers: [buyer],
  //     }
  //   );

  //   console.log("Created buy order, signature:", tx);
  // });

  // it("Executes a sale", async () => {
  //   const auctionHouseObj = await program.account.auctionHouse.fetch(
  //     auctionHouseKey
  //   );

  //   const buyPrice = 1;
  //   const tokenSize = 1;

  //   const buyPriceAdjusted = new anchor.BN(
  //     await getPriceWithMantissa(
  //       buyPrice,
  //       auctionHouseObj.treasuryMint,
  //       authority,
  //       program
  //     )
  //   );

  //   const tokenSizeAdjusted = new anchor.BN(
  //     await getPriceWithMantissa(tokenSize, mintKey, authority, program)
  //   );

  //   const buyerTradeState = (
  //     await getAuctionHouseTradeState(
  //       auctionHouseKey,
  //       buyer.publicKey,
  //       sellerTokenAccount,
  //       auctionHouseObj.treasuryMint,
  //       mintKey,
  //       tokenSizeAdjusted,
  //       buyPriceAdjusted
  //     )
  //   )[0];

  //   const sellerTradeState = (
  //     await getAuctionHouseTradeState(
  //       auctionHouseKey,
  //       seller.publicKey,
  //       sellerTokenAccount,
  //       auctionHouseObj.treasuryMint,
  //       mintKey,
  //       tokenSizeAdjusted,
  //       buyPriceAdjusted
  //     )
  //   )[0];

  //   const [freeTradeState, freeTradeStateBump] =
  //     await getAuctionHouseTradeState(
  //       auctionHouseKey,
  //       seller.publicKey,
  //       sellerTokenAccount,
  //       auctionHouseObj.treasuryMint,
  //       mintKey,
  //       tokenSizeAdjusted,
  //       new anchor.BN(0)
  //     );

  //   const [escrowPaymentAccount, bump] = await getAuctionHouseBuyerEscrow(
  //     auctionHouseKey,
  //     buyer.publicKey
  //   );

  //   const [programAsSigner, programAsSignerBump] =
  //     await getAuctionHouseProgramAsSigner();

  //   const metadata = await getMetadata(mintKey);
  //   const isNative = auctionHouseObj.treasuryMint.equals(WRAPPED_SOL_MINT);

  //   const buyerReceiptTokenAccount = (
  //     await getAtaForMint(mintKey, buyer.publicKey)
  //   )[0];

  //   const tx = await program.rpc.executeSale(
  //     bump,
  //     freeTradeStateBump,
  //     programAsSignerBump,
  //     buyPriceAdjusted,
  //     tokenSizeAdjusted,
  //     {
  //       accounts: {
  //         buyer: buyer.publicKey,
  //         seller: seller.publicKey,
  //         metadata,
  //         tokenAccount: sellerTokenAccount,
  //         tokenMint: mintKey,
  //         escrowPaymentAccount,
  //         treasuryMint: auctionHouseObj.treasuryMint,
  //         sellerPaymentReceiptAccount: seller.publicKey,
  //         buyerReceiptTokenAccount,
  //         authority: auctionHouseObj.authority,
  //         auctionHouse: auctionHouseKey,
  //         auctionHouseFeeAccount: auctionHouseObj.auctionHouseFeeAccount,
  //         auctionHouseTreasury: auctionHouseObj.auctionHouseTreasury,
  //         sellerTradeState,
  //         buyerTradeState,
  //         tokenProgram: TOKEN_PROGRAM_ID,
  //         systemProgram: anchor.web3.SystemProgram.programId,
  //         ataProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
  //         programAsSigner,
  //         rent: anchor.web3.SYSVAR_RENT_PUBKEY,
  //         freeTradeState,
  //       },
  //       remainingAccounts: [],
  //       signers: [authority],
  //     }
  //   );

  //   console.log("Executed sale, signature:", tx);

  //   // Verify the buyer received the NFT
  //   const buyerTokenAccountInfo = await provider.connection.getAccountInfo(
  //     buyerReceiptTokenAccount
  //   );
  //   assert.isNotNull(buyerTokenAccountInfo);
  // });

  // it("Cancels a listing", async () => {
  //   // Create a new sell order to cancel
  //   const auctionHouseObj = await program.account.auctionHouse.fetch(
  //     auctionHouseKey
  //   );

  //   const buyPrice = 2; // Different price
  //   const tokenSize = 1;

  //   const buyPriceAdjusted = new anchor.BN(
  //     await getPriceWithMantissa(
  //       buyPrice,
  //       auctionHouseObj.treasuryMint,
  //       seller,
  //       program
  //     )
  //   );

  //   const tokenSizeAdjusted = new anchor.BN(
  //     await getPriceWithMantissa(tokenSize, mintKey, seller, program)
  //   );

  //   // Get the existing largest token account
  //   const results = await provider.connection.getTokenLargestAccounts(mintKey);
  //   const tokenAccountKey = results.value[0].address;

  //   const tradeState = (
  //     await getAuctionHouseTradeState(
  //       auctionHouseKey,
  //       seller.publicKey,
  //       tokenAccountKey,
  //       auctionHouseObj.treasuryMint,
  //       mintKey,
  //       tokenSizeAdjusted,
  //       buyPriceAdjusted
  //     )
  //   )[0];

  //   const tx = await program.rpc.cancel(buyPriceAdjusted, tokenSizeAdjusted, {
  //     accounts: {
  //       wallet: seller.publicKey,
  //       tokenAccount: tokenAccountKey,
  //       tokenMint: mintKey,
  //       authority: auctionHouseObj.authority,
  //       auctionHouse: auctionHouseKey,
  //       auctionHouseFeeAccount: auctionHouseObj.auctionHouseFeeAccount,
  //       tradeState,
  //       tokenProgram: TOKEN_PROGRAM_ID,
  //     },
  //     signers: [seller],
  //   });

  //   console.log("Cancelled listing, signature:", tx);
  // });

  // it("Withdraws from buyer escrow", async () => {
  //   const auctionHouseObj = await program.account.auctionHouse.fetch(
  //     auctionHouseKey
  //   );

  //   const [escrowPaymentAccount, bump] = await getAuctionHouseBuyerEscrow(
  //     auctionHouseKey,
  //     buyer.publicKey
  //   );

  //   const currentBalance = await getTokenAmount(
  //     program,
  //     escrowPaymentAccount,
  //     auctionHouseObj.treasuryMint
  //   );

  //   const withdrawAmount = 1; // Withdraw 1 SOL
  //   const amountAdjusted = await getPriceWithMantissa(
  //     withdrawAmount,
  //     auctionHouseObj.treasuryMint,
  //     buyer,
  //     program
  //   );

  //   const isNative = auctionHouseObj.treasuryMint.equals(WRAPPED_SOL_MINT);

  //   const tx = await program.rpc.withdraw(bump, new anchor.BN(amountAdjusted), {
  //     accounts: {
  //       wallet: buyer.publicKey,
  //       receiptAccount: buyer.publicKey,
  //       escrowPaymentAccount,
  //       treasuryMint: auctionHouseObj.treasuryMint,
  //       authority: auctionHouseObj.authority,
  //       auctionHouse: auctionHouseKey,
  //       auctionHouseFeeAccount: auctionHouseObj.auctionHouseFeeAccount,
  //       tokenProgram: TOKEN_PROGRAM_ID,
  //       systemProgram: anchor.web3.SystemProgram.programId,
  //       rent: anchor.web3.SYSVAR_RENT_PUBKEY,
  //       ataProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
  //     },
  //     signers: [buyer],
  //   });

  //   console.log("Withdrew from escrow, signature:", tx);

  //   // Verify balance decreased
  //   const newBalance = await getTokenAmount(
  //     program,
  //     escrowPaymentAccount,
  //     auctionHouseObj.treasuryMint
  //   );

  //   assert.equal(newBalance, currentBalance - amountAdjusted);
  // });

  // it("Updates auction house settings", async () => {
  //   const newSfbp = 300; // 3% fee
  //   const newRequiresSignOff = true;
  //   const newCanChangeSalePrice = false;

  //   const auctionHouseObj = await program.account.auctionHouse.fetch(
  //     auctionHouseKey
  //   );

  //   const tMintKey = auctionHouseObj.treasuryMint;
  //   const twdKey = authority.publicKey;
  //   const fwdKey = authority.publicKey;

  //   const twdAta = tMintKey.equals(WRAPPED_SOL_MINT)
  //     ? twdKey
  //     : (await getAtaForMint(tMintKey, twdKey))[0];

  //   const tx = await program.rpc.updateAuctionHouse(
  //     newSfbp,
  //     newRequiresSignOff,
  //     newCanChangeSalePrice,
  //     {
  //       accounts: {
  //         treasuryMint: tMintKey,
  //         payer: authority.publicKey,
  //         authority: authority.publicKey,
  //         newAuthority: authority.publicKey,
  //         feeWithdrawalDestination: fwdKey,
  //         treasuryWithdrawalDestination: twdAta,
  //         treasuryWithdrawalDestinationOwner: twdKey,
  //         auctionHouse: auctionHouseKey,
  //         auctionHouseFeeAccount: feeAccount,
  //         auctionHouseTreasury: treasuryAccount,
  //         tokenProgram: TOKEN_PROGRAM_ID,
  //         systemProgram: anchor.web3.SystemProgram.programId,
  //         ataProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
  //         rent: anchor.web3.SYSVAR_RENT_PUBKEY,
  //       },
  //       signers: [authority],
  //     }
  //   );

  //   console.log("Updated auction house, signature:", tx);

  //   // Verify updates
  //   const updatedAuctionHouse = await program.account.auctionHouse.fetch(
  //     auctionHouseKey
  //   );

  //   assert.equal(updatedAuctionHouse.sellerFeeBasisPoints, newSfbp);
  //   assert.equal(updatedAuctionHouse.requiresSignOff, newRequiresSignOff);
  //   assert.equal(
  //     updatedAuctionHouse.canChangeSalePrice,
  //     newCanChangeSalePrice
  //   );
  // });
});