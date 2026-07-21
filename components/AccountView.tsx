"use client";
import { useState } from "react";
import { fromRawUnits } from "../lib/contract";
import { POLICY_STATUS } from "../types";
import type { Policy } from "../types";

export function AccountView({ address, policies }: { address: string; policies: Policy[] }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const totalPremium = policies.reduce((sum, p) => sum + Number(fromRawUnits(p.premium)), 0);
  const paidCount = policies.filter((p) => p.status === POLICY_STATUS.PAID).length;

  return (
    <div className="account-hero">
      <p className="card-label" style={{ marginBottom: 10 }}>Your account</p>
      <h2 style={{ fontSize: 26, marginBottom: 16 }}>Studionet wallet</h2>

      <div className="account-address">
        <span style={{ flex: 1 }}>{address || "Setting up…"}</span>
        <button className="icon-btn" onClick={handleCopy} disabled={!address}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <p className="hint" style={{ marginTop: 12, lineHeight: 1.6 }}>
        This account was generated automatically in your browser the first time you visited, and is
        stored only on this device. On GenLayer's free studionet, no funding step is needed — it's
        ready to use immediately.
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
  );
}