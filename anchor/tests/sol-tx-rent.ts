/**
 * Derive SOL / lamport figures from confirmed transaction meta (local validator tests).
 *
 * "Rent" in the narrow sense: lamports deposited into accounts that had 0 balance before
 * the tx (typical for newly allocated program accounts, mints, ATAs, etc.).
 *
 * Balance increases on already-funded accounts also appear in `existingAccountIncreaseLamports`
 * (realloc top-ups, or SOL transfers to prefunded accounts — not always rent).
 */

import type { ConfirmedTransactionMeta, Connection } from "@solana/web3.js"
import { LAMPORTS_PER_SOL } from "@solana/web3.js"

export interface SolTxBalanceBreakdown {
  txFeeLamports: number
  /** preBalance === 0 and postBalance > 0: lamports locked into newly funded accounts (usual rent-exempt deposit). */
  newAccountRentLamports: number
  /** preBalance > 0 and post > pre: top-ups / transfers to existing accounts (not always rent). */
  existingAccountIncreaseLamports: number
}

export function lamportsToSolString(lamports: number): string {
  return (lamports / LAMPORTS_PER_SOL).toFixed(9)
}

export function solTxBalanceBreakdownFromMeta(meta: ConfirmedTransactionMeta): SolTxBalanceBreakdown {
  const pre = meta.preBalances ?? []
  const post = meta.postBalances ?? []
  const n = Math.min(pre.length, post.length)
  let newAccountRentLamports = 0
  let existingAccountIncreaseLamports = 0
  for (let i = 0; i < n; i++) {
    const p = pre[i]!
    const q = post[i]!
    const d = q - p
    if (d <= 0) continue
    if (p === 0) newAccountRentLamports += d
    else existingAccountIncreaseLamports += d
  }
  return {
    txFeeLamports: meta.fee ?? 0,
    newAccountRentLamports,
    existingAccountIncreaseLamports,
  }
}

export async function solTxBalanceBreakdown(
  connection: Connection,
  signature: string,
): Promise<SolTxBalanceBreakdown | null> {
  const info = await connection.getTransaction(signature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  })
  if (!info?.meta) return null
  return solTxBalanceBreakdownFromMeta(info.meta)
}

export function logSolTxBalanceBreakdown(label: string, b: SolTxBalanceBreakdown): void {
  const fee = lamportsToSolString(b.txFeeLamports)
  const rentNew = lamportsToSolString(b.newAccountRentLamports)
  const existInc = lamportsToSolString(b.existingAccountIncreaseLamports)
  console.log(
    `[SOL] ${label}: tx_fee=${fee} SOL | rent_new_accts=${rentNew} SOL | existing_acct_Δ+=${existInc} SOL`,
  )
}
