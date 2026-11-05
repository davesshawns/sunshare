# SUNSHARE — Peer-to-Peer Energy Exchange on Stellar

[![Stellar Network](https://img.shields.io/badge/Stellar-Testnet-blue.svg)](https://stellar.org)
[![Smart Contracts](https://img.shields.io/badge/Soroban-Rust%2022.0-orange.svg)](https://soroban.stellar.org)
[![Frontend](https://img.shields.io/badge/React%2019-Tailwind%20v4-emerald.svg)](https://react.dev)
[![Backend](https://img.shields.io/badge/Express-TypeScript%20Node%2022-yellow.svg)](https://expressjs.com)
[![Database](https://img.shields.io/badge/PostgreSQL-Row%20Level%20Security-336791.svg)](https://www.postgresql.org)

**SUNSHARE** is an autonomous peer-to-peer renewable energy marketplace built natively on the Stellar blockchain using Soroban smart contracts. Solar owners and residential microgrid prosumers publish surplus energy capacity, allowing local consumers to reserve electricity with funds locked in financial escrow. Payouts are deterministically released upon cryptographic verification of signed smart meter readings, with instant leftover refunds for partial deliveries and automated refunds upon reservation expiry.

---

## ⚡ Core Innovations & Features

### 1. Peer-to-Peer Energy Escrow (Soroban)
- Solar producers publish active energy offers specifying available capacity (kWh), price in native XLM per kWh, delivery time window, grid zone, and smart meter public key.
- Consumers reserve capacity; payments are transferred into smart contract escrow.
- Prevents overselling by decrementing available capacity atomically on-chain.

### 2. Cryptographic Smart Meter Verification (Ed25519)
- Physical or simulated smart meters sign canonical delivery payloads using hardware Ed25519 private keys:
  $$\text{Payload} = \text{SHA256}(\text{reservation\_id} \,||\, \text{kwh\_delivered} \,||\, \text{meter\_timestamp} \,||\, \text{nonce})$$
- The Soroban smart contract validates `env.crypto().ed25519_verify()` against the registered meter public key.
- **Replay Attack Immunity**: Nonces are recorded in persistent contract storage; replaying a past meter reading is rejected with `NonceAlreadyUsed`.

### 3. Proportional Settlement & Automatic Leftover Refund
- When real-world solar generation fluctuates (e.g. cloud cover), the contract calculates:
  - Producer payout: $\text{kwh\_delivered} \times \text{price\_per\_kwh}$
  - Consumer refund: $\text{total\_deposit} - \text{payout}$
- If delivery does not occur before expiry ($window\_end + 1\text{ hour grace period}$), the consumer claims a 100% refund via `refund_expired_reservation`.

### 4. Community Solar & Battery Infrastructure Pools
- Neighborhood microgrids can pool capital for shared battery storage, school solar canopies, or DC fast chargers.
- Funds remain in Soroban escrow until the target funding threshold is met.
- Creators withdraw funds to verified equipment installers upon reaching the goal.

### 5. Verifiable On-Chain Reputation
- Every settled delivery automatically increments the producer's on-chain delivery volume and successful delivery counter.
- Dispute history is transparently queryable directly from the ledger.

---

## 🛠️ Architecture & Monorepo Structure

```
SUNSHARE/
├── contracts/
│   └── sunshare-contract/            # Soroban Rust Smart Contract
│       ├── src/
│       │   ├── lib.rs                # Core contract logic & escrow methods
│       │   ├── types.rs              # Contract data structures & error codes
│       │   ├── events.rs             # Typed Soroban events
│       │   └── test.rs               # 7 comprehensive Rust unit tests
│       └── Cargo.toml
├── server/                           # Express 4 + TypeScript Backend
│   ├── src/
│   │   ├── app.ts                    # Express app & route mounting
│   │   ├── index.ts                  # Server entry point (port 3003)
│   │   ├── config.ts                 # Database & Stellar Testnet config
│   │   ├── db.ts                     # PostgreSQL pool with RLS context
│   │   ├── stellar.ts                # Nonces, Ed25519 verification, Horizon
│   │   ├── auth.ts                   # Challenge-response authentication
│   │   └── routes/                   # REST API routes (offers, meters, pools...)
│   └── test/
│       └── api.test.ts               # 10 comprehensive Vitest API integration tests
├── client/                           # React 19 + Vite + Tailwind CSS v4 Frontend
│   ├── src/
│   │   ├── App.tsx                   # Main application coordinator
│   │   ├── components/
│   │   │   ├── Navbar.tsx            # Testnet indicator, role switcher, wallet
│   │   │   ├── MicrogridVisualizer.tsx # Interactive renewable mesh diagram
│   │   │   ├── ConsumerView.tsx      # Marketplace, escrow reservation, status
│   │   │   ├── ProducerView.tsx      # Offer publishing, PV array stats
│   │   │   ├── CommunityPoolsView.tsx# Joint solar infrastructure funding
│   │   │   ├── SmartMeterModal.tsx   # Explicitly labeled simulator & verifier
│   │   │   └── WalletModal.tsx       # Freighter & instant sandbox demo
│   │   └── lib/
│   │       ├── api.ts                # REST client
│   │       └── stellar.ts            # Freighter integration & formatting
│   └── test/
│       └── client.test.ts            # Frontend unit tests
├── database/
│   ├── migrations/
│   │   ├── 001_initial_schema.sql    # Profiles, offers, reservations, meters...
│   │   └── 002_rls_policies.sql      # Row Level Security policies
│   └── seeds/
│       └── 001_seed_dev.sql          # Sample prosumers, offers, and pools
├── scripts/
│   └── dev.js                        # Simultaneous dev runner (API: 3003, Web: 5175)
└── package.json                      # Monorepo workspaces & test orchestrator
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v20+ (tested on Node v22.23.4)
- **Rust & Cargo**: 1.80+ with `wasm32-unknown-unknown` target
- **PostgreSQL**: 14+ running locally on port 5432
- **Stellar Wallet**: Freighter browser extension (or built-in Instant Sandbox)

### 1. Database Setup
```bash
# Create development and test databases
createdb sunshare
createdb sunshare_test

# Apply migrations
psql -d sunshare -f database/migrations/001_initial_schema.sql
psql -d sunshare -f database/migrations/002_rls_policies.sql
psql -d sunshare_test -f database/migrations/001_initial_schema.sql
psql -d sunshare_test -f database/migrations/002_rls_policies.sql

# Seed initial development data
psql -d sunshare -f database/seeds/001_seed_dev.sql
```

### 2. Run All Tests
Execute the entire test suite across Rust smart contracts, Express backend, and React client:
```bash
npm test
```
Outputs:
- **Rust Contract Tests**: 7 passed
- **Backend API Tests**: 10 passed
- **Frontend Tests**: 4 passed

### 3. Build Production WASM & Frontend
```bash
# Compile Soroban Smart Contract release WASM
npm run build:contract

# Build Server and Client
npm run build
```

### 4. Start Development Servers
```bash
npm run dev
```
- **Web Terminal**: http://localhost:5175
- **Backend API**: http://localhost:3003
- **API Health**: http://localhost:3003/health

---

## 🔒 Security & Verification Guarantees

1. **Deterministic Financial Escrow**: Escrow funds are governed by the Soroban smart contract on Stellar Testnet. The backend API acts solely as a coordination indexer and cannot alter locked funds.
2. **Ed25519 Signature Verification**: Every smart meter delivery reading is cryptographically verified against the registered producer meter key.
3. **Replay Attack Resistance**: Nonces are permanently recorded upon settlement; identical payloads are rejected.
4. **PostgreSQL Row Level Security (RLS)**: Sensitive tables enforce row-level tenant boundaries using `app.current_wallet` session variables.
5. **No Mainnet or Real Key Exposure**: Operates strictly on Stellar Testnet.

---

## 📜 License
MIT License. Built for the Stellar Renewable Microgrid Hackathon.
