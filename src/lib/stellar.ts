import { 
  isConnected,
  getAddress,
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
    const { address, error } = await getAddress();
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

export const sendXLM = async (sender: string, destination: string, amount: string) => {
  try {
    const account = await server.loadAccount(sender);
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
      .setTimeout(30)
      .build();

    const result = await signTransaction(tx.toXDR(), {
      networkPassphrase: StellarSdk.Networks.TESTNET,
    });
    const { signedTxXdr } = result;

    const signedTx = StellarSdk.TransactionBuilder.fromXDR(
      signedTxXdr,
      StellarSdk.Networks.TESTNET
    );

    const submitResult = await server.submitTransaction(signedTx);
    return { success: true, hash: submitResult.hash };
  } catch (error: any) {
    console.error("Transaction failed", error);
    return { 
      success: false, 
      error: error.response?.data?.extras?.result_codes?.operations?.[0] || error.message 
    };
  }
};
