# Loomstream Architecture

## Overview

Loomstream is a three-tier application:

1. **Smart Contract** (Rust, Soroban SDK) — token streaming and vesting primitive deployed to Stellar Soroban
2. **Backend** (TypeScript, Express, Prisma) — read-only indexing API that polls Soroban RPC and serves data via REST
3. **Frontend** (Next.js 14, Tailwind, shadcn/ui) — dashboard and stream management UI connected via Wallet Kit

## Smart Contract Architecture

### Data Model

```
Stream {
  stream_id: u64          // auto-incrementing primary key
  sender: Address         // who deposited the tokens
  recipient: Address      // who receives vested tokens
  token: Address          // SEP-41 token contract
  deposit: i128           // total tokens deposited
  start_time: u64         // Unix timestamp when vesting begins
  end_time: u64           // Unix timestamp when vesting ends
  cliff_time: u64         // Unix timestamp before which nothing vests
  cancelable: bool        // whether the stream can be canceled
  canceled: bool          // whether the stream has been canceled
  withdrawn_amount: i128  // total tokens already withdrawn
}
```

### Vesting Math

The vested amount at time T is computed as:

```
if T < start_time or T < cliff_time:
  vested = 0
elif T >= end_time:
  vested = deposit
else:
  vested = deposit * (T - cliff_time) / (end_time - cliff_time)
```

Withdrawable = vested - withdrawn_amount

### State Machine

```
[Active] ──withdraw──▶ [Active]
  │                       │
  │                       ├──cancel──▶ [Canceled]
  │                       │
  └──(time passes)────────┘
                          │
                          ▼
                    [Completed] (implicit: end_time reached, fully vested)
```

### Storage Layout

- **Instance storage**: `admin`, `paused`, `next_stream_id`
- **Persistent storage**: `Map<u64, Stream>` keyed by stream_id
- TTL is bumped on every contract touch

### Events

| Event | Topics | Data |
|-------|--------|------|
| `StreamCreated` | stream_id, sender, recipient, token | deposit, start_time, end_time, cliff_time, cancelable |
| `StreamWithdraw` | stream_id, caller, recipient | amount |
| `StreamCanceled` | stream_id, sender, recipient | vested_amount, unvested_amount |

### Pause Circuit Breaker

- Admin can toggle `paused` state
- When paused, `create_stream` rejects new streams
- `withdraw` and `cancel` continue to work (funds already committed must never be freezable)

## Backend Architecture

### Indexer

The indexer is a standalone worker process that:

1. Polls Soroban RPC `getEvents` endpoint
2. Decodes events using `scValToNative`
3. Upserts stream records and stream events into PostgreSQL
4. Maintains an `indexer_cursor` table for idempotent reprocessing

### REST API

```
GET  /api/streams          — list streams (filter by role/address/status, paginated)
GET  /api/streams/:id      — get stream details with events
GET  /api/streams/:id/events — get events for a stream
GET  /health               — health check
```

### Database Schema

```sql
streams (
  stream_id    INTEGER PRIMARY KEY,
  sender       TEXT NOT NULL,
  recipient    TEXT NOT NULL,
  token        TEXT NOT NULL,
  deposit      BIGINT NOT NULL,
  start_time   BIGINT NOT NULL,
  end_time     BIGINT NOT NULL,
  cliff_time   BIGINT NOT NULL,
  cancelable   BOOLEAN NOT NULL,
  canceled     BOOLEAN DEFAULT FALSE,
  withdrawn_amount BIGINT DEFAULT 0
)

stream_events (
  id           SERIAL PRIMARY KEY,
  stream_id    INTEGER REFERENCES streams(stream_id),
  event_type   TEXT NOT NULL,
  topics       TEXT[] NOT NULL,
  data         JSONB NOT NULL,
  tx_hash      TEXT NOT NULL,
  ledger_seq   INTEGER NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
)

indexer_cursor (
  id           TEXT PRIMARY KEY,
  cursor       TEXT NOT NULL,
  updated_at   TIMESTAMPTZ DEFAULT NOW()
)
```

## Frontend Architecture

### Pages

- `/` — Landing page with links to dashboard and create stream
- `/dashboard` — Stream list with real-time withdrawable amounts, progress bars, cliff indicators
- `/create` — Create stream form with client-side validation and simulation

### Components

- `WalletConnect` — Stellar Wallet Kit integration (Freighter)
- `StreamCard` — Displays stream details, progress bar, actions
- `CreateStreamForm` — Form with Zod validation, simulation before signing
- `WithdrawDialog` — Withdraw flow with loading/error/success states
- `CancelDialog` — Cancel flow with confirmation

### Security Model

- All transaction building and signing happens client-side via the connected wallet
- The frontend never sends a private key or signs on the user's behalf server-side
- The backend is read-only and never holds private keys

## DevOps

### Docker Compose Services

- `postgres` — PostgreSQL 16 for backend data
- `backend` — Express API server
- `indexer` — Event indexer worker
- `frontend` — Next.js production server

### CI/CD

GitHub Actions runs:
1. Contract: `cargo test`, `cargo clippy`, WASM build
2. Backend: `tsc`, `eslint`, `jest`
3. Frontend: `next build`, `eslint`, `tsc`
4. Docker image build