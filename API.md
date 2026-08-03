# Loomstream API Reference

## Base URL

```
http://localhost:3001/api
```

## Streams

### List Streams

```
GET /api/streams
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `role` | `"sender" \| "recipient"` | — | Filter by role |
| `address` | `string` | — | Filter by address (sender or recipient) |
| `status` | `"active" \| "canceled" \| "completed"` | — | Filter by status |
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
      "updatedAt": "2024-01-01T00:00:00Z"
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
    "updatedAt": "2024-01-01T00:00:00Z"
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