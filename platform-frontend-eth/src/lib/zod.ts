import type { ZodError } from 'zod'

/** Returns the first field error message from a Zod validation error. */
export function firstZodMessage(error: ZodError, fallback = 'Invalid input'): string {
  const fieldErrors = error.flatten().fieldErrors
  for (const messages of Object.values(fieldErrors)) {
    const msg = Array.isArray(messages) ? messages[0] : messages
    if (msg) return msg
  }
  return fallback
}
