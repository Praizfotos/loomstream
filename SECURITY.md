# Security Policy

## Custody Model

Loomstream operates as a **custodial vesting contract**. When a stream is created:

1. The sender authorizes the contract to pull tokens via SEP-41 `transfer_from`
2. Tokens are held in the contract's custody
3. Vested tokens are released to the recipient on `withdraw`
4. On cancellation, vested-but-unwithdrawn tokens go to the recipient and unvested tokens return to the sender

### Key Security Properties

- **Funds are never freezable by an admin**: The `set_paused` circuit breaker only blocks new stream creation. It does not affect withdrawal or cancellation of streams already created. Funds already committed to a recipient must always be accessible.
- **No admin key escalation**: The admin can only set paused state and transfer admin role. The admin cannot move funds, alter stream terms, or modify vesting schedules.
- **Time-locked vesting**: All vesting calculations use `env.ledger().timestamp()`, which is provided by the Soroban host and cannot be manipulated by contract callers.
- **Cliff enforcement**: No tokens vest before the cliff time, regardless of when the stream was created.

## Audit Status

Loomstream is currently **not audited**. As a production-ready primitive, we recommend:

1. A formal smart contract audit by a reputable firm before mainnet deployment
2. Bug bounty program via responsible disclosure
3. Testnet usage and community review before mainnet adoption

## Responsible Disclosure

If you discover a security vulnerability, please report it responsibly:

1. **Do not** open a public GitHub issue
2. Email the maintainers at the address in the repository
3. Include a detailed description of the vulnerability, reproduction steps, and potential impact
4. We will acknowledge receipt within 48 hours and work with you to resolve the issue

We follow the [CERT/CC Vulnerability Disclosure Guidelines](https://www.cert.org/vulnerability-disclosure/).

## Threat Model

### Attacker: Malicious Sender
- **Can**: Create streams with any parameters, cancel their own cancelable streams
- **Cannot**: Withdraw tokens from other people's streams, alter vesting schedules after creation

### Attacker: Malicious Recipient
- **Can**: Withdraw vested tokens from their streams
- **Cannot**: Create streams, cancel streams, withdraw more than vested

### Attacker: Compromised Admin
- **Can**: Pause new stream creation, transfer admin role
- **Cannot**: Access funds in existing streams, alter stream terms, prevent withdrawals

### Attacker: Network-Level
- **Can**: Observe transactions and events on the public Stellar ledger
- **Cannot**: Forge Soroban transactions without valid signatures, manipulate ledger timestamp

## Dependency Security

- All dependencies are audited via `cargo audit` in CI
- The contract uses only `soroban-sdk` as an external dependency
- The backend uses well-maintained, widely-used packages (Express, Prisma, Zod)
- The frontend uses Next.js, React, and Tailwind CSS with regular dependency updates