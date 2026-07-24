"use client";
import { useEffect, useRef, useState } from "react";
import {
  makeAccount,
  buyPolicy,
  adjudicateFlight,
  getPoliciesForHolder,
} from "../lib/contract";
import type { Policy } from "../types";
import { POLICY_STATUS } from "../types";
import { BuyForm } from "../components/BuyForm";
import { PolicyCard } from "../components/PolicyCard";
import { AccountView } from "../components/AccountView";
import { HowItWorks } from "../components/HowItWorks";
import { Logo } from "../components/Logo";

const POLL_INTERVAL = 8000;
type Tab = "register" | "policies" | "account";
type FlightFilter = "active" | "resolved";

function shortAddress(addr: string) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function App() {
  const accountRef = useRef<ReturnType<typeof makeAccount> | null>(null);
  const addressRef = useRef<string>("");
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const adjudicatingRef = useRef<Set<string>>(new Set());
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [tab, setTab] = useState<Tab>("register");
  const [flightFilter, setFlightFilter] = useState<FlightFilter>("active");
  const [address, setAddress] = useState<string>("");
  const [privateKey, setPrivateKey] = useState<string>("");
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loadingPolicies, setLoadingPolicies] = useState(true);
  const [buying, setBuying] = useState(false);
  const [adjudicatingIds, setAdjudicatingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string>("");
  const [toast, setToast] = useState<string>("");

  const [flightNumber, setFlightNumber] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [premium, setPremium] = useState("1");

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(""), 5000);
  }

  function loadAccount(forcedKey?: `0x${string}`) {
    let acc: ReturnType<typeof makeAccount>;
    const savedKey = forcedKey || (localStorage.getItem("wingback_private_key") as `0x${string}` | null);

    try {
      if (savedKey && savedKey !== "undefined" && savedKey !== "null" && savedKey.startsWith("0x")) {
        acc = makeAccount(savedKey);
      } else {
        acc = makeAccount();
      }
    } catch {
      acc = makeAccount();
    }

    localStorage.setItem("wingback_private_key", acc.privateKey);
    localStorage.setItem("wingback_address", acc.address);
    accountRef.current = acc;
    addressRef.current = acc.address;
    setAddress(acc.address);
    setPrivateKey(acc.privateKey);
    setLoadingPolicies(true);
    setPolicies([]);
    return acc;
  }

  function handleImportAccount(key: string) {
    loadAccount(key as `0x${string}`);
    setTab("policies");
    setFlightFilter("active");
    showToast("Account imported. Loading its flights…");
  }

  useEffect(() => {
    loadAccount();
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
      setFlightFilter("active");
      showToast("Flight registered. File a claim once it's landed.");
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
      setFlightFilter("resolved");
      showToast("Claim reconciled. See the verdict below.");
    } catch {
      setError("Adjudication is taking longer than expected. It may still land on-chain — refresh in a minute.");
    } finally {
      adjudicatingRef.current.delete(policyId);
      setAdjudicatingIds(new Set(adjudicatingRef.current));
    }
  }

  const activeFlights = policies.filter((p) => p.status === POLICY_STATUS.ACTIVE);
  const resolvedFlights = policies.filter((p) => p.status !== POLICY_STATUS.ACTIVE);
  const shownFlights = flightFilter === "active" ? activeFlights : resolvedFlights;

  const PAGE_COPY: Record<Tab, { title: string; sub: string }> = {
    register: {
      title: "Register a flight",
      sub: "Pay a small GEN premium to open a claim window for a flight. Nothing else happens until you file a claim after it lands.",
    },
    policies: {
      title: "My Flights",
      sub: "Everything you've registered, and the verdict once a claim has been reconciled.",
    },
    account: {
      title: "Account",
      sub: "Your studionet wallet, generated locally in this browser.",
    },
  };

  return (
    <div className="container page-pad">
      <div className="app-topbar">
        <div className="app-topbar__brand">
          <Logo size={22} />
          <span>Wingback</span>
        </div>
        <nav className="tab-bar">
          <button className={`tab-btn ${tab === "register" ? "active" : ""}`} onClick={() => setTab("register")}>
            Register
          </button>
          <button className={`tab-btn ${tab === "policies" ? "active" : ""}`} onClick={() => setTab("policies")}>
            My Flights{policies.length > 0 ? ` (${policies.length})` : ""}
          </button>
        </nav>
        <button className="app-topbar__account" onClick={() => setTab("account")}>
          {shortAddress(address) || "Setting up…"}
        </button>
      </div>

      {toast && <div className="toast">{toast}</div>}
      {error && <div className="banner banner-error" style={{ marginBottom: 20 }}>{error}</div>}

      <div className="page-header">
        <h2>{PAGE_COPY[tab].title}</h2>
        <p>{PAGE_COPY[tab].sub}</p>
      </div>

      {tab === "register" && (
        <>
          <HowItWorks />
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
        </>
      )}

      {tab === "policies" && (
        <div>
          <div className="chip-row">
            <button
              className={`chip ${flightFilter === "active" ? "active" : ""}`}
              onClick={() => setFlightFilter("active")}
            >
              Awaiting claim ({activeFlights.length})
            </button>
            <button
              className={`chip ${flightFilter === "resolved" ? "active" : ""}`}
              onClick={() => setFlightFilter("resolved")}
            >
              Resolved ({resolvedFlights.length})
            </button>
          </div>

          {loadingPolicies && <p className="hint">Loading…</p>}

          {!loadingPolicies && shownFlights.length === 0 && (
            <div className="card">
              <div className="empty-state">
                {flightFilter === "active"
                  ? "No flights awaiting a claim right now."
                  : "No resolved claims yet."}
              </div>
            </div>
          )}

          {shownFlights.length > 0 && (
            <div className="card">
              {shownFlights.map((p) => (
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

      {tab === "account" && (
        <AccountView address={address} privateKey={privateKey} policies={policies} onImport={handleImportAccount} />
      )}
    </div>
  );
}