# Level 2 — Upgrade Plan

## Current (Level 1)
- Freighter wallet only
- Send XLM + History
- Static hardcoded contacts (Budi/Sinta/Rian)

## Target (Level 2 — Multi-Wallet + Smart Contract + Real-time)

---

## 1. Multi-Wallet Integration (StellarWalletsKit)

**Ganti** `@stellar/freighter-api` → `@stellar/stellar-wallets-kit`

### Supported wallets:
| Wallet | Deteksi |
|--------|---------|
| Freighter (extension) | Auto |
| Lobstr (extension) | Auto |
| xBull (extension) | Auto |
| WalletConnect (QR — mobile) | Modal scan |

### Flow:
- Klik Connect → modal pilih wallet
- Pilih → popup/scan → dapet publicKey
- Disconnect balik ke initial

### File:
- `src/lib/stellar.ts` — rewrite `checkFreighter` → `checkWallets`, `connectWallet` → `multiConnect`

---

## 2. Error Handling (3 types wajib)

| Error | Where | Handling |
|-------|-------|----------|
| **Wallet not found** | Saat connect — gak ada extension terinstall | Tampil alert "Tidak ada wallet Stellar terdeteksi. Install Freighter / Lobstr / xBull" |
| **User rejected** | Saat send — user batalkan di popup wallet | Toast merah "Transaksi dibatalkan" + reset form |
| **Insufficient balance** | Saat send — balance < amount | Pre-check balance before send + toast "Saldo tidak mencukupi. Tersedia X XLM" |

### Bonus error (>=3):
| **Network mismatch** | Testnet ≠ wallet network | Notif "Ganti wallet ke Testnet" |
| **Invalid address** | Address gak valid Stellar | Validasi regex `G[A-Z0-9]{55}` + error inline |

---

## 3. Smart Contract (Testnet)

### Choose project type:

**Saya rekomendasi: Crowdfunding Page** (paling relevant + real-time progress)
Atau **Payment Tracker** (matching current app flow)

| Project | Complexity | Alasan |
|---------|-----------|--------|
| **Crowdfunding Page** ⭐ | Medium | Donasi dengan target, live progress bar, event streaming |
| Payment Tracker | Low | Cocok karena udah punya payment UI, tinggal tambah multi-address |
| NFT Minter | High | Butuh IPFS metadata, IPFS upload — ribet |
| Token Swap | High | Butuh DEX orderbook logic |
| Live Auction | High | Butuh timer + bid logic |
| Live Poll | Low | Bisa cepet, tapi kurang greget |

### Saran: **Crowdfunding Page** atau **Payment Tracker**

#### Crowdfunding Page — Fitur:
- Deploy contract `campaign` (Solidity-like di Soroban = Rust)
- State: `target`, `collected`, `deadline`, `donors[]`
- Functions:
  - `create_campaign(target, deadline)`
  - `donate(campaign_id)`
  - `get_campaign(campaign_id)`
- Frontend: live progress bar, donor list, real-time via Soroban events

#### Payment Tracker — Fitur:
- Deploy contract `payment_tracker`
- State: `payments[]` indexed by ID
- Functions:
  - `create_payment(from, to, amount, memo)`
  - `mark_completed(payment_id)`
  - `get_payments(address)`
- Frontend: status badges (pending/success/fail), live update

---

## 4. Transaction Status (wajib)

Implement **status state machine**:

```
Pending → (waiting confirmation)
  ↓ user approve
Broadcast → (menunggu ledger)
  ↓ success/fail
Success / Fail
```

### UI:
- Button disable + spinner + "Menunggu konfirmasi..."
- Modal step-by-step: Confirm → Broadcast → Done
- Toast hijau (success) / merah (fail)

---

## 5. Real-time Event Handling

Pakai **Soroban event polling** atau **SSE**:

### Option A (Polling — recommended):
- `setInterval` tiap 3 detik fetch status dari contract
- Update UI tanpa refresh

### Option B (WebSocket):
- Parse `TransactionResponse` events
- Push via EventEmitter

End result:
- Progress bar bergerak sendiri
- Donor list update real-time
- Status badge berubah dari pending → success

---

## 6. README (wajib submission)

```
# Stellar Pay — Level 2

## Setup
npm install
cp .env.example .env
# isi .env (optional untuk custom testnet)

## Run
npm run dev

## Deployed Contract
Network: Testnet
Address: CAXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
Explorer: https://stellar.expert/explorer/testnet/contract/CA...

## Transaction Hash (contract call)
https://stellar.expert/explorer/testnet/tx/HASH...

## Screenshot
![Wallet options](screenshot.png)

## Level 2 Requirements
- [x] Multi-wallet (Freighter + Lobstr + xBull + WalletConnect)
- [x] 3 error types (no wallet, rejected, insufficient)
- [x] Smart contract deployed
- [x] Contract called from frontend
- [x] Transaction status (pending/success/fail)
- [x] Real-time event sync
- [x] 4+ meaningful commits
```

---

## 7. Files Changed Summary

| File | Action |
|------|--------|
| `src/lib/stellar.ts` | Full rewrite — StellarWalletsKit + Soroban SDK |
| `src/lib/contract.ts` | **NEW** — contract functions + event polling |
| `src/app/page.tsx` | Big update — multi-wallet modal, contract UI, status |
| `src/app/globals.css` | Add multi-wallet modal, progress bar, status styles |
| `README.md` | Full write — setup, screenshots, contract info |
| `public/screenshot.png` | **NEW** — wallet options screenshot |
| `package.json` | Add `@stellar/stellar-wallets-kit`, `@stellar/stellar-sdk` |

---

## 8. Commits Plan

1. `feat: integrate StellarWalletsKit — multi-wallet modal + error handling`
2. `feat: deploy crowdfunding contract + frontend integration`
3. `feat: real-time event polling + transaction status tracker`
4. `docs: README with setup, contract address, screenshots`

---

**Pilih project dulu:** Crowdfunding atau Payment Tracker?
Atau mau ganti ide lain?

Setuju dengan plan ini? Gas aku kerjain.
