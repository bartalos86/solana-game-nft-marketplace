import { z } from 'zod'

const nonEmptyString = z.string().trim().min(1, 'Required')
const ethAddress = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address')

export const createGameSchema = z.object({
  name: nonEmptyString,
  imageUrl: z.string().trim().optional().transform((v) => v || undefined),
  description: z.string().trim().optional().transform((v) => v || undefined),
  category: nonEmptyString,
  gameUrl: z.string().trim().optional().transform((v) => v || undefined),
  ethereumPublicKey: ethAddress,
})

export type CreateGameInput = z.infer<typeof createGameSchema>

export const gameAddressParamsSchema = z.object({
  address: ethAddress,
})

export type GameAddressParams = z.infer<typeof gameAddressParamsSchema>
