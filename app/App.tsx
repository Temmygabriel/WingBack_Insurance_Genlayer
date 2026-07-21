"use client";
import { useEffect, useRef, useState } from "react";
import {
  makeAccount,
  buyPolicy,
  adjudicateFlight,
  getPoliciesForHolder,
} from "../lib/contract";
import type { Policy } from "../types";
import { BuyForm } from "../components/BuyForm";
import { PolicyCard } from "../components/PolicyCard";
import { AccountView } from "../components/AccountView";

const POLL_INTERVAL = 8000;
type Tab = "register" | "policies" | "account";

export default function App() {
  const accountRef = useRef<ReturnType<typeof makeAccount> | null>(null);
  const addressRef = useRef<string>("");
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const adjudicatingRef = useRef<Set<string>>(new Set());

  const [tab, setTab] = useState<Tab>("register");
  const [address, setAddress] = useState<string>("");
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loadingPolicies, setLoadingPolicies] = useState(true);
  const [buying, setBuying] = useState(false);
  const [adjudicatingIds, setAdjudicatingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string>("");

  const [flightNumber, setFlightNumber] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [premium, setPremium] = useState("1");

  useEffect(() => {
    let acc: ReturnType<typeof makeAccount>;
    const savedKey = localStorage.getItem("wingback_private_key");

    try {
      if (savedKey && savedKey !== "undefined" && savedKey !== "null" && savedKey.startsWith("0x")) {
        acc = makeAccount(savedKey as `0x${string}`);
      } else {
        if (savedKey !== null) {
          localStorage.removeItem("wingback_private_key");
          localStorage.removeItem("wingback_address");
        }
        acc = makeAccount();
        localStorage.setItem("wingback_private_key", acc.privateKey);
      }
    } catch {
      localStorage.removeItem("wingback_private_key");
      localStorage.removeItem("wingback_address");
      acc = makeAccount();
      localStorage.setItem("wingback_private_key", acc.privateKey);
    }

    accountRef.current = acc;
    addressRef.current = acc.address;
    localStorage.setItem("wingback_address", acc.address);
    setAddress(acc.address);
  }, []);

  async function refreshPolicies() {
    if (!addressRef.current) return;
    try {
      const list = await getPoliciesForHolder(addressRef.current);
      setPolicies(list);
    } catch {
      setPolicies([]);
    } finally {
      setLoadingPolicies(false);
    }
  }

  useEffect(() => {
    if (!address) return;
    refreshPolicies();
    pollTimerRef.current = setInterval(refreshPolicies, POLL_INTERVAL);
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [address]);

  async function handleBuyPolicy(e: React.FormEvent) {
    e.preventDefault();
    if (!accountRef.current || buying) return;
    setError("");
    setBuying(true);
    try {
      const departureTs = Math.floor(new Date(departureDate).getTime() / 1000);
      await buyPolicy(accountRef.current, flightNumber.trim().toUpperCase(), departureDate, departureTs, premium);
      setFlightNumber("");
      await refreshPolicies();
      setTab("policies");
    } catch (err: any) {
      setError(
        err?.message
          ? `Registration failed — the network rejected this transaction. ${err.message}`
          : "Registration failed — the network rejected this transaction. Check the flight number and try again."
      );
    } finally {
      setBuying(false);
    }
  }

  async function handleAdjudicate(policyId: string, narrative: string) {
    if (!accountRef.current || adjudicatingRef.current.has(policyId)) return;
    adjudicatingRef.current.add(policyId);
    setAdjudicatingIds(new Set(adjudicatingRef.current));
    setError("");
    try {
      await adjudicateFlight(accountRef.current, policyId, narrative);
      await refreshPolicies();
    } catch {
      setError("Adjudication is taking longer than expected. It may still land on-chain — refresh in a minute.");
    } finally {
      adjudicatingRef.current.delete(policyId);
      setAdjudicatingIds(new Set(adjudicatingRef.current));
    }
  }

  return (
    <div className="container page-pad">
      <header style={{ marginBottom: 28, display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 36, marginBottom: 8 }}>Wingback</h1>
          <p style={{ color: "var(--ink-2)", maxWidth: "48ch", lineHeight: 1.6, fontSize: 14 }}>
            Register a flight, file a claim after it lands, and let GenLayer's validators reconcile
            your account against the official record — independently, with the reasoning kept on-chain.
          </p>
        </div>

        <nav className="tab-bar">
          <button className={`tab-btn ${tab === "register" ? "active" : ""}`} onClick={() => setTab("register")}>
            Register
          </button>
          <button className={`tab-btn ${tab === "policies" ? "active" : ""}`} onClick={() => setTab("policies")}>
            My Flights{policies.length > 0 ? ` (${policies.length})` : ""}
          </button>
          <button className={`tab-btn ${tab === "account" ? "active" : ""}`} onClick={() => setTab("account")}>
            Account
          </button>
        </nav>
      </header>

      {error && <div className="banner banner-error" style={{ marginBottom: 20 }}>{error}</div>}

      {tab === "register" && (
        <BuyForm
          flightNumber={flightNumber}
          departureDate={departureDate}
          premium={premium}
          buying={buying}
          onFlightNumberChange={setFlightNumber}
          onDepartureDateChange={setDepartureDate}
          onPremiumChange={setPremium}
          onSubmit={handleBuyPolicy}
        />
      )}

      {tab === "policies" && (
        <div>
          {loadingPolicies && <p className="hint">Loading…</p>}

          {!loadingPolicies && policies.length === 0 && (
            <div className="card">
              <div className="empty-state">
                No flights registered yet.{" "}
                <button className="tab-btn active" style={{ padding: "4px 12px" }} onClick={() => setTab("register")}>
                  Register one
                </button>
              </div>
            </div>
          )}

          {policies.length > 0 && (
            <div className="card">
              {policies.map((p) => (
                <PolicyCard
                  key={p.policy_id}
                  policy={p}
                  onCheck={handleAdjudicate}
                  checking={adjudicatingIds.has(p.policy_id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "account" && <AccountView address={address} policies={policies} />}
    </div>
  );
}