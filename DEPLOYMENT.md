# Deployment Guide

## Prerequisites

- Soroban CLI installed and configured
- PostgreSQL 16
- Docker & Docker Compose (for production)
- A funded Soroban account for deployment

## Testnet Deployment

### 1. Build the contract

```bash
cd contract
cargo build --target wasm32-unknown-unknown --release
```

### 2. Deploy to Testnet

```bash
export ADMIN_ADDRESS=GA...your_admin_address
chmod +x scripts/deploy-testnet.sh
./scripts/deploy-testnet.sh
```

This will:
1. Build the WASM
2. Deploy the contract to Testnet
3. Write the contract ID to `deployments/testnet.json`
4. Initialize the contract with the admin address

### 3. Set up the database

```bash
cd backend
cp .env.example .env
# Edit .env with your DATABASE_URL and CONTRACT_ID
npx prisma migrate deploy
```

### 4. Start the backend

```bash
npm run dev
```

### 5. Start the frontend

```bash
cd frontend
npm run dev
```

## Mainnet Deployment

### 1. Build the contract

```bash
cd contract
cargo build --target wasm32-unknown-unknown --release
```

### 2. Deploy to Mainnet

```bash
export SOROBAN_RPC_URL=https://soroban.stellar.org:443
export NETWORK_PASSPHRASE="Public Global Stellar Network ; September 2015"
export ADMIN_ADDRESS=GA...your_admin_address

./scripts/deploy-testnet.sh
```

### 3. Set up the database

```bash
cd backend
# Use a production DATABASE_URL
npx prisma migrate deploy
```

### 4. Start with Docker Compose

```bash
docker-compose up -d
```

## Environment Variables

### Backend

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `PORT` | Server port (default: 3001) | No |
| `LOG_LEVEL` | Log level (default: info) | No |
| `NODE_ENV` | Environment (default: development) | No |

### Indexer

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `SOROBAN_RPC_URL` | Soroban RPC endpoint | Yes |
| `CONTRACT_ID` | Deployed contract ID | Yes |
| `LOG_LEVEL` | Log level (default: info) | No |

### Frontend

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_API_URL` | Backend API URL | Yes |

## Production Considerations

1. **Database**: Use a managed PostgreSQL instance with automated backups
2. **RPC**: Use a reliable Soroban RPC provider with high availability
3. **Monitoring**: Set up alerting for the indexer worker and API health
4. **Scaling**: The backend is stateless and can be horizontally scaled
5. **Indexer**: Run multiple indexer workers for high availability (use a distributed lock)
6. **TLS**: Terminate TLS at the reverse proxy level