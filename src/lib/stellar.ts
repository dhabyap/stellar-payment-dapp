import { 
  isConnected,
  requestAccess,
  signTransaction 
} from "@stellar/freighter-api";
import * as StellarSdk from "@stellar/stellar-sdk";

const HORIZON_URL = "https://horizon-testnet.stellar.org";
const server = new StellarSdk.Horizon.Server(HORIZON_URL);

export const checkFreighter = async () => {
  return await isConnected();
};

export const connectWallet = async () => {
  try {
    const { address, error } = await requestAccess();
    if (error) throw new Error(error);
    return address;
  } catch (error) {
    console.error("User declined connection", error);
    return null;
  }
};

export const fetchBalance = async (publicKey: string) => {
  try {
    const account = await server.loadAccount(publicKey);
    const nativeBalance = account.balances.find((b: any) => b.asset_type === "native");
    return nativeBalance ? nativeBalance.balance : "0";
  } catch (error) {
    console.error("Error fetching balance", error);
    return "0";
  }
};

export const fetchPaymentHistory = async (publicKey: string) => {
  try {
    const payments = await server
      .payments()
      .forAccount(publicKey)
      .limit(50)
      .order("desc")
      .call();
    return payments.records
      .filter((p: any) => p.type === "payment")
      .map((p: any) => ({
        id: p.id,
        type: p.type,
        sender: p.from || "",
        receiver: p.to || "",
        amount: `${p.amount} ${p.asset_type === "native" ? "XLM" : p.asset_code || ""}`,
        assetType: p.asset_type,
        timestamp: p.created_at,
        transactionHash: p.transaction_hash,
      }));
  } catch (error) {
    console.error("Error fetching payment history", error);
    return [];
  }
};

export const sendXLM = async (sender: string, destination: string, amount: string) => {
  try {
    const account = await server.loadAccount(sender);
    const { minTime, maxTime } = await server.fetchTimebounds(300);
    
    const tx = new StellarSdk.TransactionBuilder(account, {
      fee: String(await server.fetchBaseFee()),
      networkPassphrase: StellarSdk.Networks.TESTNET,
    })
      .addOperation(
        StellarSdk.Operation.payment({
          destination,
          asset: StellarSdk.Asset.native(),
          amount,
        })
      )
      .setTimebounds(minTime, maxTime)
      .build();

    const txXDR = tx.toXDR();

    const result = await signTransaction(txXDR, {
      networkPassphrase: StellarSdk.Networks.TESTNET,
    });

    const r = result as any;
    const signedEnvelopeXDR = r.signedTxXdr || r.signedTransaction || r.transactionXdr;
    if (!signedEnvelopeXDR) {
      return { success: false, error: "No signed XDR returned from Freighter" };
    }

    const signedTx = StellarSdk.TransactionBuilder.fromXDR(
      signedEnvelopeXDR,
      StellarSdk.Networks.TESTNET
    );

    const submitResult = await server.submitTransaction(signedTx);
    return { success: true, hash: submitResult.hash };
  } catch (error: any) {
    console.error("Transaction failed", error);
    const horizonError = error.response?.data;
    const txError = horizonError?.extras?.result_codes?.operations?.[0]
      || horizonError?.extras?.result_codes?.transaction
      || horizonError?.detail
      || error.message;
    return { success: false, error: txError };
  }
};
