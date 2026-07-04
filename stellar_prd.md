# PRD — Stellar Simple Payment dApp (Testnet)

## 1. Product Overview

### Product Name
Stellar Simple Payment dApp

### Purpose
Aplikasi web sederhana yang memungkinkan pengguna:
- Menghubungkan wallet Freighter
- Melihat saldo XLM di Stellar Testnet
- Mengirim XLM ke alamat lain
- Melihat status transaksi secara real-time

### Problem Statement
Pengguna pemula Stellar membutuhkan cara mudah untuk:
- Mengakses wallet testnet
- Mengecek saldo
- Melakukan transaksi tanpa kompleksitas CLI atau tooling blockchain

---

## 2. Goals & Objectives

### Primary Goals
- Integrasi wallet Freighter berhasil
- Menampilkan balance XLM dengan akurat
- Berhasil melakukan transaksi XLM di testnet
- Menampilkan feedback transaksi (success/failure + TX hash)

### Success Metrics
- Wallet connect success rate ≥ 95%
- Transaction submission success ≥ 90% (testnet)
- UI usable tanpa error blocking
- Semua requirement hackathon terpenuhi

---

## 3. Target Users

- Developer pemula Stellar
- Hackathon participant
- Web3 beginner user
- Tester/testnet user

---

## 4. Features

## 4.1 Wallet Connection

### Description
User dapat connect dan disconnect Freighter wallet.

### Requirements
- Detect Freighter extension
- Request wallet access
- Store public key
- Disconnect wallet reset state

### Acceptance Criteria
- Wallet connected shows public address
- Button toggle: Connect / Disconnect
- Handle "wallet not installed" error

---

## 4.2 Balance Display

### Description
Menampilkan saldo XLM dari wallet yang terhubung.

### Requirements
- Fetch balance dari Stellar Testnet Horizon API
- Format balance readable (XLM)
- Auto refresh after transaction

### Acceptance Criteria
- Balance tampil setelah wallet connect
- Balance update setelah transaksi sukses

---

## 4.3 Transaction System

### Description
User dapat mengirim XLM ke address lain di testnet.

### Requirements
- Input:
  - Destination address
  - Amount XLM
- Build Stellar transaction
- Sign via Freighter
- Submit to Stellar testnet network
- Return TX result

### Acceptance Criteria
- Transaction success returns TX hash
- Transaction failure shows error message
- Invalid input blocked (empty, invalid address, 0 amount)

---

## 4.4 Transaction Feedback UI

### Description
Menampilkan status transaksi secara jelas kepada user.

### Requirements
- Loading state saat processing
- Success state (green)
- Error state (red)
- Display transaction hash

### Acceptance Criteria
- User selalu tahu status transaksi
- TX hash bisa disalin atau ditampilkan

---

## 5. Non-Functional Requirements

### Performance
- Wallet connect < 3 seconds
- Transaction feedback < 10 seconds (testnet)

### Security
- Private key tidak pernah disimpan
- Semua signing dilakukan via Freighter only

### Reliability
- Handle network failure
- Handle wallet disconnect state

---

## 6. Tech Stack

### Frontend
- React.js / Next.js
- TailwindCSS (optional)

### Blockchain Integration
- @stellar/freighter-api
- stellar-sdk
- Stellar Testnet Horizon API

---

## 7. User Flow

Open App
→ Connect Freighter Wallet
→ Fetch Wallet Address
→ Fetch XLM Balance
→ Input Destination + Amount
→ Send Transaction
→ Sign via Freighter
→ Submit to Stellar Network
→ Show Result

---

## 8. UI Sections

- Header (App name + wallet button)
- Wallet info
- Balance display
- Transaction form
- Status/result section

---

## 9. Error Handling

| Scenario | Response |
|----------|----------|
| Wallet not installed | Show install Freighter message |
| Wallet rejected | Retry option |
| Invalid address | Block transaction |
| Insufficient balance | Show error |
| Network error | Retry option |

---

## 10. Deliverables

- GitHub repository
- README.md
- Screenshots:
  - Wallet connected
  - Balance displayed
  - Successful transaction
  - Transaction result

---

## 11. Timeline

Day 1: Setup + wallet connect  
Day 2: Balance integration  
Day 3: Transaction flow  
Day 4: UI polish  
Day 5: Testing + README  

---

## 12. Future Improvements

- Transaction history
- QR code send
- Faucet integration
- Dark mode
- Mobile responsive UI
