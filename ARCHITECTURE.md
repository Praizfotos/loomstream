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
GET  /api/streams/:id      — get stream details with events and derived status
GET  /api/streams/:id/events — get events for a stream
GET  /health               — health check
```

### Stream Lifecycle Status

Every stream response carries a server-derived `status` field. The status is **computed off-chain** from the stream's existing on-chain fields (`start_time`, `end_time`, `cliff_time`, `canceled`) and the current time. It is never stored and never re-derived differently by the frontend — the API is the single source of truth for display.

| Status | Condition |
|--------|-----------|
| `UPCOMING` | `now < start_time` |
| `CLIFF` | `now >= start_time` and `cliff_time > start_time` and `now < cliff_time` |
| `ACTIVE` | started, past any cliff, and `now < end_time` |
| `FULLY_VESTED` | `now >= end_time` and not canceled |
| `CANCELED` | `canceled == true` (takes precedence over time-based states) |

Boundary conditions: at exactly `start_time` the stream is considered started; at exactly `cliff_time` the cliff is considered elapsed; at exactly `end_time` the stream is `FULLY_VESTED`. A cliff is only meaningful when `cliff_time > start_time`; otherwise the stream vests immediately and never enters the `CLIFF` state.

The status model and vesting math live in `backend/src/domain/streamStatus.ts`:

- `deriveStreamStatus` — deterministic status derivation from stream fields + current time
- `computeVestedAmount` / `computeStreamAmounts` — display amounts (`vestedAmount`, `withdrawableAmount`, `remainingAmount`) mirroring the contract's vesting formula
- `serializeStream` — converts a Prisma stream row into the API wire format with `status` and amounts

Current time is taken as the request-time Unix timestamp, which tracks Soroban ledger time. The Soroban contract remains the authoritative source for actual balances; these derived fields are a read-only display view.

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
- `/dashboard` — Stream list rendering backend-derived status, vesting progress, withdrawable and remaining amounts
- `/create` — Create stream form with client-side validation and simulation
- `/streams/[id]` — Stream details view with status, progress, balances, schedule, and events

### Components

- `WalletConnect` — Stellar Wallet Kit integration (Freighter)
- `StreamCard` — Displays stream details consuming the backend-provided `status`, progress, and balances
- `StreamStatusBadge` — Visual treatment for each lifecycle status (UPCOMING, CLIFF, ACTIVE, FULLY_VESTED, CANCELED)
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