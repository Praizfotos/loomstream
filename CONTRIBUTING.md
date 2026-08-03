# Contributing to Loomstream

Thank you for your interest in contributing to Loomstream! This document provides guidelines and instructions for contributing.

## Getting Started

### Prerequisites

- Rust 1.96+ with `wasm32-unknown-unknown` target
- Node.js 20+
- PostgreSQL 16
- Soroban CLI (`stellar`)
- Docker & Docker Compose (optional)

### Setup

```bash
git clone https://github.com/your-org/loomstream.git
cd loomstream

# Contract
cd contract && cargo build --target wasm32-unknown-unknown --release

# Backend
cd ../backend && npm ci

# Frontend
cd ../frontend && npm ci
```

## Development Workflow

### Running Tests

```bash
# Contract tests
cd contract && cargo test --features testutils

# Contract clippy
cd contract && cargo clippy --features testutils -- -D warnings

# Backend tests
cd ../backend && npm test

# Backend type check
cd ../backend && npm run typecheck

# Frontend type check
cd ../frontend && npm run typecheck

# Frontend lint
cd ../frontend && npm run lint
```

### Running Locally

```bash
# Start PostgreSQL
docker-compose up -d postgres

# Run backend
cd backend && npm run dev

# Run frontend
cd frontend && npm run dev
```

## Code Style

### Rust

- Follow `rustfmt` formatting (run `cargo fmt`)
- Follow `clippy` lints (run `cargo clippy -- -D warnings`)
- Use `Result` and `Option` types appropriately
- No `unwrap()` in production code — use proper error handling

### TypeScript

- Use `eslint` and `prettier` for formatting
- Run `npm run lint` before committing
- Run `npm run typecheck` before committing
- Use Zod for runtime validation

### Frontend

- Use TypeScript strictly (no `any` types)
- Use Tailwind CSS for styling
- Use shadcn/ui components where applicable
- Ensure accessibility (ARIA labels, keyboard navigation, contrast)

## Submitting Changes

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes
4. Run all tests and linters
5. Commit with a clear, descriptive message
6. Push to your fork
7. Open a Pull Request

### Commit Message Convention

```
<type>(<scope>): <subject>

<body>

<footer>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

## Review Process

- All PRs require at least one review
- PRs must pass all CI checks
- PRs must include tests for new functionality
- PRs must update documentation as needed

## Questions?

Open a GitHub Discussion for questions and ideas.