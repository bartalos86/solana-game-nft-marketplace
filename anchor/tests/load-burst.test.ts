/**
 * Solana load & burst tests for mint/list/buy.
 *
 * Run:
 *   anchor test
 * or
 *   vitest run tests/marketplace-load-burst.test.ts
 */

import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Marketplace } from "../target/types/marketplace";
import {
  createAssociatedTokenAccountInstruction,
  createInitializeMint2Instruction,
  createMint,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  ComputeBudgetProgram,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { mplTokenMetadata, createMetadataAccountV3, createMasterEditionV3 } from "@metaplex-foundation/mpl-token-metadata";
import { createSignerFromKeypair, none, signerIdentity, signerPayer, some } from "@metaplex-foundation/umi";
import { fromWeb3JsKeypair, fromWeb3JsPublicKey, toWeb3JsLegacyTransaction } from "@metaplex-foundation/umi-web3js-adapters";
import { logSolTxBalanceBreakdown, solTxBalanceBreakdownFromMeta } from "./sol-tx-rent";

const MPL_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

const LOAD_LEVELS = [10, 50, 100, 500];
const PRICE = new BN(0.01 * LAMPORTS_PER_SOL);
const CU_LIMIT = 100_000_000;
const BURST_COUNT = 5;
const BURST_SIZE = 200;
const BURST_COOLDOWN_MS = 1200;
const PARALLEL_TEST_TIMEOUT_MS = 45 * 60 * 1000;
const BURST_TEST_TIMEOUT_MS = BURST_SIZE * 60 * 1000;
const MINT_BURST_TEST_TIMEOUT_MS = BURST_TEST_TIMEOUT_MS;
const RESULTS_DIR = path.resolve(process.cwd(), "benchmark-results");
const MARKETPLACE_FEE_RECIPIENT = new PublicKey("5GLPnCWkDniHq4B7o7K5fsxRKf4xpprX2ENngRs4VGeB");
const NFT_NAME = "T";
const NFT_SYMBOL = "T";
const NFT_URI = "";

interface TxMetric {
  ok: boolean;
  latencyMs: number;
  cu: number;
  label: string;
  error?: string;
}

interface ScenarioSummary {
  label: string;
  attempts: number;
  ok: number;
  fail: number;
  latencyP50Ms: number;
  latencyP95Ms: number;
  cuMean: number;
  cuP95: number;
}

interface NftFixture {
  mint: PublicKey;
  listingPda: PublicKey;
  metadata: PublicKey;
  masterEdition: PublicKey;
}

const metadataPda = (mint: PublicKey) =>
  PublicKey.findProgramAddressSync([Buffer.from("metadata"), MPL_ID.toBuffer(), mint.toBuffer()], MPL_ID)[0];

const masterEditionPda = (mint: PublicKey) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("metadata"), MPL_ID.toBuffer(), mint.toBuffer(), Buffer.from("edition")],
    MPL_ID,
  )[0];

function nowMs(): number {
  return Date.now();
}

async function ensureMinBalance(
  connection: anchor.web3.Connection,
  pubkey: PublicKey,
  minLamports: number,
): Promise<void> {
  const balance = await connection.getBalance(pubkey, "confirmed");
  if (balance >= minLamports) return;
  const topUpLamports = Math.max(minLamports - balance, 1 * LAMPORTS_PER_SOL);
  const sig = await connection.requestAirdrop(pubkey, topUpLamports);
  await connection.confirmTransaction(sig, "confirmed");
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx] ?? 0;
}

function summarize(label: string, rows: TxMetric[]): ScenarioSummary {
  const ok = rows.filter((r) => r.ok);
  const fail = rows.length - ok.length;
  const latencies = ok.map((r) => r.latencyMs).sort((a, b) => a - b);
  const cus = ok.map((r) => r.cu).sort((a, b) => a - b);
  const mean = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
  const summary: ScenarioSummary = {
    label,
    attempts: rows.length,
    ok: ok.length,
    fail,
    latencyP50Ms: percentile(latencies, 50),
    latencyP95Ms: percentile(latencies, 95),
    cuMean: mean(cus),
    cuP95: percentile(cus, 95),
  };
  console.log(
    `[${label}] attempts=${rows.length} ok=${ok.length} fail=${fail} p50=${summary.latencyP50Ms.toFixed(
      2,
    )}ms p95=${summary.latencyP95Ms.toFixed(2)}ms cuMean=${summary.cuMean.toFixed(0)} cuP95=${summary.cuP95.toFixed(0)}`,
  );
  return summary;
}

