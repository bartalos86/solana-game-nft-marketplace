'use client'

import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface PutOnSaleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  itemName: string
  onConfirm: (priceEth: string, expiryDays: number) => Promise<void>
}

const DEFAULT_EXPIRY_DAYS = 7
const MIN_PRICE = 0.001

export function PutOnSaleDialog({
  open,
  onOpenChange,
  itemName,
  onConfirm,
}: PutOnSaleDialogProps) {
  const [priceEth, setPriceEth] = useState('')
  const [expiryDays, setExpiryDays] = useState(DEFAULT_EXPIRY_DAYS)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const num = parseFloat(priceEth)
    if (Number.isNaN(num) || num < MIN_PRICE) {
      setError(`Minimum price is ${MIN_PRICE} ETH`)
      return
    }
    if (expiryDays < 1 || expiryDays > 365) {
      setError('Expiry must be between 1 and 365 days')
      return
    }
    setLoading(true)
    try {
      await onConfirm(priceEth, expiryDays)
      onOpenChange(false)
      setPriceEth('')
      setExpiryDays(DEFAULT_EXPIRY_DAYS)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to list item')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/10 bg-zinc-900/95 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">Put on sale</DialogTitle>
          <DialogDescription className="text-white/60">
            List &quot;{itemName}&quot; on the marketplace. You can cancel the listing later.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="price" className="mb-1.5 block text-sm font-medium text-white/80">
              Price (ETH)
            </label>
            <input
              id="price"
              type="text"
              inputMode="decimal"
              placeholder="0.1"
              value={priceEth}
              onChange={(e) => setPriceEth(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-white placeholder:text-white/30 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
            />
          </div>
          <div>
            <label htmlFor="expiry" className="mb-1.5 block text-sm font-medium text-white/80">
              Listing expires in (days)
            </label>
            <input
              id="expiry"
              type="number"
              min={1}
              max={365}
              value={expiryDays}
              onChange={(e) => setExpiryDays(parseInt(e.target.value, 10) || 1)}
              className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-white focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
            />
          </div>
          {error && (
            <p className="text-sm text-red-400" role="alert">
              {error}
            </p>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/80 hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {loading ? 'Listing…' : 'List item'}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
