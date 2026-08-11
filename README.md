# Loomstream

Production-grade, generic, reusable token streaming and vesting primitive for Stellar Soroban.

Loomstream provides the canonical, audited building block for linear token release — comparable in role to Sablier on Ethereum. DAOs, grant programs, token launches, and payroll platforms compose against Loomstream instead of reimplementing vesting logic ad hoc.

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Frontend   │────▶│  Backend (API)   │────▶│  PostgreSQL     │
│  Next.js 14 │     │  Express + Prisma│     │  (indexed data) │
└─────────────┘     └──────────────────┘     └─────────────────┘
      │                      │
      │              ┌───────┴────────┐
      │              │  Indexer Worker│
      │              │  (polls RPC)   │
      │              └───────┬────────┘
      │                      │
      ▼                      ▼
┌──────────────────────────────────────────┐
│           Soroban Testnet / Mainnet      │
│  ┌────────────────────────────────────┐  │
│  │     Loomstream Contract            │  │
│  │  (Rust, soroban-sdk 21.x)         │  │
│  │  - create_stream                  │  │
│  │  - withdraw                       │  │
│  │  - cancel                         │  │
│  │  - get_stream / withdrawable      │  │
│  │  - set_paused / set_admin         │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

## Quickstart

### Prerequisites

- Rust 1.96+ with `wasm32-unknown-unknown` target
- Soroban CLI (`stellar`)
- Node.js 20+
- PostgreSQL 16
- Docker & Docker Compose (optional)

### 1. Clone and install

```bash
git clone <repo-url>
cd loomstream

# Install contract dependencies
cd contract && cargo build --target wasm32-unknown-unknown --release

# Install backend dependencies
cd ../backend && npm ci

# Install frontend dependencies
cd ../frontend && npm ci
```

### 2. Start local infrastructure

```bash
cd ..
docker-compose up -d postgres
```

### 3. Deploy contract to Testnet

```bash
export ADMIN_ADDRESS=GA...your_admin_address
chmod +x scripts/deploy-testnet.sh
./scripts/deploy-testnet.sh
```

### 4. Run backend

```bash
cd backend
cp .env.example .env
# Edit .env with your CONTRACT_ID and DATABASE_URL
npm run dev
```

### 5. Run frontend

```bash
cd frontend
npm run dev
```

Open `http://localhost:3000`.

## Contract API

| Function | Parameters | Description |
|----------|-----------|-------------|
| `initialize` | `admin: Address` | Set the contract admin (call once) |
| `create_stream` | `sender, recipient, token, deposit, start_time, end_time, cliff_time, cancelable` | Create a new vesting stream; pulls tokens via SEP-41 |
| `withdraw` | `stream_id, caller, amount` | Withdraw vested tokens; callable by sender or recipient |
| `cancel` | `stream_id, caller` | Cancel a cancelable stream; pays vested to recipient, refunds unvested to sender |
| `get_stream` | `stream_id` | Get full stream details |
| `withdrawable_amount` | `stream_id` | Get currently withdrawable amount |
| `set_paused` | `paused: bool` | Toggle pause circuit breaker (admin only) |
| `set_admin` | `new_admin: Address` | Transfer admin role (admin only) |

## Key Design Decisions

- **Custody model**: The contract holds tokens in custody. Tokens are pulled from the sender on stream creation and released to the recipient on withdrawal. Funds are never freezable by an admin — the pause circuit breaker only blocks new stream creation.
- **Vesting math**: Linear vesting with configurable cliff. Balance is derived from `env.ledger().timestamp()`, never caller-supplied time.
- **Stream status**: Every stream API response includes a server-derived `status` (`UPCOMING`, `CLIFF`, `ACTIVE`, `FULLY_VESTED`, or `CANCELED`) computed from the stream's on-chain timestamps, cancellation state, and current time. The frontend consumes this status from the API rather than re-deriving it. See [ARCHITECTURE.md](ARCHITECTURE.md) and [API.md](API.md) for the derivation rules and wire format.
- **Events**: `StreamCreated`, `StreamWithdraw`, `StreamCanceled` with indexed topics for off-chain indexing.
- **TTL**: Persistent storage with TTL bump on every touch.

## License

MIT

## Security

See [SECURITY.md](SECURITY.md) for the custody model, audit status, and responsible disclosure policy.