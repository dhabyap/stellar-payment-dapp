# Stellar Simple Payment dApp

A simple decentralized application to send XLM on the Stellar Testnet using the Freighter wallet.

## Features
- Connect/Disconnect Freighter Wallet
- View XLM Balance (Testnet)
- Send XLM to any Stellar address
- Real-time transaction feedback (Success/Error/TX Hash)

## Tech Stack
- **Framework**: Next.js 15+ (App Router)
- **Styling**: Tailwind CSS
- **SDK**: @stellar/stellar-sdk, @stellar/freighter-api

## Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Run Development Server**:
   ```bash
   npm run dev
   ```

3. **Build for Production**:
   ```bash
   npm run build
   ```

## Prerequisites
- Chrome/Brave/Firefox with [Freighter Wallet](https://freighter.app/) extension installed.
- Freighter set to **Testnet** network.
- Some Testnet XLM (use [Stellar Laboratory Friendbot](https://laboratory.stellar.org/#account-creator?network=testnet) to fund an account).

## Screenshots
*Screenshots placeholder — replace with actual files during final delivery*
1. **Wallet Connected**: ![Connected]()
2. **Balance Displayed**: ![Balance]()
3. **Successful Transaction**: ![Success]()
