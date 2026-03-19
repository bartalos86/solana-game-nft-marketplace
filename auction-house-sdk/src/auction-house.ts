import log from "loglevel";
import { deserializeAccount, getAtaForMint, getAuctionHouse, getAuctionHouseBuyerEscrow, getAuctionHouseFeeAcct, getAuctionHouseProgramAsSigner, getAuctionHouseTradeState, getAuctionHouseTreasuryAcct, getMetadata, getTokenAmount, loadAuctionHouseProgram, loadWalletKey } from "./helpers/accounts";
import { BN, web3 } from '@project-serum/anchor';
import { sendTransactionWithRetryWithKeypair } from "./helpers/transactions";
import { ASSOCIATED_TOKEN_PROGRAM_ID, Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { getPriceWithMantissa } from "./helpers/various";
import { WRAPPED_SOL_MINT } from "./helpers/constants";
import { decodeMetadata, Metadata } from "./helpers/schema";

export async function getAuctionHouseFromOpts(
  auctionHouse: any,
  walletKeyPair: any,
  tMintKey: any,
) {
  let auctionHouseKey;
  if (auctionHouse) {
    auctionHouseKey = new web3.PublicKey(auctionHouse);
  } else {
    log.info(
      'No auction house explicitly passed in, assuming you are creator on it and deriving key...',
    );
    auctionHouseKey = (
      await getAuctionHouse(walletKeyPair.publicKey, tMintKey)
    )[0];
  }
  return auctionHouseKey;
}

export async function showEscrow(keypair: string, env: string, auctionHouse: string, wallet: string) {
  // const { keypair, env, auctionHouse, wallet } = cmd.opts();

  const otherWallet = wallet ? new web3.PublicKey(wallet) : null;
  const walletKeyPair = loadWalletKey(keypair);
  const anchorProgram = await loadAuctionHouseProgram(walletKeyPair, env);

  const auctionHouseKey = new web3.PublicKey(auctionHouse);
  const auctionHouseObj = await anchorProgram.account.auctionHouse.fetch(
    auctionHouseKey,
  );

  if (!otherWallet) {
    log.info('No --wallet passed in, defaulting to keypair');
  }
  const escrow = (
    await getAuctionHouseBuyerEscrow(
      auctionHouseKey,
      otherWallet || walletKeyPair.publicKey,
    )
  )[0];

  const amount = await getTokenAmount(
    anchorProgram,
    escrow,
    //@ts-ignore
    auctionHouseObj.treasuryMint,
  );

  log.info(
    otherWallet.toBase58() || walletKeyPair.publicKey.toBase58(),
    'Balance:',
    amount,
  );
}


export async function withdraw(keypair: string, env: string, amount: number, auctionHouse: string, auctionHouseKeypair: string){
  // const { keypair, env, amount, auctionHouse, auctionHouseKeypair } =
  // cmd.opts();
const auctionHouseKey = new web3.PublicKey(auctionHouse);
const walletKeyPair = loadWalletKey(keypair);

const auctionHouseKeypairLoaded = auctionHouseKeypair
  ? loadWalletKey(auctionHouseKeypair)
  : null;
const anchorProgram = await loadAuctionHouseProgram(walletKeyPair, env);
const auctionHouseObj = await anchorProgram.account.auctionHouse.fetch(
  auctionHouseKey,
);
const amountAdjusted = await getPriceWithMantissa(
  amount,
  //@ts-ignore
  auctionHouseObj.treasuryMint,
  walletKeyPair,
  anchorProgram,
);

const [escrowPaymentAccount, bump] = await getAuctionHouseBuyerEscrow(
  auctionHouseKey,
  walletKeyPair.publicKey,
);

//@ts-ignore
const isNative = auctionHouseObj.treasuryMint.equals(WRAPPED_SOL_MINT);

const ata = (
  await getAtaForMint(
    //@ts-ignore
    auctionHouseObj.treasuryMint,
    walletKeyPair.publicKey,
  )
)[0];
const signers = [];

const currBal = await getTokenAmount(
  anchorProgram,
  escrowPaymentAccount,
  //@ts-ignore
  auctionHouseObj.treasuryMint,
);

const instruction = await anchorProgram.instruction.withdraw(
  bump,
  new BN(amountAdjusted),
  {
    accounts: {
      wallet: walletKeyPair.publicKey,
      receiptAccount: isNative ? walletKeyPair.publicKey : ata,
      escrowPaymentAccount,
      //@ts-ignore
      treasuryMint: auctionHouseObj.treasuryMint,
      //@ts-ignore
      authority: auctionHouseObj.authority,
      auctionHouse: auctionHouseKey,
      //@ts-ignore
      auctionHouseFeeAccount: auctionHouseObj.auctionHouseFeeAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: web3.SystemProgram.programId,
      rent: web3.SYSVAR_RENT_PUBKEY,
      ataProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    },
    signers,
  },
);

if (auctionHouseKeypairLoaded) {
  signers.push(auctionHouseKeypairLoaded);

  instruction.keys
    .filter(k => k.pubkey.equals(auctionHouseKeypairLoaded.publicKey))
    .map(k => (k.isSigner = true));
}

instruction.keys
  .filter(k => k.pubkey.equals(walletKeyPair.publicKey))
  .map(k => (k.isSigner = true));

await sendTransactionWithRetryWithKeypair(
  anchorProgram.provider.connection,
  walletKeyPair,
  [instruction],
  signers,
  'max',
);

log.info(
  'Withdrew',
  amountAdjusted,
  'from your account with Auction House',
  auctionHouse,
  '. New Balance:',
  currBal - amountAdjusted,
);
}

export async function sell(keypair, env, auctionHouse, buyPrice, mint, tokenSize, auctionHouseSigns, auctionHouseKeypair = ""){
  // const {
  //   keypair,
  //   env,
  //   auctionHouse,
  //   auctionHouseKeypair,
  //   buyPrice,
  //   mint,
  //   tokenSize,
  //   auctionHouseSigns,
  // } = cmd.opts();

  const auctionHouseKey = new web3.PublicKey(auctionHouse);
  const walletKeyPair = loadWalletKey(keypair);

  const mintKey = new web3.PublicKey(mint);

  const auctionHouseKeypairLoaded = auctionHouseKeypair
    ? loadWalletKey(auctionHouseKeypair)
    : null;
  const anchorProgram = await loadAuctionHouseProgram(
    auctionHouseSigns ? auctionHouseKeypairLoaded : walletKeyPair,
    env,
  );
  const auctionHouseObj = await anchorProgram.account.auctionHouse.fetch(
    auctionHouseKey,
  );

  const buyPriceAdjusted = new BN(
    await getPriceWithMantissa(
      buyPrice,
      //@ts-ignore
      auctionHouseObj.treasuryMint,
      walletKeyPair,
      anchorProgram,
    ),
  );

  const tokenSizeAdjusted = new BN(
    await getPriceWithMantissa(
      tokenSize,
      mintKey,
      walletKeyPair,
      anchorProgram,
    ),
  );

  const tokenAccountKey = (
    await getAtaForMint(mintKey, walletKeyPair.publicKey)
  )[0];

  const [programAsSigner, programAsSignerBump] =
    await getAuctionHouseProgramAsSigner();
  // const metadata = await getMetadata(mintKey);

  const [tradeState, tradeBump] = await getAuctionHouseTradeState(
    auctionHouseKey,
    walletKeyPair.publicKey,
    tokenAccountKey,
    //@ts-ignore
    auctionHouseObj.treasuryMint,
    mintKey,
    tokenSizeAdjusted,
    buyPriceAdjusted,
  );

  const [freeTradeState, freeTradeBump] = await getAuctionHouseTradeState(
    auctionHouseKey,
    walletKeyPair.publicKey,
    tokenAccountKey,
    //@ts-ignore
    auctionHouseObj.treasuryMint,
    mintKey,
    tokenSizeAdjusted,
    new BN(0),
  );

  const signers = [];

  const instruction = await anchorProgram.instruction.sell(
    tradeBump,
    freeTradeBump,
    programAsSignerBump,
    buyPriceAdjusted,
    tokenSizeAdjusted,
    {
      accounts: {
        wallet: walletKeyPair.publicKey,
        metadata: await getMetadata(mintKey),
        tokenAccount: tokenAccountKey,
        //@ts-ignore
        authority: auctionHouseObj.authority,
        auctionHouse: auctionHouseKey,
        //@ts-ignore
        auctionHouseFeeAccount: auctionHouseObj.auctionHouseFeeAccount,
        sellerTradeState: tradeState,
        freeSellerTradeState: freeTradeState,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: web3.SystemProgram.programId,
        programAsSigner,
        rent: web3.SYSVAR_RENT_PUBKEY,
      },
      signers,
    },
  );

  if (auctionHouseKeypairLoaded) {
    signers.push(auctionHouseKeypairLoaded);

    instruction.keys
      .filter(k => k.pubkey.equals(auctionHouseKeypairLoaded.publicKey))
      .map(k => (k.isSigner = true));
  }

  if (!auctionHouseSigns) {
    instruction.keys
      .filter(k => k.pubkey.equals(walletKeyPair.publicKey))
      .map(k => (k.isSigner = true));
  }

  await sendTransactionWithRetryWithKeypair(
    anchorProgram.provider.connection,
    auctionHouseSigns ? auctionHouseKeypairLoaded : walletKeyPair,
    [instruction],
    signers,
    'max',
  );

  log.info(
    'Set',
    tokenSize,
    mint,
    'for sale for',
    buyPrice,
    'from your account with Auction House',
    auctionHouse,
  );
}

export async function withdrawFromTreasury(keypair, env, auctionHouse, treasuryMint, amount) {
  // const { keypair, env, auctionHouse, treasuryMint, amount } = cmd.opts();

    const walletKeyPair = loadWalletKey(keypair);

    const anchorProgram = await loadAuctionHouseProgram(walletKeyPair, env);

    let tMintKey;
    if (!treasuryMint) {
      log.info('No treasury mint detected, using SOL.');
      tMintKey = WRAPPED_SOL_MINT;
    } else {
      tMintKey = new web3.PublicKey(treasuryMint);
    }

    const auctionHouseKey = await getAuctionHouseFromOpts(
      auctionHouse,
      walletKeyPair,
      tMintKey,
    );

    const auctionHouseObj = await anchorProgram.account.auctionHouse.fetch(
      auctionHouseKey,
    );

    const amountAdjusted = new BN(
      await getPriceWithMantissa(
        amount,
        //@ts-ignore
        auctionHouseObj.treasuryMint,
        walletKeyPair,
        anchorProgram,
      ),
    );
    const signers = [];

    const instruction = await anchorProgram.instruction.withdrawFromTreasury(
      amountAdjusted,
      {
        accounts: {
          //@ts-ignore
          treasuryMint: auctionHouseObj.treasuryMint,
          //@ts-ignore
          authority: auctionHouseObj.authority,
          treasuryWithdrawalDestination:
            //@ts-ignore
            auctionHouseObj.treasuryWithdrawalDestination,
          //@ts-ignore
          auctionHouseTreasury: auctionHouseObj.auctionHouseTreasury,
          auctionHouse: auctionHouseKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: web3.SystemProgram.programId,
        },
        signers,
      },
    );

    await sendTransactionWithRetryWithKeypair(
      anchorProgram.provider.connection,
      walletKeyPair,
      [instruction],
      signers,
      'max',
    );

    log.info(
      'Withdrew',
      amountAdjusted.toNumber(),
      'from your account with Auction House',
      auctionHouse,
    );
}

export async function withdrawFromFees(keypair, env, auctionHouse, treasuryMint, amount){
  // const { keypair, env, auctionHouse, treasuryMint, amount } = cmd.opts();

  const walletKeyPair = loadWalletKey(keypair);

  const anchorProgram = await loadAuctionHouseProgram(walletKeyPair, env);

  let tMintKey;
  if (!treasuryMint) {
    log.info('No treasury mint detected, using SOL.');
    tMintKey = WRAPPED_SOL_MINT;
  } else {
    tMintKey = new web3.PublicKey(treasuryMint);
  }

  const auctionHouseKey = await getAuctionHouseFromOpts(
    auctionHouse,
    walletKeyPair,
    tMintKey,
  );

  const auctionHouseObj = await anchorProgram.account.auctionHouse.fetch(
    auctionHouseKey,
  );

  const amountAdjusted = new BN(
    await getPriceWithMantissa(
      amount,
      //@ts-ignore
      auctionHouseObj.treasuryMint,
      walletKeyPair,
      anchorProgram,
    ),
  );
  const signers = [];

  const instruction = await anchorProgram.instruction.withdrawFromFee(
    amountAdjusted,
    {
      accounts: {
        //@ts-ignore
        authority: auctionHouseObj.authority,
        feeWithdrawalDestination:
          //@ts-ignore
          auctionHouseObj.feeWithdrawalDestination,
        //@ts-ignore
        auctionHouseFeeAccount: auctionHouseObj.auctionHouseFeeAccount,
        auctionHouse: auctionHouseKey,
        systemProgram: web3.SystemProgram.programId,
      },
      signers,
    },
  );

  await sendTransactionWithRetryWithKeypair(
    anchorProgram.provider.connection,
    walletKeyPair,
    [instruction],
    signers,
    'max',
  );

  log.info(
    'Withdrew',
    amountAdjusted.toNumber(),
    'from your account with Auction House',
    auctionHouse,
  );
}

export async function cancel(keypair, env, auctionHouse, buyPrice, mint, tokenSize, auctionHouseSigns, auctionHouseKeypair=""){
  // const {
  //   keypair,
  //   env,
  //   auctionHouse,
  //   auctionHouseKeypair,
  //   buyPrice,
  //   mint,
  //   tokenSize,
  //   auctionHouseSigns,
  // } = cmd.opts();

  const auctionHouseKey = new web3.PublicKey(auctionHouse);
  const walletKeyPair = loadWalletKey(keypair);

  const mintKey = new web3.PublicKey(mint);

  const auctionHouseKeypairLoaded = auctionHouseKeypair
    ? loadWalletKey(auctionHouseKeypair)
    : null;
  const anchorProgram = await loadAuctionHouseProgram(
    auctionHouseSigns ? auctionHouseKeypairLoaded : walletKeyPair,
    env,
  );
  const auctionHouseObj = await anchorProgram.account.auctionHouse.fetch(
    auctionHouseKey,
  );

  const buyPriceAdjusted = new BN(
    await getPriceWithMantissa(
      buyPrice,
      //@ts-ignore
      auctionHouseObj.treasuryMint,
      walletKeyPair,
      anchorProgram,
    ),
  );

  const tokenSizeAdjusted = new BN(
    await getPriceWithMantissa(
      tokenSize,
      mintKey,
      walletKeyPair,
      anchorProgram,
    ),
  );

  const results = await anchorProgram.provider.connection
    .getTokenLargestAccounts(mintKey)
    .catch(e => {
      console.error(e);
      return { value: [] };
    });

  if (results.value.length == 0) {
    throw Error(
      "The Mint(NFT, Tokens) largest token account can't be found, this could be network instability or you have the wrong mint address.",
    );
  }

  const tokenAccountKey: web3.PublicKey = results.value[0].address;

  const tradeState = (
    await getAuctionHouseTradeState(
      auctionHouseKey,
      walletKeyPair.publicKey,
      tokenAccountKey,
      //@ts-ignore
      auctionHouseObj.treasuryMint,
      mintKey,
      tokenSizeAdjusted,
      buyPriceAdjusted,
    )
  )[0];

  const signers = [];

  const instruction = await anchorProgram.instruction.cancel(
    buyPriceAdjusted,
    tokenSizeAdjusted,
    {
      accounts: {
        wallet: walletKeyPair.publicKey,
        tokenAccount: tokenAccountKey,
        tokenMint: mintKey,
        //@ts-ignore
        authority: auctionHouseObj.authority,
        auctionHouse: auctionHouseKey,
        //@ts-ignore
        auctionHouseFeeAccount: auctionHouseObj.auctionHouseFeeAccount,
        tradeState,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      signers,
    },
  );

  if (auctionHouseKeypairLoaded) {
    signers.push(auctionHouseKeypairLoaded);

    instruction.keys
      .filter(k => k.pubkey.equals(auctionHouseKeypairLoaded.publicKey))
      .map(k => (k.isSigner = true));
  }

  if (!auctionHouseSigns) {
    instruction.keys
      .filter(k => k.pubkey.equals(walletKeyPair.publicKey))
      .map(k => (k.isSigner = true));
  }

  await sendTransactionWithRetryWithKeypair(
    anchorProgram.provider.connection,
    auctionHouseSigns ? auctionHouseKeypairLoaded : walletKeyPair,
    [instruction],
    signers,
    'max',
  );

  log.info(
    'Cancelled buy or sale of',
    tokenSize,
    mint,
    'for',
    buyPrice,
    'from your account with Auction House',
    auctionHouse,
  );
}

export async function executeSale(keypair, env, auctionHouse, buyPrice, mint, tokenSize, buyerWallet, sellerWallet, auctionHouseSigns, auctionHouseKeypair=""){
  // const {
  //   keypair,
  //   env,
  //   auctionHouse,
  //   auctionHouseKeypair,
  //   buyPrice,
  //   mint,
  //   tokenSize,
  //   auctionHouseSigns,
  //   buyerWallet,
  //   sellerWallet,
  // } = cmd.opts();

  const auctionHouseKey = new web3.PublicKey(auctionHouse);
  const walletKeyPair = loadWalletKey(keypair);

  const mintKey = new web3.PublicKey(mint);

  const auctionHouseKeypairLoaded = auctionHouseKeypair
    ? loadWalletKey(auctionHouseKeypair)
    : null;
  const anchorProgram = await loadAuctionHouseProgram(
    auctionHouseSigns ? auctionHouseKeypairLoaded : walletKeyPair,
    env,
  );
  const auctionHouseObj = await anchorProgram.account.auctionHouse.fetch(
    auctionHouseKey,
  );
  const buyerWalletKey = new web3.PublicKey(buyerWallet);
  const sellerWalletKey = new web3.PublicKey(sellerWallet);

  //@ts-ignore
  const isNative = auctionHouseObj.treasuryMint.equals(WRAPPED_SOL_MINT);
  const buyPriceAdjusted = new BN(
    await getPriceWithMantissa(
      buyPrice,
      //@ts-ignore
      auctionHouseObj.treasuryMint,
      walletKeyPair,
      anchorProgram,
    ),
  );

  const tokenSizeAdjusted = new BN(
    await getPriceWithMantissa(
      tokenSize,
      mintKey,
      walletKeyPair,
      anchorProgram,
    ),
  );

  const tokenAccountKey = (await getAtaForMint(mintKey, sellerWalletKey))[0];

  const buyerTradeState = (
    await getAuctionHouseTradeState(
      auctionHouseKey,
      buyerWalletKey,
      tokenAccountKey,
      //@ts-ignore
      auctionHouseObj.treasuryMint,
      mintKey,
      tokenSizeAdjusted,
      buyPriceAdjusted,
    )
  )[0];

  const sellerTradeState = (
    await getAuctionHouseTradeState(
      auctionHouseKey,
      sellerWalletKey,
      tokenAccountKey,
      //@ts-ignore
      auctionHouseObj.treasuryMint,
      mintKey,
      tokenSizeAdjusted,
      buyPriceAdjusted,
    )
  )[0];

  const [freeTradeState, freeTradeStateBump] =
    await getAuctionHouseTradeState(
      auctionHouseKey,
      sellerWalletKey,
      tokenAccountKey,
      //@ts-ignore
      auctionHouseObj.treasuryMint,
      mintKey,
      tokenSizeAdjusted,
      new BN(0),
    );
  const [escrowPaymentAccount, bump] = await getAuctionHouseBuyerEscrow(
    auctionHouseKey,
    buyerWalletKey,
  );
  const [programAsSigner, programAsSignerBump] =
    await getAuctionHouseProgramAsSigner();
  const metadata = await getMetadata(mintKey);

  const metadataObj = await anchorProgram.provider.connection.getAccountInfo(
    metadata,
  );
  const metadataDecoded: Metadata = decodeMetadata(
    Buffer.from(metadataObj.data),
  );

  const remainingAccounts = [];

  for (let i = 0; i < metadataDecoded.data.creators.length; i++) {
    remainingAccounts.push({
      pubkey: new web3.PublicKey(metadataDecoded.data.creators[i].address),
      isWritable: true,
      isSigner: false,
    });
    if (!isNative) {
      remainingAccounts.push({
        pubkey: (
          await getAtaForMint(
            //@ts-ignore
            auctionHouseObj.treasuryMint,
            remainingAccounts[remainingAccounts.length - 1].pubkey,
          )
        )[0],
        isWritable: true,
        isSigner: false,
      });
    }
  }
  const signers = [];
  //@ts-ignore
  const tMint: web3.PublicKey = auctionHouseObj.treasuryMint;

  const instruction = await anchorProgram.instruction.executeSale(
    bump,
    freeTradeStateBump,
    programAsSignerBump,
    buyPriceAdjusted,
    tokenSizeAdjusted,
    {
      accounts: {
        buyer: buyerWalletKey,
        seller: sellerWalletKey,
        metadata,
        tokenAccount: tokenAccountKey,
        tokenMint: mintKey,
        escrowPaymentAccount,
        treasuryMint: tMint,
        sellerPaymentReceiptAccount: isNative
          ? sellerWalletKey
          : (
              await getAtaForMint(tMint, sellerWalletKey)
            )[0],
        buyerReceiptTokenAccount: (
          await getAtaForMint(mintKey, buyerWalletKey)
        )[0],
        //@ts-ignore
        authority: auctionHouseObj.authority,
        auctionHouse: auctionHouseKey,
        //@ts-ignore
        auctionHouseFeeAccount: auctionHouseObj.auctionHouseFeeAccount,
        //@ts-ignore
        auctionHouseTreasury: auctionHouseObj.auctionHouseTreasury,
        sellerTradeState,
        buyerTradeState,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: web3.SystemProgram.programId,
        ataProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        programAsSigner,
        rent: web3.SYSVAR_RENT_PUBKEY,
        freeTradeState,
      },
      remainingAccounts,
      signers,
    },
  );

  if (auctionHouseKeypairLoaded) {
    signers.push(auctionHouseKeypairLoaded);

    instruction.keys
      .filter(k => k.pubkey.equals(auctionHouseKeypairLoaded.publicKey))
      .map(k => (k.isSigner = true));
  }

  if (!auctionHouseSigns) {
    instruction.keys
      .filter(k => k.pubkey.equals(walletKeyPair.publicKey))
      .map(k => (k.isSigner = true));
  }

  await sendTransactionWithRetryWithKeypair(
    anchorProgram.provider.connection,
    auctionHouseSigns ? auctionHouseKeypairLoaded : walletKeyPair,
    [instruction],
    signers,
    'max',
  );

  log.info(
    'Accepted',
    tokenSize,
    mint,
    'sale from wallet',
    sellerWalletKey.toBase58(),
    'to',
    buyerWalletKey.toBase58(),
    'for',
    buyPrice,
    'from your account with Auction House',
    auctionHouse,
  );
}


export async function buy(keypair, env, auctionHouse,buyPrice, mint, tokenSize, tokenAccount, auctionHouseKeypair=""){
  // const {
  //   keypair,
  //   env,
  //   auctionHouse,
  //   auctionHouseKeypair,
  //   buyPrice,
  //   mint,
  //   tokenSize,
  //   tokenAccount,
  // } = cmd.opts();

  const auctionHouseKey = new web3.PublicKey(auctionHouse);
  const walletKeyPair = loadWalletKey(keypair);

  const mintKey = new web3.PublicKey(mint);

  const auctionHouseKeypairLoaded = auctionHouseKeypair
    ? loadWalletKey(auctionHouseKeypair)
    : null;
  const anchorProgram = await loadAuctionHouseProgram(walletKeyPair, env);
  const auctionHouseObj = await anchorProgram.account.auctionHouse.fetch(
    auctionHouseKey,
  );

  const buyPriceAdjusted = new BN(
    await getPriceWithMantissa(
      buyPrice,
      //@ts-ignore
      auctionHouseObj.treasuryMint,
      walletKeyPair,
      anchorProgram,
    ),
  );

  const tokenSizeAdjusted = new BN(
    await getPriceWithMantissa(
      tokenSize,
      mintKey,
      walletKeyPair,
      anchorProgram,
    ),
  );

  const [escrowPaymentAccount, escrowBump] = await getAuctionHouseBuyerEscrow(
    auctionHouseKey,
    walletKeyPair.publicKey,
  );

  const results =
    await anchorProgram.provider.connection.getTokenLargestAccounts(mintKey);

  const tokenAccountKey: web3.PublicKey = tokenAccount
    ? new web3.PublicKey(tokenAccount)
    : results.value[0].address;

  const [tradeState, tradeBump] = await getAuctionHouseTradeState(
    auctionHouseKey,
    walletKeyPair.publicKey,
    tokenAccountKey,
    //@ts-ignore
    auctionHouseObj.treasuryMint,
    mintKey,
    tokenSizeAdjusted,
    buyPriceAdjusted,
  );

  //@ts-ignore
  const isNative = auctionHouseObj.treasuryMint.equals(WRAPPED_SOL_MINT);

  const ata = (
    await getAtaForMint(
      //@ts-ignore
      auctionHouseObj.treasuryMint,
      walletKeyPair.publicKey,
    )
  )[0];
  const transferAuthority = web3.Keypair.generate();
  const signers = isNative ? [] : [transferAuthority];
  const instruction = await anchorProgram.instruction.buy(
    tradeBump,
    escrowBump,
    buyPriceAdjusted,
    tokenSizeAdjusted,
    {
      accounts: {
        wallet: walletKeyPair.publicKey,
        paymentAccount: isNative ? walletKeyPair.publicKey : ata,
        transferAuthority: isNative
          ? walletKeyPair.publicKey
          : transferAuthority.publicKey,
        metadata: await getMetadata(mintKey),
        tokenAccount: tokenAccountKey,
        escrowPaymentAccount,
        //@ts-ignore
        treasuryMint: auctionHouseObj.treasuryMint,
        //@ts-ignore
        authority: auctionHouseObj.authority,
        auctionHouse: auctionHouseKey,
        //@ts-ignore
        auctionHouseFeeAccount: auctionHouseObj.auctionHouseFeeAccount,
        buyerTradeState: tradeState,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: web3.SystemProgram.programId,
        rent: web3.SYSVAR_RENT_PUBKEY,
      },
    },
  );

  if (auctionHouseKeypairLoaded) {
    signers.push(auctionHouseKeypairLoaded);

    instruction.keys
      .filter(k => k.pubkey.equals(auctionHouseKeypairLoaded.publicKey))
      .map(k => (k.isSigner = true));
  }
  if (!isNative) {
    instruction.keys
      .filter(k => k.pubkey.equals(transferAuthority.publicKey))
      .map(k => (k.isSigner = true));
  }
  const instructions = [
    ...(isNative
      ? []
      : [
          Token.createApproveInstruction(
            TOKEN_PROGRAM_ID,
            ata,
            transferAuthority.publicKey,
            walletKeyPair.publicKey,
            [],
            buyPriceAdjusted.toNumber(),
          ),
        ]),

    instruction,
    ...(isNative
      ? []
      : [
          Token.createRevokeInstruction(
            TOKEN_PROGRAM_ID,
            ata,
            walletKeyPair.publicKey,
            [],
          ),
        ]),
  ];
  await sendTransactionWithRetryWithKeypair(
    anchorProgram.provider.connection,
    walletKeyPair,
    instructions,
    signers,
    'max',
  );

  log.info('Made offer for ', buyPrice);
}


export async function deposit(keypair, env, amount, auctionHouse, auctionHouseKeypair){
  // const { keypair, env, amount, auctionHouse, auctionHouseKeypair } =
  // cmd.opts();
const auctionHouseKey = new web3.PublicKey(auctionHouse);
const walletKeyPair = loadWalletKey(keypair);

const auctionHouseKeypairLoaded = auctionHouseKeypair
  ? loadWalletKey(auctionHouseKeypair)
  : null;
const anchorProgram = await loadAuctionHouseProgram(walletKeyPair, env);
const auctionHouseObj = await anchorProgram.account.auctionHouse.fetch(
  auctionHouseKey,
);
const amountAdjusted = await getPriceWithMantissa(
  amount,
  //@ts-ignore
  auctionHouseObj.treasuryMint,
  walletKeyPair,
  anchorProgram,
);
const [escrowPaymentAccount, bump] = await getAuctionHouseBuyerEscrow(
  auctionHouseKey,
  walletKeyPair.publicKey,
);

//@ts-ignore
const isNative = auctionHouseObj.treasuryMint.equals(WRAPPED_SOL_MINT);

const ata = (
  await getAtaForMint(
    //@ts-ignore
    auctionHouseObj.treasuryMint,
    walletKeyPair.publicKey,
  )
)[0];
const transferAuthority = web3.Keypair.generate();
const signers = isNative ? [] : [transferAuthority];
const instruction = await anchorProgram.instruction.deposit(
  bump,
  new BN(amountAdjusted),
  {
    accounts: {
      wallet: walletKeyPair.publicKey,
      paymentAccount: isNative ? walletKeyPair.publicKey : ata,
      transferAuthority: isNative
        ? web3.SystemProgram.programId
        : transferAuthority.publicKey,
      escrowPaymentAccount,
      //@ts-ignore
      treasuryMint: auctionHouseObj.treasuryMint,
      //@ts-ignore
      authority: auctionHouseObj.authority,
      auctionHouse: auctionHouseKey,
      //@ts-ignore
      auctionHouseFeeAccount: auctionHouseObj.auctionHouseFeeAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: web3.SystemProgram.programId,
      rent: web3.SYSVAR_RENT_PUBKEY,
    },
  },
);

if (auctionHouseKeypairLoaded) {
  signers.push(auctionHouseKeypairLoaded);

  instruction.keys
    .filter(k => k.pubkey.equals(auctionHouseKeypairLoaded.publicKey))
    .map(k => (k.isSigner = true));
}

if (!isNative) {
  instruction.keys
    .filter(k => k.pubkey.equals(transferAuthority.publicKey))
    .map(k => (k.isSigner = true));
}

const currBal = await getTokenAmount(
  anchorProgram,
  escrowPaymentAccount,
  //@ts-ignore
  auctionHouseObj.treasuryMint,
);

const instructions = [
  ...(isNative
    ? []
    : [
        Token.createApproveInstruction(
          TOKEN_PROGRAM_ID,
          ata,
          transferAuthority.publicKey,
          walletKeyPair.publicKey,
          [],
          amountAdjusted,
        ),
      ]),

  instruction,
  ...(isNative
    ? []
    : [
        Token.createRevokeInstruction(
          TOKEN_PROGRAM_ID,
          ata,
          walletKeyPair.publicKey,
          [],
        ),
      ]),
];
await sendTransactionWithRetryWithKeypair(
  anchorProgram.provider.connection,
  walletKeyPair,
  instructions,
  signers,
  'max',
);

log.info(
  'Deposited ',
  amountAdjusted,
  'to your account with Auction House',
  auctionHouse,
  '. New Balance:',
  currBal + amountAdjusted,
);
}

export async function showAuctionHouse(keypair, env, auctionHouse, treasuryMint){
  // const { keypair, env, auctionHouse, treasuryMint } = cmd.opts();

  const walletKeyPair = loadWalletKey(keypair);
  const anchorProgram = await loadAuctionHouseProgram(walletKeyPair, env);
  let tMintKey;
  if (!treasuryMint) {
    log.info('No treasury mint detected, using SOL.');
    tMintKey = WRAPPED_SOL_MINT;
  } else {
    tMintKey = new web3.PublicKey(treasuryMint);
  }

  const auctionHouseKey = await getAuctionHouseFromOpts(
    auctionHouse,
    walletKeyPair,
    tMintKey,
  );

  const auctionHouseObj = await anchorProgram.account.auctionHouse.fetch(
    auctionHouseKey,
  );

  const treasuryAmount = await getTokenAmount(
    anchorProgram,
    //@ts-ignore
    auctionHouseObj.auctionHouseTreasury,
    //@ts-ignore
    auctionHouseObj.treasuryMint,
  );

  const feeAmount = await anchorProgram.provider.connection.getBalance(
    //@ts-ignore
    auctionHouseObj.auctionHouseFeeAccount,
  );

  log.info('-----');
  log.info('Auction House:', auctionHouseKey.toBase58());
  //@ts-ignore
  log.info('Mint:', auctionHouseObj.treasuryMint.toBase58());
  //@ts-ignore
  log.info('Authority:', auctionHouseObj.authority.toBase58());
  //@ts-ignore
  log.info('Creator:', auctionHouseObj.creator.toBase58());
  log.info(
    'Fee Payer Acct:',
    //@ts-ignore
    auctionHouseObj.auctionHouseFeeAccount.toBase58(),
  );
  //@ts-ignore
  log.info('Treasury Acct:', auctionHouseObj.auctionHouseTreasury.toBase58());
  log.info(
    'Fee Payer Withdrawal Acct:',
    //@ts-ignore
    auctionHouseObj.feeWithdrawalDestination.toBase58(),
  );
  log.info(
    'Treasury Withdrawal Acct:',
    //@ts-ignore
    auctionHouseObj.treasuryWithdrawalDestination.toBase58(),
  );

  log.info('Fee Payer Bal:', feeAmount);
  log.info('Treasury Bal:', treasuryAmount);
  //@ts-ignore
  log.info('Seller Fee Basis Points:', auctionHouseObj.sellerFeeBasisPoints);
  //@ts-ignore
  log.info('Requires Sign Off:', auctionHouseObj.requiresSignOff);
  //@ts-ignore
  log.info('Can Change Sale Price:', auctionHouseObj.canChangeSalePrice);
  //@ts-ignore
  log.info('AH Bump:', auctionHouseObj.bump);
  //@ts-ignore
  log.info('AH Fee Bump:', auctionHouseObj.feePayerBump);
  //@ts-ignore
  log.info('AH Treasury Bump:', auctionHouseObj.treasuryBump);
}


export async function createAuctionHouse(keypair, env, sellerFeeBasisPoints, treasuryMint, canChangeSalePrice, requiresSignOff, treasuryWithdrawalDestination, feeWithdrawalDestination){
  // const {
  //   keypair,
  //   env,
  //   sellerFeeBasisPoints,
  //   canChangeSalePrice,
  //   requiresSignOff,
  //   treasuryWithdrawalDestination,
  //   feeWithdrawalDestination,
  //   treasuryMint,
  // } = cmd.opts();

  const sfbp = parseInt(sellerFeeBasisPoints);

  const walletKeyPair = loadWalletKey(keypair);
  const anchorProgram = await loadAuctionHouseProgram(walletKeyPair, env);

  let twdKey: web3.PublicKey,
    fwdKey: web3.PublicKey,
    tMintKey: web3.PublicKey;
  if (!treasuryWithdrawalDestination) {
    log.info('No treasury withdrawal dest detected, using keypair');
    twdKey = walletKeyPair.publicKey;
  } else {
    twdKey = new web3.PublicKey(treasuryWithdrawalDestination);
  }
  if (!feeWithdrawalDestination) {
    log.info('No fee withdrawal dest detected, using keypair');
    fwdKey = walletKeyPair.publicKey;
  } else {
    fwdKey = new web3.PublicKey(feeWithdrawalDestination);
  }
  if (!treasuryMint) {
    log.info('No treasury mint detected, using SOL.');
    tMintKey = WRAPPED_SOL_MINT;
  } else {
    tMintKey = new web3.PublicKey(treasuryMint);
  }
  const twdAta = tMintKey.equals(WRAPPED_SOL_MINT)
    ? twdKey
    : (await getAtaForMint(tMintKey, twdKey))[0];

  const [auctionHouse, bump] = await getAuctionHouse(
    walletKeyPair.publicKey,
    tMintKey,
  );
  const [feeAccount, feeBump] = await getAuctionHouseFeeAcct(auctionHouse);
  const [treasuryAccount, treasuryBump] = await getAuctionHouseTreasuryAcct(
    auctionHouse,
  );

  await anchorProgram.rpc.createAuctionHouse(
    bump,
    feeBump,
    treasuryBump,
    sfbp,
    requiresSignOff == 'true',
    canChangeSalePrice == 'true',
    {
      accounts: {
        treasuryMint: tMintKey,
        payer: walletKeyPair.publicKey,
        authority: walletKeyPair.publicKey,
        feeWithdrawalDestination: fwdKey,
        treasuryWithdrawalDestination: twdAta,
        treasuryWithdrawalDestinationOwner: twdKey,
        auctionHouse,
        auctionHouseFeeAccount: feeAccount,
        auctionHouseTreasury: treasuryAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: web3.SystemProgram.programId,
        ataProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        rent: web3.SYSVAR_RENT_PUBKEY,
      },
    },
  );
  log.info('Created auction house', auctionHouse.toBase58());
}

export async function updateAuctionHouse(keypair, env, sellerFeeBasisPoints, treasuryMint, auctionHouse, newAuthority, canChangeSalePrice, requiresSignOff, treasuryWithdrawalDestination, feeWithdrawalDestination, force){
  // const {
  //   keypair,
  //   env,
  //   sellerFeeBasisPoints,
  //   canChangeSalePrice,
  //   requiresSignOff,
  //   treasuryWithdrawalDestination,
  //   feeWithdrawalDestination,
  //   treasuryMint,
  //   auctionHouse,
  //   newAuthority,
  //   force,
  // } = cmd.opts();

  const walletKeyPair = loadWalletKey(keypair);
  const anchorProgram = await loadAuctionHouseProgram(walletKeyPair, env);

  let tMintKey: web3.PublicKey;
  if (!treasuryMint) {
    log.info('No treasury mint detected, using SOL.');
    tMintKey = WRAPPED_SOL_MINT;
  } else {
    tMintKey = new web3.PublicKey(treasuryMint);
  }

  const auctionHouseKey = await getAuctionHouseFromOpts(
    auctionHouse,
    walletKeyPair,
    tMintKey,
  );
  const auctionHouseObj = await anchorProgram.account.auctionHouse.fetch(
    auctionHouseKey,
  );
  //@ts-ignore
  tMintKey = auctionHouseObj.treasuryMint;

  let twdKey: web3.PublicKey, fwdKey: web3.PublicKey;
  if (!treasuryWithdrawalDestination) {
    log.info('No treasury withdrawal dest detected, using original value');
    twdKey = tMintKey.equals(WRAPPED_SOL_MINT)
      ? //@ts-ignore
        auctionHouseObj.treasuryWithdrawalDestination
      : deserializeAccount(
          Buffer.from(
            (
              await anchorProgram.provider.connection.getAccountInfo(
                //@ts-ignore
                auctionHouseObj.treasuryWithdrawalDestination,
              )
            ).data,
          ),
        ).owner;
  } else {
    twdKey = new web3.PublicKey(treasuryWithdrawalDestination);
  }
  if (!feeWithdrawalDestination) {
    log.info('No fee withdrawal dest detected, using original value');
    //@ts-ignore
    fwdKey = auctionHouseObj.feeWithdrawalDestination;
  } else {
    fwdKey = new web3.PublicKey(feeWithdrawalDestination);
  }
  const twdAta = tMintKey.equals(WRAPPED_SOL_MINT)
    ? twdKey
    : (await getAtaForMint(tMintKey, twdKey))[0];

  let sfbp;
  if (sellerFeeBasisPoints != undefined && sellerFeeBasisPoints != null) {
    sfbp = parseInt(sellerFeeBasisPoints);
  } else {
    log.info('No sfbp passed in, using original value');
    //@ts-ignore
    sfbp = auctionHouseObj.sellerFeeBasisPoints;
  }

  let newAuth;
  if (newAuthority != undefined && newAuthority != null) {
    if (!force) {
      throw Error(
        'Cannot change authority without additional force flag. Are you sure you want to do this?',
      );
    }
    newAuth = newAuthority;
  } else {
    log.info('No authority passed in, using original value');
    //@ts-ignore
    newAuth = auctionHouseObj.authority;
  }

  let ccsp;
  if (canChangeSalePrice != undefined && canChangeSalePrice != null) {
    ccsp = canChangeSalePrice == 'true';
  } else {
    log.info('No can change sale price passed in, using original value');
    //@ts-ignore
    ccsp = auctionHouseObj.canChangeSalePrice;
  }

  let rso;
  if (requiresSignOff != undefined && requiresSignOff != null) {
    rso = requiresSignOff == 'true';
  } else {
    log.info('No requires sign off passed in, using original value');
    //@ts-ignore
    rso = auctionHouseObj.requiresSignOff;
  }
  await anchorProgram.rpc.updateAuctionHouse(sfbp, rso, ccsp, {
    accounts: {
      treasuryMint: tMintKey,
      payer: walletKeyPair.publicKey,
      authority: walletKeyPair.publicKey,
      // extra safety here even though newAuth should be right
      //@ts-ignore
      newAuthority: force ? newAuth : auctionHouseObj.authority,
      feeWithdrawalDestination: fwdKey,
      treasuryWithdrawalDestination: twdAta,
      treasuryWithdrawalDestinationOwner: twdKey,
      auctionHouse: auctionHouseKey,
      //@ts-ignore
      auctionHouseFeeAccount: auctionHouseObj.feePayer,
      //@ts-ignore
      auctionHouseTreasury: auctionHouseObj.treasury,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: web3.SystemProgram.programId,
      ataProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      rent: web3.SYSVAR_RENT_PUBKEY,
    },
  });
  log.info('Updated auction house', auctionHouseKey.toBase58());
}