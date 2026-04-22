# Anchor Programs (Solana)

This is the Solana on-chain workspace for the project, implemented with Anchor. It contains the marketplace and game registry programs that the Solana apps and SDKs interact with.

## Prerequisites

- Rust toolchain
- Solana CLI
- Anchor CLI
- Node.js 20+
- Yarn

## Start

```bash
yarn install
anchor build
```

To run a local validator with programs deployed:

```bash
anchor localnet
```

## Tests

Run local tests:

```bash
yarn run test:load:local
```

Run tests against devnet:

```bash
yarn run test:devnet
```
