import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 30_000,
    exclude: ["**/node_modules/**", "**/nftmarketplacedapp.test.ts", "**/marketplace-gas.test.ts"],
  },
})
