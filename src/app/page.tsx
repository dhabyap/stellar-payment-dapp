"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  checkFreighter,
  connectWallet,
  fetchBalance,
  fetchPaymentHistory,
  sendXLM,
} from "@/lib/stellar";

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

const shorten = (key: string | null | undefined) =>
  key ? `${key.slice(0, 4)}...${key.slice(-4)}` : "—";

// ── Contact book ──
interface Contact {
  name: string;
  address: string;
  color: string;
}

const DEFAULT_CONTACTS: Contact[] = [
  { name: "Budi", address: "GDU6XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXYS7F", color: "#6C63E8" },
  { name: "Sinta", address: "GBR7XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXRMX2", color: "#3ED9A3" },
  { name: "Rian", address: "GKPLXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX9TQ2", color: "#FF9F5A" },
];

function initials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

// ── SVG icons as components ──
const IconCopy = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const IconLogout = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="M16 17l5-5-5-5" />
    <path d="M21 12H9" />
  </svg>
);

const IconSend = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const IconCheck = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const IconCopySmall = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const IconShield = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const IconClock = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 8v4l3 2" />
  </svg>
);

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
  const [historyFilter, setHistoryFilter] = useState<"all" | "sent" | "received">("all");
  const [toastMsg, setToastMsg] = useState("");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    checkFreighter().then((res) => setWalletInstalled(res.isConnected));
  }, []);

  const showToast = useCallback((msg: string) => {
    clearTimeout(toastTimer.current);
    setToastMsg(msg);
    toastTimer.current = setTimeout(() => setToastMsg(""), 2200);
  }, []);

  const loadHistory = useCallback(async (key: string) => {
    setLoadingHistory(true);
    const payments = await fetchPaymentHistory(key);
    setHistory(payments as Payment[]);
    setLoadingHistory(false);
  }, []);

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
    setTxStatus({ type: "loading", message: "Processing..." });
    const result = await sendXLM(publicKey, dest.trim(), amount);
    if (result.success) {
      setTxStatus({ type: "success", hash: result.hash, message: "Transaction successful!" });
      const bal = await fetchBalance(publicKey);
      setBalance(bal);
      loadHistory(publicKey);
      showToast(`${amount} XLM berhasil dikirim`);
      // Reset form after a beat
      setTimeout(() => {
        setDest("");
        setAmount("");
        setSelectedContact(null);
        setTxStatus({ type: null });
      }, 2000);
    } else {
      setTxStatus({ type: "error", message: result.error || "Transaction failed" });
      showToast("Gagal: " + (result.error || "unknown error"));
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard?.writeText(text);
    showToast(label);
  };

  const isIncoming = (p: Payment) => publicKey && p.receiver === publicKey;

  const handleContactClick = (c: Contact) => {
    setDest(c.address);
    setSelectedContact(c);
  };

  const checkSendValid = () =>
    dest.trim().length > 4 && parseFloat(amount) > 0 && txStatus.type !== "loading";

  // ── Resolve contact from typed address ──
  const resolvedContact = dest.trim()
    ? DEFAULT_CONTACTS.find((c) => c.address === dest.trim()) || null
    : null;

  // ── Filter history ──
  const filteredHistory = history.filter((p) => {
    if (historyFilter === "all") return true;
    if (historyFilter === "sent") return !isIncoming(p);
    return isIncoming(p);
  });

  // ── Send button state ──
  const btnDisabled = !checkSendValid();
  let btnContent: React.ReactNode;
  if (txStatus.type === "loading") {
    btnContent = (
      <>
        <div className="spinner" />
        <span className="send-btn-label">Mengirim...</span>
      </>
    );
  } else if (txStatus.type === "success") {
    btnContent = (
      <>
        <IconCheck />
        <span className="send-btn-label">Terkirim!</span>
      </>
    );
  } else {
    btnContent = (
      <>
        <IconSend />
        <span className="send-btn-label">Send XLM</span>
      </>
    );
  }

  const btnClass = [
    "send-btn",
    txStatus.type === "loading" ? "is-loading" : "",
    txStatus.type === "success" ? "is-success" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="app">
      {/* Header */}
      <div className="header">
        <div className="brand">
          <div className="brand-mark">★</div>
          <div className="brand-name">Stellar Pay</div>
        </div>
        {walletInstalled ? (
          publicKey ? (
            <button className="disconnect" onClick={handleDisconnect}>
              <IconLogout />
              Disconnect
            </button>
          ) : (
            <button className="connect-btn" onClick={handleConnect}>
              Connect Freighter
            </button>
          )
        ) : (
          <span className="freighter-missing">Freighter not detected</span>
        )}
      </div>

      {/* Balance card */}
      {publicKey && (
        <div className="balance-card">
          <div className="bc-row">
            <div>
              <div className="label-eyebrow">Your balance</div>
            </div>
            <div
              className="address-chip"
              title="Salin alamat lengkap"
              onClick={() => copyToClipboard(publicKey, "Alamat wallet disalin")}
            >
              <IconCopySmall />
              <span className="mono">{shorten(publicKey)}</span>
            </div>
          </div>
          <div className="balance-amount">
            {balance !== null
              ? parseFloat(balance).toLocaleString("id-ID", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })
              : "—"}{" "}
            <span className="unit">XLM</span>
          </div>
          <div className="balance-fiat">
            ≈ <strong>
              {balance !== null
                ? "$" + (parseFloat(balance) * 0.13).toFixed(2)
                : "$0.00"}
            </strong>{" "}
            — kurs saat ini $0.13/XLM
          </div>
        </div>
      )}

      {/* Tabs */}
      {publicKey && (
        <div className="tabs">
          <button
            className={"tab" + (tab === "send" ? " active" : "")}
            onClick={() => setTab("send")}
          >
            Send
          </button>
          <button
            className={"tab" + (tab === "history" ? " active" : "")}
            onClick={() => setTab("history")}
          >
            History
          </button>
        </div>
      )}

      {/* ─── SEND PANEL ─── */}
      {publicKey && (
        <div className={"panel" + (tab === "send" ? " active" : "")}>
          <div className="card">
            <div className="card-title">Send money</div>
            <p className="card-subtitle">
              Kirim XLM langsung ke wallet tujuan dalam hitungan detik.
            </p>

            <div className="contacts-row">
              <div className="field-label-row">
                <label>Kirim ke kontak tersimpan</label>
              </div>
              <div className="contacts-scroll">
                {DEFAULT_CONTACTS.map((c) => (
                  <button
                    key={c.name}
                    className={
                      "contact-chip" +
                      (selectedContact?.name === c.name ? " selected" : "")
                    }
                    onClick={() => handleContactClick(c)}
                  >
                    <div
                      className="avatar"
                      style={{ background: c.color }}
                    >
                      {initials(c.name)}
                    </div>
                    <span className="cname">{c.name}</span>
                  </button>
                ))}
                <button className="contact-chip new-contact" onClick={() => showToast("Kontak baru bisa disimpan setelah transaksi pertama")}>
                  <div className="avatar">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </div>
                  <span className="cname">Baru</span>
                </button>
              </div>
            </div>

            <div className="field">
              <label>Send to</label>
              <input
                className="input"
                type="text"
                placeholder="Alamat wallet penerima (G...)"
                value={dest}
                onChange={(e) => {
                  setDest(e.target.value);
                  setSelectedContact(null);
                }}
              />
              <div className="hint" style={{ display: resolvedContact ? "none" : "block" }}>
                Tempel alamat Stellar milik penerima, bukan email atau username.
              </div>
              {resolvedContact && (
                <div className="resolved-contact show">
                  <div
                    className="mini-avatar"
                    style={{ background: resolvedContact.color }}
                  >
                    {initials(resolvedContact.name)}
                  </div>
                  <span>Mengirim ke {resolvedContact.name}</span>
                </div>
              )}
            </div>

            <div className="field">
              <label>Amount</label>
              <div className="amount-input-wrap">
                <input
                  className="input"
                  type="text"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                <div className="amount-suffix">
                  <button
                    className="max-btn"
                    type="button"
                    onClick={() => {
                      if (balance) setAmount(balance);
                    }}
                  >
                    MAX
                  </button>
                  <div className="unit-badge">XLM</div>
                </div>
              </div>
              <div className="hint">
                ≈ ${(parseFloat(amount || "0") * 0.13).toFixed(2)} · Tersedia{" "}
                {balance
                  ? parseFloat(balance).toLocaleString("id-ID", {
                      minimumFractionDigits: 2,
                    })
                  : "0.00"}{" "}
                XLM
              </div>
            </div>

            <div className="fee-line">
              <span>Biaya jaringan</span>
              <strong>~0.00001 XLM (kurang dari $0.01)</strong>
            </div>

            <button
              className={btnClass}
              disabled={btnDisabled}
              onClick={handleSend}
            >
              {btnContent}
            </button>

            <div className="safety-note">
              <IconShield />
              <span>
                Transaksi kripto tidak bisa dibatalkan. Periksa kembali alamat
                tujuan sebelum mengirim — dana yang salah kirim tidak dapat
                dikembalikan.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ─── HISTORY PANEL ─── */}
      {publicKey && (
        <div className={"panel" + (tab === "history" ? " active" : "")}>
          <div className="history-head">
            <div className="filter-chips">
              {(["all", "received", "sent"] as const).map((f) => (
                <button
                  key={f}
                  className={
                    "chip" +
                    (historyFilter === f ? " active " + f : "")
                  }
                  data-filter={f}
                  onClick={() => setHistoryFilter(f)}
                >
                  <span
                    className="dot"
                    style={{
                      background:
                        f === "all"
                          ? "var(--ink-dim)"
                          : f === "received"
                          ? "var(--mint)"
                          : "var(--coral)",
                    }}
                  />
                  {f === "all" ? "All" : f === "received" ? "Received" : "Sent"}
                </button>
              ))}
            </div>
          </div>

          {loadingHistory ? (
            <div
              style={{
                textAlign: "center",
                padding: 48,
                color: "var(--ink-faint)",
              }}
            >
              <div
                className="spinner"
                style={{ margin: "0 auto 12px" }}
              />
              <p style={{ fontSize: 13, margin: 0 }}>Loading...</p>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="empty-state">
              <IconClock />
              <p>Belum ada transaksi di kategori ini.</p>
            </div>
          ) : (
            <div className="tx-list">
              {filteredHistory.map((p) => {
                const incoming = isIncoming(p);
                const otherAddr = incoming ? p.sender : p.receiver;
                const avatarBg = incoming ? "var(--mint-dim)" : "var(--coral-dim)";
                const avatarColor = incoming ? "var(--mint)" : "var(--coral)";
                const avatarText = (otherAddr || "").slice(0, 2).toUpperCase();

                return (
                  <div
                    key={p.id}
                    className="tx-item"
                    data-type={incoming ? "received" : "sent"}
                  >
                    <div
                      className="avatar"
                      style={{
                        background: avatarBg,
                        color: avatarColor,
                        width: 42,
                        height: 42,
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontFamily: "'JetBrains Mono', monospace",
                        fontWeight: 600,
                        fontSize: 13,
                        flexShrink: 0,
                      }}
                    >
                      {avatarText}
                    </div>
                    <div className="tx-info">
                      <div className="tx-title">
                        {incoming ? "Received from" : "Sent to"}{" "}
                        {shorten(otherAddr)}
                      </div>
                      <div className="tx-meta">
                        <span>
                          {new Date(p.timestamp).toLocaleTimeString("id-ID", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <span className="sep">·</span>
                        <span className="mono">{shorten(p.transactionHash)}</span>
                        <button
                          className="copy-btn"
                          title="Salin ID transaksi"
                          onClick={() =>
                            copyToClipboard(
                              p.transactionHash,
                              "ID transaksi disalin"
                            )
                          }
                        >
                          <IconCopy />
                        </button>
                      </div>
                    </div>
                    <div className={"tx-amount " + (incoming ? "in" : "out")}>
                      {incoming ? "+" : "-"}
                      {parseFloat(p.amount).toLocaleString("id-ID", {
                        minimumFractionDigits: 2,
                      })}{" "}
                      XLM
                      <span className="sub">
                        ≈ ${(parseFloat(p.amount) * 0.13).toFixed(2)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Not connected state */}
      {walletInstalled && !publicKey && (
        <div className="empty-state" style={{ display: "block" }}>
          <IconClock />
          <p>Connect your Freighter wallet to get started.</p>
        </div>
      )}

      {/* Freighter not installed */}
      {!walletInstalled && (
        <div
          className="freighter-missing"
          style={{ marginTop: 16 }}
        >
          Install{" "}
          <a
            href="https://freighter.app"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--mint)", fontWeight: 600 }}
          >
            Freighter wallet
          </a>{" "}
          to use this dApp.
        </div>
      )}

      {/* Toast */}
      <div className={"toast" + (toastMsg ? " show" : "")}>
        <IconCheck />
        <span>{toastMsg}</span>
      </div>
    </div>
  );
}
