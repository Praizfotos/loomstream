#!/usr/bin/env bash
set -euo pipefail

CONTRACT_DIR="$(cd "$(dirname "$0")/.." && pwd)/contract"
DEPLOYMENTS_DIR="$(cd "$(dirname "$0")/.." && pwd)/deployments"
TESTNET_RPC="${SOROBAN_RPC_URL:-https://soroban-testnet.stellar.org:443}"
NETWORK_PASSPHRASE="Test SDF Network ; September 2015"

echo "=== Loomstream Testnet Deploy ==="

# Build WASM
echo "Building WASM..."
cd "$CONTRACT_DIR"
cargo build --target wasm32-unknown-unknown --release
WASM_PATH="$CONTRACT_DIR/target/wasm32-unknown-unknown/release/loomstream.wasm"

if [ ! -f "$WASM_PATH" ]; then
  echo "ERROR: WASM file not found at $WASM_PATH"
  exit 1
fi

echo "WASM built successfully: $WASM_PATH"

# Deploy contract
echo "Deploying to Testnet..."
cd "$CONTRACT_DIR"
soroban contract deploy \
  --wasm "$WASM_PATH" \
  --rpc-url "$TESTNET_RPC" \
  --network-passphrase "$NETWORK_PASSPHRASE"

CONTRACT_ID=$(soroban contract deploy \
  --wasm "$WASM_PATH" \
  --rpc-url "$TESTNET_RPC" \
  --network-passphrase "$NETWORK_PASSPHRASE" 2>&1 | tail -1)

echo "Contract deployed with ID: $CONTRACT_ID"

# Write deployment info
mkdir -p "$DEPLOYMENTS_DIR"
cat > "$DEPLOYMENTS_DIR/testnet.json" <<EOF
{
  "network": "testnet",
  "contractId": "$CONTRACT_ID",
  "rpcUrl": "$TESTNET_RPC",
  "networkPassphrase": "$NETWORK_PASSPHRASE",
  "wasmPath": "$WASM_PATH",
  "deployedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

echo "Deployment info written to $DEPLOYMENTS_DIR/testnet.json"

# Initialize contract with admin
echo "Initializing contract..."
ADMIN_ADDRESS="${ADMIN_ADDRESS:-}"
if [ -z "$ADMIN_ADDRESS" ]; then
  echo "ERROR: ADMIN_ADDRESS environment variable must be set"
  exit 1
fi

soroban contract invoke \
  --id "$CONTRACT_ID" \
  --rpc-url "$TESTNET_RPC" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --source "$ADMIN_ADDRESS" \
  -- \
  initialize \
  --admin "$ADMIN_ADDRESS"

echo "Contract initialized with admin: $ADMIN_ADDRESS"
echo "=== Deploy complete ==="