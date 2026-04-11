import {
  GAME_FACTORY_ADDRESS,
  MARKETPLACE_ADDRESS,
  createEthPublicClient,
  gameFactoryAbi,
  gameItemAbi,
  marketplaceAbi,
} from '@/lib/eth-contracts'

/** Response shape from GET /api/games/[address]/marketplace/listings */
export interface MarketplaceListingResponse {
  publicKey: string
  seller: string
  mint: string
  price: string
  priceLamports: string
  expiry: number
  updateAuthorityFeeRecipient: string
  name: string
  description: string
  imageUrl: string
}

export {
  GAME_FACTORY_ADDRESS,
  MARKETPLACE_ADDRESS,
  createEthPublicClient,
  gameFactoryAbi,
  gameItemAbi,
  marketplaceAbi,
}
