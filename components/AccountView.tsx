"use client";
import { useEffect, useState } from "react";
import { fromRawUnits, getContractBalance, getTotalOutstandingExposure, getReserveDepositedTotal } from "../lib/contract";
import { POLICY_STATUS } from "../types";
import type { Policy } from "../types";
import { isMetaMaskAvailable } from "../lib/wallet";

export function AccountView({
  address,
  privateKey,
  accountMode,
  walletError,
  connectingWallet,
  policies,
  onImport,
  onConnectWallet,
  onDisconnectWallet,
}: {
  address: string;
  privateKey: string;
  accountMode: "burner" | "wallet";
  walletError: string;
  connectingWallet: boolean;
  policies: Policy[];
  onImport: (key: string) => void;
  onConnectWallet: () => void;
  onDisconnectWallet: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [keyRevealed, setKeyRevealed] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);
  const [importValue, setImportValue] = useState("");
  const [importError, setImportError] = useState("");
  const [poolBalance, setPoolBalance] = useState<string | null>(null);
  const [poolExposure, setPoolExposure] = useState<string | null>(null);
  const [poolReserveDeposited, setPoolReserveDeposited] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadPoolStats() {
      try {
        const [balance, exposure, deposited] = await Promise.all([
          getContractBalance(),
          getTotalOutstandingExposure(),
          getReserveDepositedTotal(),
        ]);
        if (!cancelled) {
          setPoolBalance(balance);
          setPoolExposure(exposure);
          setPoolReserveDeposited(deposited);
        }
      } catch {
        // silent — pool stats are supplementary, not critical to the page
      }
    }
    loadPoolStats();
    const timer = setInterval(loadPoolStats, 8000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const isWallet = accountMode === "wallet";

  function handleCopy() {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function handleCopyKey() {
    navigator.clipboard.writeText(privateKey);
    setKeyCopied(true);
    setTimeout(() => setKeyCopied(false), 1500);
  }

  function handleImportSubmit(e: React.FormEvent) {
    e.preventDefault();
    setImportError("");
    const trimmed = importValue.trim();
    if (!trimmed.startsWith("0x") || trimmed.length !== 66) {
      setImportError("That doesn't look like a valid private key — it should start with 0x and be 66 characters long.");
      return;
    }
    onImport(trimmed);
  }

  const totalPremium = policies.reduce((sum, p) => sum + Number(fromRawUnits(p.premium)), 0);
  const paidCount = policies.filter((p) => p.status === POLICY_STATUS.PAID).length;

  return (
    <div>
      <div className="account-hero">
        <p className="card-label" style={{ marginBottom: 10 }}>
          {isWallet ? "Connected wallet" : "This browser's wallet"}
        </p>

        <div className="account-address">
          <span style={{ flex: 1 }}>{address || "Setting up…"}</span>
          <button className="icon-btn" onClick={handleCopy} disabled={!address}>
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        <p className="hint" style={{ marginTop: 12, lineHeight: 1.6 }}>
          {isWallet
            ? "This account is signed through your connected wallet — every transaction will prompt approval there."
            : "Generated automatically the first time you visited, stored only on this device. On studionet no funding step is needed — it's ready to use immediately."}
        </p>

        <div className="account-stats">
          <div className="account-stat">
            <div className="account-stat-value mono">{policies.length}</div>
            <div className="account-stat-label">Flights registered</div>
          </div>
          <div className="account-stat">
            <div className="account-stat-value mono">{paidCount}</div>
            <div className="account-stat-label">Claims paid</div>
          </div>
          <div className="account-stat">
            <div className="account-stat-value mono">{totalPremium}</div>
            <div className="account-stat-label">GEN in premiums</div>
          </div>
        </div>
      </div>

      {/* ── Pool health — real balance, outstanding exposure, deposited reserve ── */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header">
          <span className="card-label">Pool health</span>
        </div>
        <div className="card-body">
          <p className="hint" style={{ marginBottom: 12, lineHeight: 1.6 }}>
            The contract will never sell a policy whose worst-case payout would push outstanding
            exposure past its real balance — this is what backs that guarantee.
          </p>
          <div className="account-stats">
            <div className="account-stat">
              <div className="account-stat-value mono">
                {poolBalance !== null ? fromRawUnits(poolBalance) : "…"}
              </div>
              <div className="account-stat-label">Contract balance (GEN)</div>
            </div>
            <div className="account-stat">
              <div className="account-stat-value mono">
                {poolExposure !== null ? fromRawUnits(poolExposure) : "…"}
              </div>
              <div className="account-stat-label">Outstanding exposure (GEN)</div>
            </div>
            <div className="account-stat">
              <div className="account-stat-value mono">
                {poolReserveDeposited !== null ? fromRawUnits(poolReserveDeposited) : "…"}
              </div>
              <div className="account-stat-label">Reserve deposited (GEN)</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Wallet connect / disconnect ── */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header">
          <span className="card-label">
            {isWallet ? "Wallet connection" : "Use your own wallet"}
          </span>
        </div>
        <div className="card-body">
          {isWallet ? (
            <>
              <p className="hint" style={{ marginBottom: 12, lineHeight: 1.6 }}>
                You're signing with a connected browser wallet instead of this browser's
                auto-generated account.
              </p>
              <button className="btn btn-secondary btn-sm" onClick={onDisconnectWallet}>
                Disconnect &amp; use browser account
              </button>
            </>
          ) : (
            <>
              <p className="hint" style={{ marginBottom: 12, lineHeight: 1.6 }}>
                Connect MetaMask (or a compatible wallet) to sign transactions from your own
                address instead of this browser's auto-generated one. This will add or switch
                to the GenLayer Studio Network in your wallet if needed.
              </p>
              {!isMetaMaskAvailable() && (
                <p className="banner banner-info" style={{ marginBottom: 12 }}>
                  No wallet was detected in this browser. Install MetaMask (or a compatible
                  wallet extension) to use this option — the auto-generated account above works
                  fine without it.
                </p>
              )}
              <button
                className="btn btn-primary btn-sm"
                onClick={onConnectWallet}
                disabled={connectingWallet || !isMetaMaskAvailable()}
              >
                {connectingWallet && <span className="spinner" style={{ width: 14, height: 14 }} />}
                {connectingWallet ? "Connecting…" : "Connect Wallet"}
              </button>
              {walletError && (
                <p className="hint" style={{ color: "var(--red-2)", marginTop: 8 }}>{walletError}</p>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Private key reveal — only meaningful for the local burner account ── */}
      {!isWallet && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-header">
            <span className="card-label">Use this account on another device</span>
          </div>
          <div className="card-body">
            <p className="hint" style={{ marginBottom: 12, lineHeight: 1.6 }}>
              This wallet only exists in this browser. To see the same flights somewhere else — another
              browser, another device, or after clearing site data — export the private key below and
              import it there.
            </p>
            <p className="banner banner-info" style={{ marginBottom: 12 }}>
              Anyone with this key can act as this account. On studionet that's low-stakes, since GEN
              here has no real value — but treat it like a real secret regardless.
            </p>
            {!keyRevealed && (
              <button className="btn btn-secondary btn-sm" onClick={() => setKeyRevealed(true)}>
                Reveal private key
              </button>
            )}
            {keyRevealed && (
              <div className="account-address">
                <span className="mono" style={{ flex: 1, wordBreak: "break-all" }}>{privateKey}</span>
                <button className="icon-btn" onClick={handleCopyKey}>
                  {keyCopied ? "Copied" : "Copy"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Import account — only meaningful for the local burner account ── */}
      {!isWallet && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-header">
            <span className="card-label">Import an account</span>
          </div>
          <div className="card-body">
            <p className="hint" style={{ marginBottom: 12, lineHeight: 1.6 }}>
              Paste a private key exported from another browser to switch this browser to that account.
              This replaces the account currently in use here.
            </p>
            <form onSubmit={handleImportSubmit} style={{ display: "flex", gap: 8 }}>
              <input
                className="input mono"
                placeholder="0x…"
                value={importValue}
                onChange={(e) => setImportValue(e.target.value)}
                style={{ flex: 1 }}
              />
              <button className="btn btn-dark btn-sm" type="submit">Import</button>
            </form>
            {importError && <p className="hint" style={{ color: "var(--red-2)", marginTop: 8 }}>{importError}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