async function writeJsonReport(filename: string, payload: unknown) {
  await mkdir(RESULTS_DIR, { recursive: true });
  const outPath = path.join(RESULTS_DIR, filename);
  await writeFile(outPath, JSON.stringify(payload, null, 2), "utf8");
  console.log(`[JSON] wrote ${outPath}`);
}

async function sendTx(
  connection: anchor.web3.Connection,
  ixs: TransactionInstruction[],
  payer: Keypair,
  signers: Keypair[] = [payer],
): Promise<string> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const latest = await connection.getLatestBlockhash();
      const tx = new Transaction().add(...ixs);
      tx.recentBlockhash = latest.blockhash;
      tx.feePayer = payer.publicKey;
      tx.sign(...signers);
      const sig = await connection.sendRawTransaction(tx.serialize());
      await connection.confirmTransaction(
        {
          signature: sig,
          blockhash: latest.blockhash,
          lastValidBlockHeight: latest.lastValidBlockHeight,
        },
        "confirmed",
      );
      return sig;
    } catch (e: unknown) {
      lastError = e;
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes("Blockhash not found") || attempt === 2) {
        throw e;
      }
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  throw lastError ?? new Error("sendTx failed");
}

async function logCuAndSolRent(
  connection: anchor.web3.Connection,
  label: string,
  sig: string,
): Promise<number> {
  const info = await connection.getTransaction(sig, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });
  if (info?.meta) {
    logSolTxBalanceBreakdown(label, solTxBalanceBreakdownFromMeta(info.meta));
  }
  return info?.meta?.computeUnitsConsumed ?? 0;
}

