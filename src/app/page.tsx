"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  checkWallets,
  connectWallet,
  fetchBalance,
  fetchPaymentHistory,
  sendXLM,
  ERR,
  WalletError,
} from "@/lib/stellar";
import {
  createPayment,
  initContract,
  pollPayments,
} from "@/lib/contract";

// ── Contract address (testnet) ──
const CONTRACT_ID = "CBGPGATQZO74UKFKOFJ5N7FRQGY3DSQQ6DB32B2NG6IATX6QNE4M5VHE";

type TxStatus = {
  type: "success" | "error" | "loading" | null;
  message?: string;
  hash?: string;
};

type TxStep = "idle" | "signing" | "broadcasting" | "confirmed" | "failed";

type Payment = {
  id: string;
  type: string;
  sender: string;
  receiver: string;
  amount: string;
  assetType: string;
  timestamp: string;
  transactionHash: string;
  contractStatus?: "Pending" | "Completed" | "Failed";
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

const IconPlus = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const IconClose = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

// ── Wallet item component ──
interface WalletItemProps {
  name: string;
  desc: string;
  detected: boolean;
  icon: string;
  onClick: () => void;
}

function WalletItem({ name, desc, detected, icon, onClick }: WalletItemProps) {
  return (
    <button
      className="wallet-item"
      disabled={!detected}
      onClick={onClick}
    >
      <div className="wallet-icon">{icon}</div>
      <div className="wallet-info">
        <div className="wallet-name">{name}</div>
        <div className="wallet-desc">{detected ? desc : "Not detected — install extension"}</div>
      </div>
      {detected && <span className="wallet-arrow">→</span>}
      {!detected && <span className="wallet-badge">Missing</span>}
    </button>
  );
}

// ── Tx Step Progress ──
function TxProgress({ step }: { step: TxStep }) {
  if (step === "idle") return null;
  const steps: { key: TxStep; label: string }[] = [
    { key: "signing", label: "Signing" },
    { key: "broadcasting", label: "Broadcasting" },
    { key: "confirmed", label: "Confirmed" },
  ];
  const activeIdx = steps.findIndex((s) => s.key === step);
  return (
    <div className="tx-progress">
      {steps.map((s, i) => (
        <div key={s.key} className={`tx-step ${i <= activeIdx || step === "confirmed" ? "active" : ""} ${step === "failed" && i === 0 ? "failed" : ""}`}>
          <div className="step-dot">{i <= activeIdx || step === "confirmed" ? (step === "failed" && i === 0 ? "✕" : "✓") : ""}</div>
          <span className="step-label">{s.label}</span>
          {i < steps.length - 1 && <div className="step-line" />}
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  const [walletInstalled, setWalletInstalled] = useState(false);
  const [detectedWallets, setDetectedWallets] = useState<string[]>([]);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [walletId, setWalletId] = useState<string>("");
  const [balance, setBalance] = useState<string | null>(null);
  const [dest, setDest] = useState("");
  const [amount, setAmount] = useState("");
  const [txStatus, setTxStatus] = useState<TxStatus>({ type: null });
  const [txStep, setTxStep] = useState<TxStep>("idle");
  const [tab, setTab] = useState<"send" | "history">("send");
  const [history, setHistory] = useState<Payment[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<"all" | "sent" | "received">("all");
  const [toastMsg, setToastMsg] = useState("");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [contacts, setContacts] = useState<Contact[]>(DEFAULT_CONTACTS);
  const [savePrompt, setSavePrompt] = useState<{ address: string } | null>(null);
  const [newContactName, setNewContactName] = useState("");
  const [errorTitle, setErrorTitle] = useState<string | null>(null);

  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    checkWallets().then((res) => {
      setWalletInstalled(res.available);
      setDetectedWallets(res.detected);
    });
    const saved = localStorage.getItem("stellar_contacts");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length) setContacts(parsed);
      } catch {}
    }
  }, []);

  // ── Polling contract for real-time status updates ──
  useEffect(() => {
    if (!CONTRACT_ID || !publicKey) return;
    const stop = pollPayments(CONTRACT_ID, publicKey, 5000, (payments) => {
      setHistory((prev) =>
        prev.map((p) => {
          const onChain = payments.find((c) => String(c.id) === p.id);
          if (onChain) return { ...p, contractStatus: onChain.status };
          return p;
        })
      );
    });
    return () => stop();
  }, [publicKey]);

  const showToast = useCallback((msg: string) => {
    clearTimeout(toastTimer.current);
    setToastMsg(msg);
    toastTimer.current = setTimeout(() => setToastMsg(""), 2200);
  }, []);

  const persistContacts = (newContacts: Contact[]) => {
    setContacts(newContacts);
    localStorage.setItem("stellar_contacts", JSON.stringify(newContacts));
  };

  const deleteContact = (address: string) => {
    persistContacts(contacts.filter((c) => c.address !== address));
    if (selectedContact?.address === address) setSelectedContact(null);
    if (dest === address) setDest("");
    showToast("Kontak dihapus");
  };

  const saveContact = (name: string, address: string) => {
    if (contacts.find((c) => c.address === address)) return;
    const color = ["#6C63E8", "#3ED9A3", "#FF9F5A", "#FF7A6E", "#7C7CF5", "#FFB84D"][
      contacts.length % 6
    ];
    persistContacts([...contacts, { name, address, color }]);
  };

  const loadHistory = useCallback(async (key: string) => {
    setLoadingHistory(true);
    const payments = await fetchPaymentHistory(key);
    setHistory(payments as Payment[]);
    setLoadingHistory(false);
  }, []);

  // ── Wallet Connect ──
  const handleConnect = async () => {
    try {
      const { publicKey: pk, walletId: wid } = await connectWallet();
      if (pk) {
        setPublicKey(pk);
        setWalletId(wid);
        setShowWalletModal(false);
        const bal = await fetchBalance(pk);
        setBalance(bal);
        loadHistory(pk);
        showToast(`Connected via ${wid}`);
      }
    } catch (err: any) {
      if (err instanceof WalletError) {
        if (err.code === ERR.REJECTED) {
          showToast("Koneksi dibatalkan");
        } else {
          setErrorTitle(err.message);
          showToast(err.message);
        }
      } else {
        showToast("Gagal connect wallet");
      }
    }
  };

  const handleDisconnect = () => {
    setPublicKey(null);
    setWalletId("");
    setBalance(null);
    setTxStatus({ type: null });
    setTxStep("idle");
    setHistory([]);
    showToast("Disconnected");
  };

  const handleSend = async () => {
    if (!publicKey || !dest.trim() || !amount || parseFloat(amount) <= 0) return;
    const addr = dest.trim();

    // Pre-check balance
    const fee = 0.00001;
    if (balance && parseFloat(balance) < parseFloat(amount) + fee) {
      setErrorTitle("Saldo tidak mencukupi");
      setTxStatus({ type: "error", message: `Saldo tidak cukup. Tersedia ${parseFloat(balance).toFixed(2)} XLM.` });
      showToast("Saldo tidak cukup");
      return;
    }

    setTxStep("signing");
    setTxStatus({ type: "loading", message: "Menunggu konfirmasi wallet..." });

    try {
      const result = await sendXLM(publicKey, addr, amount);

      setTxStep("broadcasting");

      if (result.success) {
        // Record on contract (fire & forget — don't block UI)
        if (CONTRACT_ID) {
          try {
            const txHash = await createPayment(
              publicKey,
              CONTRACT_ID,
              addr,
              amount,
              "Payment via Stellar Pay"
            );
          } catch {}
        }

        setTxStep("confirmed");
        setTxStatus({ type: "success", hash: result.hash, message: "Transaction successful!" });
        const bal = await fetchBalance(publicKey);
        setBalance(bal);
        loadHistory(publicKey);
        showToast(`${amount} XLM berhasil dikirim`);

        if (!contacts.find((c) => c.address === addr)) {
          setSavePrompt({ address: addr });
        } else {
          setTimeout(() => {
            setDest("");
            setAmount("");
            setSelectedContact(null);
            setTxStatus({ type: null });
            setTxStep("idle");
          }, 2000);
        }
      } else {
        setTxStep("failed");
        setTxStatus({ type: "error", message: result.error || "Transaction failed" });
        showToast("Gagal: " + (result.error || "unknown error"));
      }
    } catch (err: any) {
      setTxStep("failed");
      if (err instanceof WalletError) {
        if (err.code === ERR.REJECTED) {
          setErrorTitle("Transaksi dibatalkan");
          showToast("Dibatalkan oleh wallet");
        } else {
          setErrorTitle(err.message);
          showToast(err.message);
        }
      } else {
        setTxStatus({ type: "error", message: "Gagal mengirim" });
        showToast("Gagal mengirim");
      }
    }
  };

  const handleSaveConfirm = () => {
    if (savePrompt && newContactName.trim()) {
      saveContact(newContactName.trim(), savePrompt.address);
      setSavePrompt(null);
      setNewContactName("");
      showToast("Kontak tersimpan");
      setTimeout(() => {
        setDest("");
        setAmount("");
        setSelectedContact(null);
        setTxStatus({ type: null });
        setTxStep("idle");
      }, 800);
    }
  };

  const handleSaveSkip = () => {
    setSavePrompt(null);
    setNewContactName("");
    setTimeout(() => {
      setDest("");
      setAmount("");
      setSelectedContact(null);
      setTxStatus({ type: null });
      setTxStep("idle");
    }, 200);
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

  const resolvedContact = dest.trim()
    ? contacts.find((c) => c.address === dest.trim()) || null
    : null;

  const filteredHistory = history.filter((p) => {
    if (historyFilter === "all") return true;
    if (historyFilter === "sent") return !isIncoming(p);
    return isIncoming(p);
  });

  const btnDisabled = !checkSendValid() || savePrompt !== null;
  let btnContent: React.ReactNode;
  if (txStatus.type === "loading") {
    btnContent = (
      <>
        <div className="spinner" />
        <span className="send-btn-label">{txStep === "signing" ? "Menunggu konfirmasi..." : txStep === "broadcasting" ? "Broadcasting..." : "Processing..."}</span>
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
    txStatus.type === "error" ? "is-error" : "",
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
            <button className="connect-btn" onClick={() => setShowWalletModal(true)}>
              Connect Wallet
            </button>
          )
        ) : (
          <span className="freighter-missing">No wallet detected</span>
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

            {/* Tx Progress */}
            <TxProgress step={txStep} />

            {/* Error banner */}
            {errorTitle && txStatus.type === "error" && (
              <div className="error-banner">
                <span>{errorTitle}</span>
                <button className="error-close" onClick={() => { setErrorTitle(null); setTxStatus({ type: null }); setTxStep("idle"); }}>
                  <IconClose />
                </button>
              </div>
            )}

            <div className="contacts-row">
              <div className="field-label-row">
                <label>Kirim ke kontak tersimpan</label>
              </div>
              <div className="contacts-scroll">
                {contacts.map((c) => (
                  <div
                    key={c.name + c.address}
                    className={
                      "contact-chip" +
                      (selectedContact?.name === c.name ? " selected" : "")
                    }
                    onClick={() => handleContactClick(c)}
                    style={{ position: "relative" }}
                  >
                    <div
                      className="avatar"
                      style={{ background: c.color }}
                    >
                      {initials(c.name)}
                    </div>
                    <span className="cname">{c.name}</span>
                    <button
                      className="contact-delete"
                      onClick={(e) => { e.stopPropagation(); deleteContact(c.address); }}
                      title="Hapus kontak"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button className="contact-chip new-contact" onClick={() => showToast("Kontak baru otomatis bisa disimpan setelah transaksi ke alamat baru")}>
                  <div className="avatar">
                    <IconPlus />
                  </div>
                  <span className="cname">Baru</span>
                </button>
              </div>
              {contacts.length > 4 && (
                <div className="contact-dropdown-wrap">
                  <select
                    className="input contact-dropdown"
                    value={selectedContact?.address || ""}
                    onChange={(e) => {
                      const c = contacts.find((c) => c.address === e.target.value);
                      if (c) handleContactClick(c);
                    }}
                  >
                    <option value="">Pilih kontak...</option>
                    {contacts.map((c) => (
                      <option key={c.address} value={c.address}>
                        {c.name} — {shorten(c.address)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
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

            {/* Save contact prompt */}
            {savePrompt && (
              <div className="save-prompt">
                <p className="save-prompt-text">
                  Simpan <span className="mono" style={{ color: "var(--mint)" }}>{shorten(savePrompt.address)}</span> sebagai kontak?
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    className="input"
                    type="text"
                    placeholder="Nama kontak..."
                    value={newContactName}
                    onChange={(e) => setNewContactName(e.target.value)}
                    style={{ marginBottom: 0, flex: 1 }}
                    autoFocus
                  />
                  <button
                    className="save-btn"
                    disabled={!newContactName.trim()}
                    onClick={handleSaveConfirm}
                  >
                    Simpan
                  </button>
                  <button
                    className="skip-btn"
                    onClick={handleSaveSkip}
                  >
                    Lewati
                  </button>
                </div>
              </div>
            )}

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
            <div className="empty-state" style={{ textAlign: "center", padding: 48, color: "var(--ink-faint)" }}>
              <div className="spinner" style={{ margin: "0 auto 12px" }} />
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
                const avatarColor = incoming ? "var(--mint)" : "var(--coral)";

                const knownContact = contacts.find(
                  (c) => c.address === otherAddr
                );
                const avatarBg = knownContact
                  ? knownContact.color
                  : incoming
                  ? "var(--mint-dim)"
                  : "var(--coral-dim)";
                const avatarText = knownContact
                  ? initials(knownContact.name)
                  : (otherAddr || "").slice(0, 2).toUpperCase();

                // Status badge
                const statusBadge = p.contractStatus
                  ? p.contractStatus === "Completed"
                    ? <span className="status-badge success">✓ Confirmed</span>
                    : p.contractStatus === "Failed"
                    ? <span className="status-badge fail">✕ Failed</span>
                    : <span className="status-badge pending">⏳ Pending</span>
                  : null;

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
                      <div className="tx-title" style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                        {incoming ? "Received from" : "Sent to"}{" "}
                        {knownContact ? (
                          <span style={{ color: knownContact.color }}>{knownContact.name}</span>
                        ) : (
                          shorten(otherAddr)
                        )}
                        {statusBadge}
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
          <p>Connect your wallet to get started.</p>
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

      {/* ─── WALLET MODAL ─── */}
      {showWalletModal && (
        <div className="modal-overlay" onClick={() => setShowWalletModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Pilih Wallet</h2>
              <button className="modal-close" onClick={() => setShowWalletModal(false)}>
                <IconClose />
              </button>
            </div>
            <div className="modal-subtitle">
              Connect wallet Stellar untuk mulai transaksi
            </div>
            <div className="wallet-list">
              <WalletItem
                name="Freighter"
                desc="Browser extension — paling populer"
                detected={detectedWallets.includes("freighter")}
                icon="🦅"
                onClick={handleConnect}
              />
              <WalletItem
                name="LOBSTR"
                desc="Mobile + extension wallet"
                detected={detectedWallets.includes("lobstr")}
                icon="🦞"
                onClick={handleConnect}
              />
              <WalletItem
                name="xBull"
                desc="Browser extension — multi-chain"
                detected={detectedWallets.includes("xbull")}
                icon="🐂"
                onClick={handleConnect}
              />
              <WalletItem
                name="WalletConnect"
                desc="QR code — scan dari mobile wallet"
                detected={true}
                icon="📱"
                onClick={() => showToast("WalletConnect coming soon")}
              />
            </div>
            <div className="modal-footer">
              Belum punya wallet?{" "}
              <a
                href="https://stellar.org/developers/wallets"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--mint)" }}
              >
                Pelajari lebih lanjut
              </a>
            </div>
          </div>
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
