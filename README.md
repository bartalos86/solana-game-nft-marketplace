# NFT Marketplace DApp Monorepo

This repository contains a full cross-chain marketplace/game stack with Solana and Ethereum implementations for my diploma thesis.

## Repository layout

- `platform-frontend` - main Solana frontend (Next.js)
- `platform-frontend-eth` - main Ethereum frontend (Next.js)
- `sample-game-sol` - sample Solana game client
- `sample-game-eth` - sample Ethereum game client
- `anchor` - Solana on-chain programs (Anchor)
- `eth-project` - Ethereum contracts and deployment scripts (Hardhat)
- `game-sdk` - shared game/minting SDK
- `docs` - diagrams and technical notes

## Prerequisites

To run the application, install the latest Node.js and `pnpm`.

For Solana smart contract development, also install:
- Rust
- Solana CLI
- Anchor CLI

Install `pnpm` globally:

```bash
npm install -g pnpm
```

## Frontend (Solana version)

```bash
cd platform-frontend
pnpm install
pnpm dev
```

Then open the URL shown in the terminal (usually `http://localhost:3000/`).

## Frontend (Ethereum version)

```bash
cd platform-frontend-eth
pnpm install
pnpm dev
```

Then open the URL shown in the terminal (usually `http://localhost:3000/`).

## Game SDK

Build commands:

```bash
cd game-sdk
pnpm install
pnpm build
pnpm build:main
pnpm build:server
pnpm build:eth
```

## Solana blockchain part (Anchor)

Deploy Solana programs:

```bash
cd anchor
pnpm install
anchor build
anchor deploy
```

## Ethereum blockchain part (Hardhat)

Install and prepare:

```bash
cd eth-project
pnpm install
```

If you want to deploy to Sepolia, configure `eth-project/.env`:

```env
SEPOLIA_RPC_URL=
SEPOLIA_PRIVATE_KEY=
```

Deploy:

```bash
cd eth-project
pnpm run deploy:persistent:sepolia
```

After deployment, copy contract addresses to the Ethereum frontend `.env`:

```env
NEXT_PUBLIC_GAME_FACTORY_ADDRESS=
NEXT_PUBLIC_MARKETPLACE_ADDRESS=
```

You can find those addresses in `eth-project/deployments/sepolia.json`.

On Solana, deployment addresses are deterministic and only need to be updated when regenerated. Set them in the Solana frontend `.env`:

```env
NEXT_PUBLIC_GAME_REGISTRY_PROGRAM_ID=
NEXT_PUBLIC_MARKETPLACE_PROGRAM_ID=
```

## Testing mode

Testing is organized by module (there is no single global test switch).

- Solana tests: `anchor`
- Ethereum tests: `eth-project`
- Irys storage tests: `sample-game-sol` and `sample-game-eth`

Examples:

```bash
# Solana tests
cd anchor
pnpm run test:load:local
pnpm run test:devnet

# Ethereum tests
cd eth-project
pnpm run test:local
pnpm run test:sepolia

# Sample game tests
cd sample-game-eth
pnpm run test:irys-cost
```

## User flow

1. Open the main page.
2. Connect a wallet (Solana wallet in Solana frontend, EVM wallet in Ethereum frontend).
3. Open **Register Game**.
4. Fill in game information (name, category, optional image URL, optional game URL, description).
5. Save generated private keys securely (they cannot be recovered).
6. Put these keys into the sample game `.env` files:
   - `sample-game-sol`: `GAME_PRIVATE_KEY`, `GAME_PUBLIC_KEY`
   - `sample-game-eth`: `GAME_ETH_PRIVATE_KEY`, `GAME_ETH_PUBLIC_KEY`, `GAME_FEE_RECIPIENT`
7. For Ethereum game setup, also configure `NEXT_PUBLIC_GAME_FACTORY_ADDRESS`, `NEXT_PUBLIC_CHAIN_ID`, and `NEXT_PUBLIC_RPC_URL`.
8. Start the platform-specific sample game (`sample-game-sol` or `sample-game-eth`) with `pnpm install && pnpm dev`.
9. Submit the form to register the game on-chain, then select it on the **Games** page.
10. Mint an in-game item via **Spin**, inspect it on the platform, then go to **Marketplace** to list, cancel, or buy items.
