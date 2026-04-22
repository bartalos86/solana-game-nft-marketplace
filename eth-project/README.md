# ETH Project (Hardhat Contracts)

This folder contains the Ethereum smart contracts for the marketplace and game flow, plus the test and deployment code around them. It is the core on-chain backend for the Ethereum side of the app.

## Prerequisites

- Node.js 20+
- pnpm
- Sepolia RPC URL and funded account (only for Sepolia tests/deploy)

## Start

```bash
pnpm install
```

Optional for Sepolia:

```bash
cp .env.example .env
```

Then set:
- `SEPOLIA_RPC_URL`
- `SEPOLIA_PRIVATE_KEY`

## Tests

Run local tests:

```bash
pnpm run test:local
```

Run Sepolia integration tests:

```bash
pnpm run test:sepolia
```
