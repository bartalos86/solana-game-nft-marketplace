#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${PROJECT_DIR}"

if [[ -z "${ANCHOR_WALLET:-}" ]]; then
  export ANCHOR_WALLET="${PROJECT_DIR}/wallet/deployment_wallet"
fi

if [[ -z "${ANCHOR_PROVIDER_URL:-}" ]]; then
  export ANCHOR_PROVIDER_URL="https://api.devnet.solana.com"
fi

echo "Using ANCHOR_WALLET=${ANCHOR_WALLET}"
echo "Using ANCHOR_PROVIDER_URL=${ANCHOR_PROVIDER_URL}"
echo "Running Solana load tests on devnet via vitest..."

anchor test --provider.cluster devnet
