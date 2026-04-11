'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { Copy, Check, KeyRound, AlertTriangle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { registerGameOnChainAction } from '@/app/actions/games'
import { firstZodMessage } from '@/lib/zod'
import { cn } from '@/lib/utils'
import { createGameSchema, type CreateGameInput } from '@/lib/validations/games'

const CATEGORIES = ['Action', 'RPG', 'Strategy', 'Racing', 'Adventure', 'Other'] as const

export interface GeneratedKeys {
  ethereumPublicKey: string
  ethereumPrivateKey: string
}

function generateKeypairs(): GeneratedKeys {
  const ethKey = generatePrivateKey()
  const ethAccount = privateKeyToAccount(ethKey)
  return {
    ethereumPublicKey: ethAccount.address,
    ethereumPrivateKey: ethKey,
  }
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/5 text-white/50 transition hover:border-white/20 hover:bg-white/10 hover:text-white/90"
      title="Copy"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  )
}

function KeyRow({
  label,
  value,
  isPrivate,
}: {
  label: string
  value: string
  isPrivate: boolean
}) {
  const [revealed, setRevealed] = useState(!isPrivate)

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-blue-200/80">{label}</span>
          {isPrivate && (
            <span className="rounded-sm bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-300/90">
              Private
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {isPrivate && (
            <button
              type="button"
              onClick={() => setRevealed((v) => !v)}
              className="flex h-7 items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 text-[11px] text-white/50 transition hover:border-white/20 hover:bg-white/10 hover:text-white/80"
            >
              {revealed ? (
                <>
                  <ChevronUp className="h-3 w-3" /> Hide
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3" /> Reveal
                </>
              )}
            </button>
          )}
          <CopyButton value={value} />
        </div>
      </div>
      <div className="relative rounded-lg border border-white/10 bg-black/20">
        <p
          className={cn(
            'break-all px-3 py-2 font-mono text-xs text-white/80',
            isPrivate && !revealed && 'select-none blur-sm'
          )}
        >
          {value}
        </p>
      </div>
    </div>
  )
}

export default function RegisterGamePage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [gameUrl, setGameUrl] = useState('')
  const [keys, setKeys] = useState<GeneratedKeys>(() => generateKeypairs())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const handleRegenerateKeys = useCallback(() => {
    if (window.confirm('Regenerate keys? Your current private keys will be lost — make sure you have saved them.')) {
      setKeys(generateKeypairs())
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const payload: CreateGameInput = {
      name: name.trim(),
      imageUrl: imageUrl.trim() || undefined,
      description: description.trim() || undefined,
      category: category.trim(),
      gameUrl: gameUrl.trim() || undefined,
      ethereumPublicKey: keys.ethereumPublicKey,
    }
    const parsed = createGameSchema.safeParse(payload)
    if (!parsed.success) {
      setError(firstZodMessage(parsed.error))
      return
    }

    setLoading(true)
    try {
      const regResult = await registerGameOnChainAction({
        name: parsed.data.name,
        description: parsed.data.description ?? undefined,
        imageUrl: parsed.data.imageUrl ?? undefined,
        uri: parsed.data.gameUrl ?? undefined,
        category: parsed.data.category,
        authorityAddress: parsed.data.ethereumPublicKey as `0x${string}`,
      })
      if (regResult.error) {
        setError(regResult.error)
        return
      }

      router.push(`/games/${keys.ethereumPublicKey}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full min-h-screen pt-28 pb-16 px-4">
      <div className="mx-auto max-w-2xl">

        {/* Page header */}
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1.5 text-sm text-blue-300">
            <KeyRound className="h-3.5 w-3.5" />
            Game Registration
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Register a Game
          </h1>
          <p className="mt-3 text-base text-blue-100/60">
            Fill in your game details below. Keypairs are generated automatically — only public keys are stored on the server.
          </p>
        </div>

        <form onSubmit={(e) => handleSubmit(e as React.FormEvent)} className="space-y-5">

          {/* Game details card */}
          <div className="rounded-2xl border border-white/10 bg-white/4 p-6 backdrop-blur-xl">
            <h2 className="mb-5 text-sm font-semibold uppercase tracking-wider text-white/40">
              Game Details
            </h2>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-sm text-white/70">
                  Game name <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My Awesome Game"
                  className="border-white/10 bg-black/20 text-white placeholder:text-white/30 focus-visible:border-blue-500/50 focus-visible:ring-blue-500/20"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="imageUrl" className="text-sm text-white/70">
                  Cover image URL
                </Label>
                <Input
                  id="imageUrl"
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://..."
                  className="border-white/10 bg-black/20 text-white placeholder:text-white/30 focus-visible:border-blue-500/50 focus-visible:ring-blue-500/20"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="gameUrl" className="text-sm text-white/70">
                  Game URL
                </Label>
                <Input
                  id="gameUrl"
                  type="url"
                  value={gameUrl}
                  onChange={(e) => setGameUrl(e.target.value)}
                  placeholder="https://mygame.com"
                  className="border-white/10 bg-black/20 text-white placeholder:text-white/30 focus-visible:border-blue-500/50 focus-visible:ring-blue-500/20"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="description" className="text-sm text-white/70">
                  Description
                </Label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Short description of your game..."
                  rows={3}
                  className="w-full resize-none rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="category" className="text-sm text-white/70">
                  Category <span className="text-red-400">*</span>
                </Label>
                <select
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  required
                >
                  <option value="" className="bg-slate-900">Select category</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c} className="bg-slate-900">{c}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Keys card */}
          <div className="rounded-2xl border border-blue-500/20 bg-blue-950/20 p-6 backdrop-blur-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-white/40">
                  Generated Keypairs
                </h2>
                <p className="mt-0.5 text-xs text-blue-200/50">
                  Auto-generated on page load. Only public keys are sent to the server.
                </p>
              </div>
              <button
                type="button"
                onClick={handleRegenerateKeys}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/60 transition hover:border-white/20 hover:bg-white/10 hover:text-white/90"
                title="Generate new keypairs"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Regenerate
              </button>
            </div>

            {/* Warning */}
            <div className="mb-4 flex gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400/80" />
              <p className="text-xs leading-relaxed text-amber-200/70">
                Save your private keys securely before submitting. They will not be stored on the server and cannot be recovered.
              </p>
            </div>

            <div className="rounded-xl border border-white/7 bg-black/10 p-4">
              <div className="mb-3 flex items-center gap-2">
                <div className="h-5 w-5 rounded-full bg-linear-to-br from-blue-400 to-cyan-500 p-0.5">
                  <div className="h-full w-full rounded-full bg-black/30" />
                </div>
                <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">Ethereum</span>
              </div>
              <div className="space-y-3">
                <KeyRow label="Public address" value={keys.ethereumPublicKey} isPrivate={false} />
                <KeyRow label="Private key (hex)" value={keys.ethereumPrivateKey} isPrivate />
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-linear-to-r from-blue-600 to-indigo-600 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:from-blue-500 hover:to-indigo-500 hover:shadow-blue-500/30 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Registering…
              </span>
            ) : (
              'Register Game'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
