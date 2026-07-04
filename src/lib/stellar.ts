import { StellarWalletsKit } from "@creit.tech/stellar-wallets-kit";
import { FreighterModule, FREIGHTER_ID } from "@creit.tech/stellar-wallets-kit/modules/freighter";
import { LobstrModule } from "@creit.tech/stellar-wallets-kit/modules/lobstr";
import { xBullModule } from "@creit.tech/stellar-wallets-kit/modules/xbull";
import * as StellarSdk from "@stellar/stellar-sdk";

const HORIZON_URL = "https://horizon-testnet.stellar.org";
const server = new StellarSdk.Horizon.Server(HORIZON_URL);

// ── Error types ──
export class WalletError extends Error {
  code: string;
  constructor(msg: string, code: string) {
    super(msg);
    this.code = code;
  }
}

export const ERR = {
  NO_WALLET: "no_wallet",
  REJECTED: "rejected",
  BALANCE: "insufficient_balance",
} as const;

// ── Init kit ──
let inited = false;
function ensureKit() {
  if (!inited) {
    StellarWalletsKit.init({
      modules: [new FreighterModule(), new LobstrModule(), new xBullModule()],
      network: StellarSdk.Networks.TESTNET,
      selectedWalletId: FREIGHTER_ID,
    });
    inited = true;
  }
}

// ── Check wallets ──
export async function checkWallets(): Promise<{
  available: boolean;
  detected: string[];
}> {
  const detected: string[] = [];
  if (typeof window !== "undefined") {
    const w = window as any;
    if (w?.stellar?.isConnected) detected.push("freighter");
    if (w?.lobstr) detected.push("lobstr");
    if (w?.xbull) detected.push("xbull");
  }
  return { available: detected.length > 0, detected };
}

// ── Connect ──
export async function connectWallet(): Promise<{
  publicKey: string;
  walletId: string;
}> {
  ensureKit();
  try {
    const { address } = await StellarWalletsKit.fetchAddress();
    const id = (StellarWalletsKit as any).selectedModule?.productId || FREIGHTER_ID;
    return { publicKey: address, walletId: id };
  } catch (err: any) {
    const msg = (err?.message || "").toLowerCase();
    if (err?.code === 4001 || msg.includes("reject") || msg.includes("cancel") || msg.includes("denied")) {
      throw new WalletError("Koneksi dibatalkan pengguna.", ERR.REJECTED);
    }
    throw new WalletError("Gagal connect wallet.", ERR.NO_WALLET);
  }
}

// ── Sign & submit ──
async function signAndSubmit(
  publicKey: string,
  tx: StellarSdk.Transaction
): Promise<string> {
  ensureKit();
  const result = await StellarWalletsKit.signTransaction(tx.toXDR(), {
    address: publicKey,
    networkPassphrase: StellarSdk.Networks.TESTNET,
  });
  const signedXdr = typeof result === "string" ? result : (result as any).signedTxXdr;
  const txEnv = StellarSdk.TransactionBuilder.fromXDR(signedXdr, StellarSdk.Networks.TESTNET);
  const res = await server.submitTransaction(txEnv);
  return res.hash;
}

// ── Balance ──
export async function fetchBalance(publicKey: string): Promise<string> {
  const acc = await server.loadAccount(publicKey);
  const xlm = acc.balances.find((b: any) => b.asset_type === "native");
  return xlm ? xlm.balance : "0";
}

// ── Send XLM ──
export async function sendXLM(
  publicKey: string,
  dest: string,
  amount: string
): Promise<{ success: boolean; hash?: string; error?: string }> {
  if (!/^G[A-Z0-9]{55}$/.test(dest)) {
    return { success: false, error: "Alamat wallet tidak valid." };
  }
  try {
    const bal = await fetchBalance(publicKey);
    const fee = 0.00001;
    if (parseFloat(bal) < parseFloat(amount) + fee) {
      return {
        success: false,
        error: `Saldo tidak cukup. Tersedia ${parseFloat(bal).toFixed(2)} XLM.`,
      };
    }
    const account = await server.loadAccount(publicKey);
    const tx = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: StellarSdk.Networks.TESTNET,
    })
      .addOperation(
        StellarSdk.Operation.payment({
          destination: dest,
          asset: StellarSdk.Asset.native(),
          amount,
        })
      )
      .setTimeout(30)
      .build();
    const hash = await signAndSubmit(publicKey, tx);
    return { success: true, hash };
  } catch (err: any) {
    const msg = (err?.message || "").toLowerCase();
    if (msg.includes("reject") || err?.code === 4001) {
      return { success: false, error: "Transaksi dibatalkan." };
    }
    if (err?.response?.data?.extras?.result_codes?.transaction === "tx_insufficient_balance") {
      return { success: false, error: "Saldo tidak cukup untuk fee." };
    }
    return { success: false, error: err?.message || "Gagal." };
  }
}

// ── History ──
export async function fetchPaymentHistory(publicKey: string): Promise<any[]> {
  try {
    const payments = await server
      .payments()
      .forAccount(publicKey)
      .order("desc")
      .limit(30)
      .call();
    return payments.records
      .filter((p: any) => p.type === "payment")
      .map((p: any) => ({
        id: p.id,
        type: p.type,
        sender: p.from,
        receiver: p.to,
        amount: p.amount,
        assetType: p.asset_type,
        timestamp: p.created_at,
        transactionHash: p.transaction_hash,
      }));
  } catch {
    return [];
  }
}
