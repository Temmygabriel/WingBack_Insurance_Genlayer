"use client";
import { useEffect, useRef, useState } from "react";
import {
  makeAccount,
  buyPolicy,
  adjudicateFlight,
  getPoliciesForHolder,
  addressOf,
} from "../lib/contract";
import type { SigningAccount } from "../lib/contract";
import { connectMetaMaskWallet } from "../lib/wallet";
import type { Policy } from "../types";
import { POLICY_STATUS } from "../types";
import { BuyForm } from "../components/BuyForm";
import { PolicyCard } from "../components/PolicyCard";
import { AccountView } from "../components/AccountView";
import { HowItWorks } from "../components/HowItWorks";
import { Logo } from "../components/Logo";
import { WalletIcon } from "../components/WalletIcon";

const POLL_INTERVAL = 8000;
type Tab = "register" | "policies" | "account";
type FlightFilter = "active" | "resolved";
type AccountMode = "burner" | "wallet";

function shortAddress(addr: string) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function App() {
  const accountRef = useRef<SigningAccount | null>(null);
  const burnerAccountRef = useRef<ReturnType<typeof makeAccount> | null>(null);
  const addressRef = useRef<string>("");
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const adjudicatingRef = useRef<Set<string>>(new Set());
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [tab, setTab] = useState<Tab>("register");
  const [flightFilter, setFlightFilter] = useState<FlightFilter>("active");
  const [accountMode, setAccountMode] = useState<AccountMode>("burner");
  const [address, setAddress] = useState<string>("");
  const [privateKey, setPrivateKey] = useState<string>(""); // only meaningful in burner mode
  const [walletError, setWalletError] = useState<string>("");
  const [connectingWallet, setConnectingWallet] = useState(false);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loadingPolicies, setLoadingPolicies] = useState(true);
  const [buying, setBuying] = useState(false);
  const [adjudicatingIds, setAdjudicatingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string>("");

  function changeTab(next: Tab) {
    setError("");
    setTab(next);
  }
  const [toast, setToast] = useState<string>("");

  const [flightNumber, setFlightNumber] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [premium, setPremium] = useState("1");

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(""), 5000);
  }

  function loadBurnerAccount(forcedKey?: `0x${string}`) {
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
    burnerAccountRef.current = acc;
    accountRef.current = acc;
    addressRef.current = acc.address;
    setAccountMode("burner");
    setAddress(acc.address);
    setPrivateKey(acc.privateKey);
    setLoadingPolicies(true);
    setPolicies([]);
    return acc;
  }

  function handleImportAccount(key: string) {
    loadBurnerAccount(key as `0x${string}`);
    changeTab("policies");
    setFlightFilter("active");
    showToast("Account imported. Loading its flights…");
  }

  async function handleConnectWallet() {
    setWalletError("");
    setConnectingWallet(true);
    try {
      const walletAddress = await connectMetaMaskWallet();
      accountRef.current = walletAddress as `0x${string}`;
      addressRef.current = walletAddress;
      setAccountMode("wallet");
      setAddress(walletAddress);
      setPrivateKey(""); // no private key to show for a wallet-signed account
      setLoadingPolicies(true);
      setPolicies([]);
      showToast("Wallet connected. Loading its flights…");
    } catch (err: any) {
      setWalletError(err?.message || "Could not connect the wallet. Please try again.");
    } finally {
      setConnectingWallet(false);
    }
  }

  function handleDisconnectWallet() {
    // Falls back to the existing browser-generated burner account.
    if (burnerAccountRef.current) {
      accountRef.current = burnerAccountRef.current;
      addressRef.current = burnerAccountRef.current.address;
      setAccountMode("burner");
      setAddress(burnerAccountRef.current.address);
      setPrivateKey(burnerAccountRef.current.privateKey);
    } else {
      loadBurnerAccount();
    }
    setLoadingPolicies(true);
    setPolicies([]);
    showToast("Disconnected. Back to this browser's local account.");
  }

  useEffect(() => {
    loadBurnerAccount();
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
      changeTab("policies");
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
      const hash = await adjudicateFlight(accountRef.current, policyId, narrative);
      localStorage.setItem(`wingback_payout_tx:${policyId}`, hash);
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
      sub: "Pay a small GEN premium to open a claim window for a flight. The contract checks the flight isn't already in trouble before selling coverage.",
    },
    policies: {
      title: "My Flights",
      sub: "Everything you've registered, and the verdict once a claim has been reconciled.",
    },
    account: {
      title: "Account",
      sub:
        accountMode === "wallet"
          ? "Connected via your browser wallet."
          : "Your studionet wallet, generated locally in this browser.",
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
          <button className={`tab-btn ${tab === "register" ? "active" : ""}`} onClick={() => changeTab("register")}>
            Register
          </button>
          <button className={`tab-btn ${tab === "policies" ? "active" : ""}`} onClick={() => changeTab("policies")}>
            My Flights{policies.length > 0 ? ` (${policies.length})` : ""}
          </button>
        </nav>
        <div className="app-topbar__actions">
          {accountMode === "burner" && (
            <button
              className="app-topbar__connect-btn"
              onClick={handleConnectWallet}
              disabled={connectingWallet}
              title="Connect a browser wallet like MetaMask"
            >
              {connectingWallet ? (
                <span className="spinner" style={{ width: 13, height: 13 }} />
              ) : (
                <WalletIcon size={15} />
              )}
              {connectingWallet ? "Connecting…" : "Connect Wallet"}
            </button>
          )}
          <button
            className="app-topbar__account"
            onClick={() => changeTab("account")}
            title={accountMode === "wallet" ? "Connected wallet — view account" : "Guest account — view account & connect a wallet"}
          >
            <span className={`app-topbar__account-dot app-topbar__account-dot--${accountMode}`} />
            <WalletIcon size={14} />
            <span>{shortAddress(address) || "Setting up…"}</span>
            <span className="app-topbar__account-tag">
              {accountMode === "wallet" ? "Wallet" : "Guest"}
            </span>
          </button>
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}
      {error && (
        <div
          className="banner banner-error"
          style={{ marginBottom: 20, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}
        >
          <span>{error}</span>
          <button
            onClick={() => setError("")}
            aria-label="Dismiss"
            style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: 16, lineHeight: 1, flexShrink: 0, padding: 0 }}
          >
            ×
          </button>
        </div>
      )}

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
        <AccountView
          address={address}
          privateKey={privateKey}
          accountMode={accountMode}
          walletError={walletError}
          connectingWallet={connectingWallet}
          policies={policies}
          onImport={handleImportAccount}
          onConnectWallet={handleConnectWallet}
          onDisconnectWallet={handleDisconnectWallet}
        />
      )}
    </div>
  );
}