describe("Solana marketplace load & burst", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Marketplace as Program<Marketplace>;
  const connection = provider.connection;
  const payer = (provider.wallet as anchor.Wallet).payer;
  const runId = new Date().toISOString().replaceAll(":", "-");
  const runSummaries: ScenarioSummary[] = [];
  const umi = createUmi(connection).use(mplTokenMetadata());
  const umiSigner = createSignerFromKeypair(umi, fromWeb3JsKeypair(payer));
  umi.use(signerIdentity(umiSigner)).use(signerPayer(umiSigner));

  const runMetric = async (label: string, send: () => Promise<string>): Promise<TxMetric> => {
    const start = nowMs();
    try {
      const sig = await send();
      const latencyMs = nowMs() - start;
      const cu = await logCuAndSolRent(connection, label, sig);
      return { ok: true, latencyMs, cu, label };
    } catch (e: unknown) {
      return {
        ok: false,
        latencyMs: nowMs() - start,
        cu: 0,
        label,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  };

  beforeEach(async () => {
    await ensureMinBalance(connection, payer.publicKey, 100 * LAMPORTS_PER_SOL);
    await ensureMinBalance(connection, MARKETPLACE_FEE_RECIPIENT, 10 * LAMPORTS_PER_SOL);
  });

  const createNftFixture = async (): Promise<NftFixture> => {
    const mint = await createMint(connection, payer, payer.publicKey, payer.publicKey, 0);
    const sellerAta = getAssociatedTokenAddressSync(mint, payer.publicKey);
    await sendTx(connection, [createAssociatedTokenAccountInstruction(payer.publicKey, sellerAta, payer.publicKey, mint)], payer);
    await mintTo(connection, payer, mint, sellerAta, payer, 1);
    const mintUmi = fromWeb3JsPublicKey(mint);

    const metadataBuilder = createMetadataAccountV3(umi, {
      mint: mintUmi,
      mintAuthority: umi.payer,
      data: {
        name: NFT_NAME,
        symbol: NFT_SYMBOL,
        uri: NFT_URI,
        sellerFeeBasisPoints: 0,
        creators: none(),
        collection: none(),
        uses: none(),
      },
      isMutable: true,
      collectionDetails: none(),
    });
    await sendTx(
      connection,
      toWeb3JsLegacyTransaction((await metadataBuilder.setFeePayer(umi.payer).buildAndSign(umi))).instructions,
      payer,
    );

    const masterEditionBuilder = createMasterEditionV3(umi, {
      mint: mintUmi,
      mintAuthority: umi.payer,
      updateAuthority: umi.payer,
      maxSupply: some(0),
    });
    await sendTx(
      connection,
      toWeb3JsLegacyTransaction((await masterEditionBuilder.setFeePayer(umi.payer).buildAndSign(umi))).instructions,
      payer,
    );
    const [listingPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("listing"), payer.publicKey.toBuffer(), mint.toBuffer()],
      program.programId,
    );
    return {
      mint,
      listingPda,
      metadata: metadataPda(mint),
      masterEdition: masterEditionPda(mint),
    };
  };

  const listAndBuy = async (fixture: NftFixture, buyer: Keypair): Promise<{ list: TxMetric; buy: TxMetric }> => {
    const expiry = new BN(Math.floor(Date.now() / 1000) + 24 * 3600);
    const list = await runMetric("list_nft", () =>
      program.methods
        .listNft(PRICE, expiry)
        .accounts({
          seller: payer.publicKey,
          mint: fixture.mint,
          metadata: fixture.metadata,
          masterEdition: fixture.masterEdition,
          sellerTokenRecord: null,
          escrowTokenRecord: null,
          tokenProgram: TOKEN_PROGRAM_ID,
        } as any)
        .preInstructions([ComputeBudgetProgram.setComputeUnitLimit({ units: CU_LIMIT })])
        .rpc({ commitment: "confirmed" }),
    );

    const buy = await runMetric("buy_nft", () =>
      program.methods
        .buyNft()
        .accounts({
          buyer: buyer.publicKey,
          seller: payer.publicKey,
          marketplaceFeeRecipient: MARKETPLACE_FEE_RECIPIENT,
          updateAuthorityFeeRecipient: payer.publicKey,
          mint: fixture.mint,
          listing: fixture.listingPda,
          metadata: fixture.metadata,
          masterEdition: fixture.masterEdition,
          escrowTokenRecord: null,
          buyerTokenRecord: null,
          tokenProgram: TOKEN_PROGRAM_ID,
        } as any)
        .preInstructions([ComputeBudgetProgram.setComputeUnitLimit({ units: CU_LIMIT })])
        .signers([buyer])
        .rpc({ commitment: "confirmed" }),
    );
    return { list, buy };
  };

  const mintOne = async (): Promise<TxMetric> => {
    return runMetric("mint_step_flow", async () => {
      const mintKp = Keypair.generate();
      const ata = getAssociatedTokenAddressSync(mintKp.publicKey, payer.publicKey);

      await sendTx(
        connection,
        [
          ComputeBudgetProgram.setComputeUnitLimit({ units: CU_LIMIT }),
          SystemProgram.createAccount({
            fromPubkey: payer.publicKey,
            newAccountPubkey: mintKp.publicKey,
            space: 82,
            lamports: await connection.getMinimumBalanceForRentExemption(82),
            programId: TOKEN_PROGRAM_ID,
          }),
          createInitializeMint2Instruction(mintKp.publicKey, 0, payer.publicKey, payer.publicKey, TOKEN_PROGRAM_ID),
        ],
        payer,
        [payer, mintKp],
      );

      await sendTx(
        connection,
        [createAssociatedTokenAccountInstruction(payer.publicKey, ata, payer.publicKey, mintKp.publicKey)],
        payer,
      );
      await sendTx(
        connection,
        [createMintToInstruction(mintKp.publicKey, ata, payer.publicKey, 1, [], TOKEN_PROGRAM_ID)],
        payer,
      );

      const mintUmi = fromWeb3JsPublicKey(mintKp.publicKey);
      const metadataBuilder = createMetadataAccountV3(umi, {
        mint: mintUmi,
        mintAuthority: umi.payer,
        data: {
          name: NFT_NAME,
          symbol: NFT_SYMBOL,
          uri: NFT_URI,
          sellerFeeBasisPoints: 0,
          creators: none(),
          collection: none(),
          uses: none(),
        },
        isMutable: true,
        collectionDetails: none(),
      });
      await sendTx(
        connection,
        toWeb3JsLegacyTransaction((await metadataBuilder.setFeePayer(umi.payer).buildAndSign(umi))).instructions,
        payer,
      );

      const masterEditionBuilder = createMasterEditionV3(umi, {
        mint: mintUmi,
        mintAuthority: umi.payer,
        updateAuthority: umi.payer,
        maxSupply: some(0),
      });
      return sendTx(
        connection,
        toWeb3JsLegacyTransaction((await masterEditionBuilder.setFeePayer(umi.payer).buildAndSign(umi))).instructions,
        payer,
      );
    });
  };

  it(
    "parallel load: 10/50/100 virtual clients for list/buy and mint",
    { timeout: PARALLEL_TEST_TIMEOUT_MS },
    async () => {
      const buyers = await Promise.all(
        Array.from({ length: 110 }, async () => {
          const kp = Keypair.generate();
          await ensureMinBalance(connection, kp.publicKey, 5 * LAMPORTS_PER_SOL);
          return kp;
        }),
      );

      for (const clients of LOAD_LEVELS) {
        const fixtures = await Promise.all(Array.from({ length: clients }, () => createNftFixture()));
        const pairs = await Promise.all(
          fixtures.map((fixture, i) => listAndBuy(fixture, buyers[i % buyers.length]!)),
        );
        const lists = pairs.map((p) => p.list);
        const buys = pairs.map((p) => p.buy);
        runSummaries.push(summarize(`sol_list_parallel_${clients}`, lists));
        runSummaries.push(summarize(`sol_buy_parallel_${clients}`, buys));
        assert.equal(lists.length, clients);
        assert.equal(buys.length, clients);

        const mintRows = await Promise.all(Array.from({ length: clients }, () => mintOne()));
        runSummaries.push(summarize(`sol_mint_parallel_${clients}`, mintRows));
        assert.equal(mintRows.length, clients);

        await writeJsonReport(`solana-parallel-${clients}-${runId}.json`, {
          chain: "solana",
          scenario: "parallel",
          clients,
          runId,
          summaries: runSummaries.slice(-3),
          rows: { lists, buys, mintRows },
        });
      }
    },
  );

  it(
    "burst load: high pressure spikes",
    { timeout: BURST_TEST_TIMEOUT_MS },
    async () => {
      const buyer = Keypair.generate();
      await ensureMinBalance(connection, buyer.publicKey, 50 * LAMPORTS_PER_SOL);

      const rows: TxMetric[] = [];
      for (let burst = 0; burst < BURST_COUNT; burst++) {
        const burstRows = await Promise.all(
          Array.from({ length: BURST_SIZE }, async (_, i) => {
            const mint = await mintOne();
            const fixture = await createNftFixture();
            const { list, buy } = await listAndBuy(fixture, buyer);
            return [list, buy, mint].map((r, idx) => ({ ...r, label: `${r.label}_b${burst}_i${i}_s${idx}` }));
          }),
        );
        const flat = burstRows.flat();
        runSummaries.push(summarize(`sol_burst_${burst}`, flat));
        rows.push(...flat);
        await new Promise((r) => setTimeout(r, BURST_COOLDOWN_MS));
      }

      runSummaries.push(summarize("sol_burst_total", rows));
      await writeJsonReport(`solana-burst-${runId}.json`, {
        chain: "solana",
        scenario: "burst",
        runId,
        config: { BURST_COUNT, BURST_SIZE, BURST_COOLDOWN_MS },
        summaries: runSummaries.filter((s) => s.label.startsWith("sol_burst_")),
        rows,
      });
      assert.equal(rows.length, BURST_COUNT * BURST_SIZE * 3);
    },
  );

  it(
    "burst load: nft minting spikes",
    { timeout: MINT_BURST_TEST_TIMEOUT_MS },
    async () => {
      const rows: TxMetric[] = [];
      const summaries: ScenarioSummary[] = [];

      for (let burst = 0; burst < BURST_COUNT; burst++) {
        const burstRows = await Promise.all(
          Array.from({ length: BURST_SIZE }, async (_, i) => {
            const mint = await mintOne();
            return { ...mint, label: `${mint.label}_mint_b${burst}_i${i}` };
          }),
        );

        summaries.push(summarize(`sol_mint_burst_${burst}`, burstRows));
        rows.push(...burstRows);
        await new Promise((r) => setTimeout(r, BURST_COOLDOWN_MS));
      }

      summaries.push(summarize("sol_mint_burst_total", rows));

      await writeJsonReport(`solana-mint-burst-${runId}.json`, {
        chain: "solana",
        scenario: "mint_burst",
        runId,
        config: { BURST_COUNT, BURST_SIZE, BURST_COOLDOWN_MS },
        summaries,
        rows,
      });

      assert.equal(rows.length, BURST_COUNT * BURST_SIZE);
    },
  );
});
