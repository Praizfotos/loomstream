# Loomstream API Reference

## Base URL

```
http://localhost:3001/api
```

## Streams

### Stream Status

Every stream response includes a derived `status` field. The status is computed server-side from the stream's on-chain timestamps, cancellation state, and the current time. The frontend must not re-derive this value — it consumes what the API returns.

| Status | Meaning |
|--------|---------|
| `UPCOMING` | Current time is before the stream start time |
| `CLIFF` | Stream started, a cliff is configured, and current time has not reached the cliff |
| `ACTIVE` | Stream is currently vesting and has not reached the end time |
| `FULLY_VESTED` | Current time is at or after the end time and the stream has not been canceled |
| `CANCELED` | The stream has been canceled |

A cliff is considered configured when `cliffTime > startTime`. Boundary rules: at exactly `startTime` the stream has started; at exactly `cliffTime` the cliff has elapsed; at exactly `endTime` the stream is `FULLY_VESTED`.

### List Streams

```
GET /api/streams
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `role` | `"sender" \| "recipient"` | — | Filter by role |
| `address` | `string` | — | Filter by address (sender or recipient) |
| `status` | `string` | — | Filter by status. Accepts derived statuses (`UPCOMING`, `CLIFF`, `ACTIVE`, `FULLY_VESTED`, `CANCELED`) plus legacy values (`active`, `canceled`, `completed`) |
| `page` | `integer` | `1` | Page number |
| `limit` | `integer` | `20` | Items per page (max 100) |

**Response:**

```json
{
  "data": [
    {
      "streamId": 1,
      "sender": "GA...",
      "recipient": "GB...",
      "token": "CA...",
      "deposit": "1000",
      "startTime": 1700000000,
      "endTime": 1700086400,
      "cliffTime": 1700000000,
      "cancelable": true,
      "canceled": false,
      "withdrawnAmount": "0",
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z",
      "status": "ACTIVE",
      "vestedAmount": "500",
      "withdrawableAmount": "500",
      "remainingAmount": "1000"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  }
}
```

`vestedAmount`, `withdrawableAmount`, and `remainingAmount` are display amounts derived from the stream's on-chain data and current time using the same vesting math as the contract. `vestedAmount` is the amount vested so far, `withdrawableAmount` is `vestedAmount - withdrawnAmount` (clamped at zero), and `remainingAmount` is `deposit - withdrawnAmount` (clamped at zero). For canceled streams, `withdrawableAmount` and `remainingAmount` are `"0"` because cancellation settles the stream's balances.

### Get Stream

```
GET /api/streams/:id
```

**Response:**

```json
{
  "data": {
    "streamId": 1,
    "sender": "GA...",
    "recipient": "GB...",
    "token": "CA...",
    "deposit": "1000",
    "startTime": 1700000000,
    "endTime": 1700086400,
    "cliffTime": 1700000000,
    "cancelable": true,
    "canceled": false,
    "withdrawnAmount": "0",
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z",
    "status": "ACTIVE",
    "vestedAmount": "500",
    "withdrawableAmount": "500",
    "remainingAmount": "1000",
    "events": []
  }
}
```

### Get Stream Events

```
GET /api/streams/:id/events
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | `integer` | `1` | Page number |
| `limit` | `integer` | `50` | Items per page |

**Response:**

```json
{
  "data": [
    {
      "id": 1,
      "streamId": 1,
      "eventType": "StreamCreated",
      "topics": ["StreamCreated", "1", "GA...", "GB...", "CA..."],
      "data": { "deposit": "1000", "start_time": 1700000000, "end_time": 1700086400, "cliff_time": 1700000000, "cancelable": true },
      "txHash": "0x...",
      "ledgerSeq": 12345,
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 10,
    "pages": 1
  }
}
```

## Health

### Health Check

```
GET /health
```

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```