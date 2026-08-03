# Changelog

## [0.1.0] - 2026-08-03

### Added
- Initial release of Loomstream
- Soroban smart contract for token streaming and vesting
- `create_stream` — create a new token stream with configurable schedule
- `withdraw` — withdraw vested tokens from a stream
- `cancel` — cancel a cancelable stream and recover unvested funds
- `get_stream` — query stream details by ID
- `withdrawable_amount` — query remaining withdrawable balance
- `set_paused` / `set_admin` — administrative controls
- Read-only backend (Express + Prisma + PostgreSQL)
- Stream indexing from Soroban ledger events
- REST API for listing and querying streams
- Frontend dashboard with stream progress visualization
- Stream creation form with Stellar wallet integration
- Docker Compose for local development
- CI/CD pipeline (GitHub Actions)
- Deployment scripts for testnet