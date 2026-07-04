"use client";

import { useState, useEffect } from "react";
import { checkFreighter, connectWallet, fetchBalance, fetchPaymentHistory, sendXLM } from "@/lib/stellar";

type TxStatus = {
  type: "success" | "error" | "loading" | null;
  message?: string;
  hash?: string;
};

type Payment = {
  id: string;
  type: string;
  sender: string;
  receiver: string;
  amount: string;
  assetType: string;
  timestamp: string;
  transactionHash: string;
};

const shorten = (key: string | null | undefined) => key ? `${key.slice(0, 4)}...${key.slice(-4)}` : "—";

export default function Home() {
  const [walletInstalled, setWalletInstalled] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [dest, setDest] = useState("");
  const [amount, setAmount] = useState("");
  const [txStatus, setTxStatus] = useState<TxStatus>({ type: null });
  const [tab, setTab] = useState<"send" | "history">("send");
  const [history, setHistory] = useState<Payment[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    checkFreighter().then((res) => setWalletInstalled(res.isConnected));
  }, []);

  const loadHistory = async (key: string) => {
    setLoadingHistory(true);
    const payments = await fetchPaymentHistory(key);
    setHistory(payments as Payment[]);
    setLoadingHistory(false);
  };

  const handleConnect = async () => {
    const key = await connectWallet();
    if (key) {
      setPublicKey(key);
      const bal = await fetchBalance(key);
      setBalance(bal);
      loadHistory(key);
    }
  };

  const handleDisconnect = () => {
    setPublicKey(null);
    setBalance(null);
    setTxStatus({ type: null });
    setHistory([]);
  };

  const handleSend = async () => {
    if (!publicKey || !dest.trim() || !amount || parseFloat(amount) <= 0) return;
    setTxStatus({ type: "loading", message: "Processing transaction..." });
    const result = await sendXLM(publicKey, dest.trim(), amount);
    if (result.success) {
      setTxStatus({ type: "success", hash: result.hash, message: "Transaction successful!" });
      const bal = await fetchBalance(publicKey);
      setBalance(bal);
      loadHistory(publicKey);
    } else {
      setTxStatus({ type: "error", message: result.error || "Transaction failed" });
    }
  };

  const isIncoming = (p: Payment) => publicKey && (p.receiver === publicKey);

  return (
    <div className="flex flex-1 flex-col items-center p-4 sm:p-8">
      <main className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight">Stellar Pay</h1>
          {walletInstalled ? (
            publicKey ? (
              <button
                onClick={handleDisconnect}
                className="rounded-lg border border-red-200 px-4 py-1.5 text-sm text-red-600 transition hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
              >
                Disconnect
              </button>
            ) : (
              <button
                onClick={handleConnect}
                className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-700"
              >
                Connect Freighter
              </button>
            )
          ) : (
            <span className="text-sm text-amber-600 dark:text-amber-400">
              Freighter not detected
            </span>
          )}
        </div>

        {/* Wallet info */}
        {publicKey && (
          <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="text-zinc-500 dark:text-zinc-400">Address</div>
            <div className="mt-0.5 font-mono text-zinc-800 dark:text-zinc-200">
              {shorten(publicKey)}
            </div>
            <div className="mt-3 text-zinc-500 dark:text-zinc-400">Balance</div>
            <div className="mt-0.5 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              {balance !== null ? `${parseFloat(balance).toFixed(2)} XLM` : "—"}
            </div>
          </div>
        )}

        {/* Tabs */}
        {publicKey && (
          <div className="flex gap-1 rounded-lg border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-800 dark:bg-zinc-900">
            <button
              onClick={() => setTab("send")}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
                tab === "send"
                  ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
              }`}
            >
              Send
            </button>
            <button
              onClick={() => setTab("history")}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
                tab === "history"
                  ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
              }`}
            >
              History
            </button>
          </div>
        )}

        {/* Send tab */}
        {publicKey && tab === "send" && (
          <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              Send XLM
            </h2>
            <div>
              <label className="block text-xs text-zinc-500 dark:text-zinc-400">
                Destination Address
              </label>
              <input
                value={dest}
                onChange={(e) => setDest(e.target.value)}
                placeholder="G..."
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-mono text-zinc-900 placeholder-zinc-400 focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 dark:text-zinc-400">
                Amount (XLM)
              </label>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                type="number"
                min="0"
                step="0.0000001"
                placeholder="0.00"
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-mono text-zinc-900 placeholder-zinc-400 focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </div>
            <button
              onClick={handleSend}
              disabled={txStatus.type === "loading" || !dest.trim() || !amount || parseFloat(amount) <= 0}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {txStatus.type === "loading" ? "Sending..." : "Send XLM"}
            </button>
          </div>
        )}

        {/* Status feedback */}
        {txStatus.type && txStatus.type !== "loading" && (
          <div
            className={`rounded-xl border p-4 text-sm ${
              txStatus.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                : "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
            }`}
          >
            <div className="font-medium">{txStatus.message}</div>
            {txStatus.hash && (
              <div className="mt-1 font-mono text-xs break-all opacity-80">
                TX: {txStatus.hash}
              </div>
            )}
          </div>
        )}

        {/* Loading spinner */}
        {txStatus.type === "loading" && (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
            {txStatus.message}
          </div>
        )}

        {/* History tab */}
        {publicKey && tab === "history" && (
          <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
              <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                Payment History
              </h2>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {loadingHistory ? (
                <div className="flex items-center justify-center gap-2 p-6 text-sm text-zinc-500">
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                  Loading...
                </div>
              ) : history.length === 0 ? (
                <p className="p-6 text-center text-sm text-zinc-500">
                  No transactions yet.
                </p>
              ) : (
                history.map((p) => (
                  <div
                    key={p.id}
                    className="border-b border-zinc-100 px-4 py-3 last:border-0 dark:border-zinc-800"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-block h-2 w-2 rounded-full ${
                            isIncoming(p)
                              ? "bg-emerald-500"
                              : "bg-red-400"
                          }`}
                        />
                        <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                          {isIncoming(p) ? "Received" : "Sent"}
                        </span>
                      </div>
                      <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {isIncoming(p) ? "+" : "-"}{p.amount}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs text-zinc-500">
                      <span>
                        {isIncoming(p) ? "From: " : "To: "}
                        <span className="font-mono">{shorten(isIncoming(p) ? p.sender : p.receiver)}</span>
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-zinc-400">
                      {new Date(p.timestamp).toLocaleString("id-ID")}
                    </div>
                    {p.transactionHash && (
                      <div className="mt-0.5 font-mono text-[10px] text-zinc-400 truncate">
                        TX: {p.transactionHash}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Freighter not installed */}
        {!walletInstalled && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
            Install{" "}
            <a
              href="https://freighter.app"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline underline-offset-2"
            >
              Freighter wallet
            </a>{" "}
            to use this dApp.
          </div>
        )}

        {/* No wallet connected */}
        {walletInstalled && !publicKey && (
          <div className="text-center text-sm text-zinc-500 dark:text-zinc-400">
            Connect your Freighter wallet to get started.
          </div>
        )}
      </main>
    </div>
  );
}
