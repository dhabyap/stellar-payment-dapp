# Stellar Pay — Level 2 (Payment Tracker)

Multi-wallet dApp + Soroban smart contract + real-time status tracking.

## Level 2 Requirements

- [x] **Multi-wallet** — Freighter + Lobstr + xBull (WalletConnect planned)
- [x] **3+ error types** — Wallet not found, user rejected, insufficient balance, invalid address
- [x] **Smart contract deployed** — Payment Tracker on Testnet
- [x] **Contract called from frontend** — `create_payment`, `get_payments_by_sender`
- [x] **Transaction status visible** — Pending → Broadcasting → Confirmed/Failed
- [x] **Real-time event sync** — Polling every 5s for status updates
- [x] **4+ meaningful commits** — See git log

## Features

| Feature | Status |
|---------|--------|
| Connect/Disconnect multiple wallets (Freighter, Lobstr, xBull) | ✅ |
| View XLM Balance (Testnet) | ✅ |
| Send XLM + record on Soroban contract | ✅ |
| On-chain payment status tracking (Pending/Completed/Failed) | ✅ |
| Real-time polling for status updates | ✅ |
| Transaction progress (Signing → Broadcasting → Confirmed) | ✅ |
| Contact book with localStorage persistence | ✅ |
| Save contact after first transaction | ✅ |
| History filter (All/Sent/Received) | ✅ |
| Wallet Connect QR (mobile) | ⏳ Planned |

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Styling**: Custom CSS (dark theme, Space Grotesk)
- **SDK**: @stellar/stellar-sdk v12, @creit.tech/stellar-wallets-kit v2.5
- **Contract**: Soroban (Rust) — `payment_tracker`

## Deployed Contract

| Field | Value |
|-------|-------|
| **Network** | Testnet |
| **Address** | `CBGPGATQZO74UKFKOFJ5N7FRQGY3DSQQ6DB32B2NG6IATX6QNE4M5VHE` |
| **Explorer** | [View on stellar.expert](https://stellar.expert/explorer/testnet/contract/CBGPGATQZO74UKFKOFJ5N7FRQGY3DSQQ6DB32B2NG6IATX6QNE4M5VHE) |

## Transaction Hash (contract deploy)

```
24c07449b5dc72f96aba568ce62626a0b7332af508a31967ae2da166791bffe8
8c67a5e8bb6358fe5ac8c930704332d9c4d2e6ee524af9ba670f2b0d332ea005
```

## Smart Contract Functions

| Function | Description |
|----------|-------------|
| `initialize()` | Initialize contract |
| `create_payment(sender, receiver, amount, memo)` → `u64` | Record new payment on-chain |
| `mark_completed(id, caller)` | Mark payment as completed |
| `mark_failed(id, caller)` | Mark payment as failed |
| `get_payment(id)` → `Payment` | Get single payment record |
| `get_payments_by_sender(sender)` → `Vec<Payment>` | Get all payments for sender |
| `total_payments()` → `u64` | Get total payment count |

## Error Handling

- **Wallet not found** — Detected via `checkWallets()`, UI shows disabled wallet items
- **User rejected** — Catches `WalletError` code `rejected`, shows toast + resets form
- **Insufficient balance** — Pre-check before send + error banner
- **Invalid address** — Regex validation (`G[A-Z0-9]{55}`) before submit
- **Network mismatch** — Error logged when wallet on different network

## Setup

```bash
# Install dependencies
npm install

# Run dev
npm run dev

# Build
npm run build
```

## Prerequisites

- Chrome/Brave/Firefox with Freighter, Lobstr, or xBull extension
- Wallet set to **Testnet** network
- Testnet XLM (use [Friendbot](https://friendbot.stellar.org) to fund account)

## Screenshots

*Add screenshots: wallet modal, send flow, history with status badges*

## Project Structure

```
stellar-payment-dapp/
├── contracts/
│   └── payment-tracker/     # Soroban Rust contract
│       ├── src/
│       │   ├── lib.rs       # Contract logic
│       │   └── test.rs      # Unit tests
│       └── Cargo.toml
├── src/
│   ├── app/
│   │   ├── page.tsx         # Main UI
│   │   └── globals.css      # Styles
│   ├── lib/
│   │   ├── stellar.ts       # Wallet kit + XLM transactions
│   │   └── contract.ts      # Soroban contract integration
│   └── types/
│       └── stellar-kit.d.ts # Type declarations
└── README.md
```
