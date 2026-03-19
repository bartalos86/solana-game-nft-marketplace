import { z } from 'zod'

const nonEmptyString = z.string().trim().min(1, 'Required')

export const createGameSchema = z.object({
  name: nonEmptyString,
  imageUrl: z.string().trim().optional().transform((v) => v || undefined),
  description: z.string().trim().optional().transform((v) => v || undefined),
  category: nonEmptyString,
  gameUrl: z.string().trim().optional().transform((v) => v || undefined),
  solanaPublicKey: nonEmptyString,
  ethereumPublicKey: nonEmptyString,
})

export type CreateGameInput = z.infer<typeof createGameSchema>

export const gameAddressParamsSchema = z.object({
  address: nonEmptyString,
})

export type GameAddressParams = z.infer<typeof gameAddressParamsSchema>
