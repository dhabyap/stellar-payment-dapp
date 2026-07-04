import * as StellarSdk from "@stellar/stellar-sdk";
import { StellarWalletsKit } from "@creit.tech/stellar-wallets-kit";
import { WalletError, ERR } from "./stellar";

const HORIZON_URL = "https://horizon-testnet.stellar.org";
const SOROBAN_URL = "https://soroban-testnet.stellar.org";
const horizonServer = new StellarSdk.Horizon.Server(HORIZON_URL);
const sorobanServer = new StellarSdk.SorobanRpc.Server(SOROBAN_URL);

type PaymentRecord = {
  id: string;
  sender: string;
  receiver: string;
  amount: string;
  memo: string;
  timestamp: string;
  status: "Pending" | "Completed" | "Failed";
};

/**
 * Sign & submit transaction via wallet kit
 */
async function signAndSubmit(
  publicKey: string,
  tx: StellarSdk.Transaction,
): Promise<string> {
  const xdr = tx.toXDR();
  const result = await StellarWalletsKit.signTransaction(xdr, {
    address: publicKey,
    networkPassphrase: StellarSdk.Networks.TESTNET,
  });
  const signedXdr = typeof result === "string" ? result : (result as any).signedTxXdr;
  const txEnv = StellarSdk.TransactionBuilder.fromXDR(
    signedXdr,
    StellarSdk.Networks.TESTNET,
  );

  // Submit to Soroban RPC
  const res = await sorobanServer.sendTransaction(txEnv);
  if (res.status === "ERROR") {
    const errMsg = res.errorResult?.toXDR?.() ?? "Transaction error";
    throw new Error(String(errMsg));
  }
  return res.hash;
}

/**
 * Call contract function via Soroban RPC
 */
async function callContract(
  publicKey: string,
  contractId: string,
  method: string,
  args: StellarSdk.xdr.ScVal[],
): Promise<string> {
  const contract = new StellarSdk.Contract(contractId);
  const account = await horizonServer.loadAccount(publicKey);

  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  // Simulate first to check for errors
  const sim = await sorobanServer.simulateTransaction(tx);
  if (StellarSdk.SorobanRpc.Api.isSimulationError(sim)) {
    throw new Error("Simulation failed: " + sim.error);
  }

  return signAndSubmit(publicKey, tx);
}

/**
 * Initialize contract
 */
export async function initContract(
  publicKey: string,
  contractId: string,
): Promise<string> {
  return callContract(publicKey, contractId, "initialize", []);
}

/**
 * Create a new payment record on-chain
 */
export async function createPayment(
  publicKey: string,
  contractId: string,
  receiver: string,
  amount: string,
  memo: string,
): Promise<string> {
  const amountScaled = BigInt(Math.floor(parseFloat(amount) * 10_000_000));
  return callContract(publicKey, contractId, "create_payment", [
    new StellarSdk.Address(publicKey).toScVal(),
    StellarSdk.nativeToScVal(receiver, { type: "string" }),
    StellarSdk.nativeToScVal(amountScaled, { type: "i128" }),
    StellarSdk.nativeToScVal(memo, { type: "string" }),
  ]);
}

/**
 * Mark payment completed
 */
export async function markCompleted(
  publicKey: string,
  contractId: string,
  paymentId: number,
): Promise<string> {
  return callContract(publicKey, contractId, "mark_completed", [
    StellarSdk.nativeToScVal(BigInt(paymentId), { type: "u64" }),
    new StellarSdk.Address(publicKey).toScVal(),
  ]);
}

/**
 * Mark payment failed
 */
export async function markFailed(
  publicKey: string,
  contractId: string,
  paymentId: number,
): Promise<string> {
  return callContract(publicKey, contractId, "mark_failed", [
    StellarSdk.nativeToScVal(BigInt(paymentId), { type: "u64" }),
    new StellarSdk.Address(publicKey).toScVal(),
  ]);
}

/**
 * Simulate a read-only contract call
 */
async function simulateCall(
  caller: string,
  contractId: string,
  method: string,
  args: StellarSdk.xdr.ScVal[],
): Promise<any> {
  const contract = new StellarSdk.Contract(contractId);
  const account = await horizonServer.loadAccount(caller);
  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const sim = await sorobanServer.simulateTransaction(tx);
  if (StellarSdk.SorobanRpc.Api.isSimulationError(sim)) {
    return null;
  }
  return sim.result?.retval;
}

/**
 * Get a single payment from contract
 */
export async function getPayment(
  contractId: string,
  paymentId: number,
): Promise<PaymentRecord | null> {
  try {
    // Use a known testnet account as caller for read-only simulation
    const caller = "GDU6XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXYS7F";
    const result = await simulateCall(
      caller,
      contractId,
      "get_payment",
      [StellarSdk.nativeToScVal(BigInt(paymentId), { type: "u64" })],
    );
    if (!result) return null;
    return parsePaymentResult(result, paymentId);
  } catch {
    return null;
  }
}

/**
 * Get payments by sender
 */
export async function getPaymentsBySender(
  contractId: string,
  sender: string,
): Promise<PaymentRecord[]> {
  try {
    const result = await simulateCall(
      sender,
      contractId,
      "get_payments_by_sender",
      [new StellarSdk.Address(sender).toScVal()],
    );
    if (!result) return [];
    return parsePaymentList(result);
  } catch {
    return [];
  }
}

/**
 * Parse raw Soroban result into PaymentRecord
 */
function parsePaymentResult(raw: any, id: number): PaymentRecord {
  return {
    id: String(id),
    sender: raw.sender?.toString() || "",
    receiver: raw.receiver?.toString() || "",
    amount: raw.amount ? String(Number(raw.amount) / 10_000_000) : "0",
    memo: raw.memo?.toString() || "",
    timestamp: raw.timestamp?.toString() || "0",
    status:
      raw.status?.toString() === "Completed"
        ? "Completed"
        : raw.status?.toString() === "Failed"
        ? "Failed"
        : "Pending",
  };
}

function parsePaymentList(raw: any): PaymentRecord[] {
  if (!raw || !Array.isArray(raw)) return [];
  return raw.map((p: any, i: number) => parsePaymentResult(p, i + 1));
}

/**
 * Poll payments for sender — for real-time status updates
 */
export function pollPayments(
  contractId: string,
  sender: string,
  intervalMs: number = 5000,
  onUpdate: (payments: PaymentRecord[]) => void,
): () => void {
  let running = true;

  const poll = async () => {
    if (!running) return;
    try {
      const payments = await getPaymentsBySender(contractId, sender);
      onUpdate(payments);
    } catch {
      // silent
    }
    if (running) setTimeout(poll, intervalMs);
  };

  poll();
  return () => {
    running = false;
  };
}
