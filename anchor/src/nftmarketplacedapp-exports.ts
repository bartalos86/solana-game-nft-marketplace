// Here we export some useful types and functions for interacting with the Anchor program.
import { address } from 'gill'
import { SolanaClusterId } from '@wallet-ui/react'
import { NFTMARKETPLACEDAPP_PROGRAM_ADDRESS } from './client/js'
import NftmarketplacedappIDL from '../target/idl/nftmarketplacedapp.json'

// Re-export the generated IDL and type
export { NftmarketplacedappIDL }

// This is a helper function to get the program ID for the Nftmarketplacedapp program depending on the cluster.
export function getNftmarketplacedappProgramId(cluster: SolanaClusterId) {
  switch (cluster) {
    case 'solana:devnet':
    case 'solana:testnet':
      // This is the program ID for the Nftmarketplacedapp program on devnet and testnet.
      return address('6z68wfurCMYkZG51s1Et9BJEd9nJGUusjHXNt4dGbNNF')
    case 'solana:mainnet':
    default:
      return NFTMARKETPLACEDAPP_PROGRAM_ADDRESS
  }
}

export * from './client/js'
