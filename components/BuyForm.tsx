"use client";
import { RegistrationProgress } from "./RegistrationProgress";

export function BuyForm({
  flightNumber,
  departureDate,
  premium,
  buying,
  onFlightNumberChange,
  onDepartureDateChange,
  onPremiumChange,
  onSubmit,
}: {
  flightNumber: string;
  departureDate: string;
  premium: string;
  buying: boolean;
  onFlightNumberChange: (v: string) => void;
  onDepartureDateChange: (v: string) => void;
  onPremiumChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  // Today's date, local time, as YYYY-MM-DD — the date input's floor. No
  // point letting anyone pick a flight that's already happened; the
  // contract's live pre-purchase check would catch it anyway (a departed
  // flight already has a concluded status), but this stops the confusing
  // UX of it being selectable at all.
  const todayStr = new Date().toISOString().split("T")[0];

  return (
    <form className="card" onSubmit={onSubmit}>
      <div className="card-header">
        <span className="card-label">Register a flight</span>
      </div>
      <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div className="field" style={{ flex: "1 1 160px" }}>
            <span className="label">Flight number</span>
            <input
              className="input mono"
              placeholder="BA178"
              value={flightNumber}
              onChange={(e) => onFlightNumberChange(e.target.value)}
              required
              disabled={buying}
            />
          </div>
          <div className="field" style={{ flex: "1 1 160px" }}>
            <span className="label">Departure date</span>
            <input
              className="input"
              type="date"
              value={departureDate}
              onChange={(e) => onDepartureDateChange(e.target.value)}
              min={todayStr}
              required
              disabled={buying}
            />
          </div>
          <div className="field" style={{ flex: "0 1 120px" }}>
            <span className="label">Premium (GEN)</span>
            <input
              className="input mono"
              type="number"
              step="any"
              min="0.01"
              value={premium}
              onChange={(e) => onPremiumChange(e.target.value)}
              required
              disabled={buying}
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={buying}>
            {buying && <span className="spinner" style={{ width: 14, height: 14 }} />}
            {buying ? "Registering…" : "Register flight"}
          </button>
        </div>

        {buying ? (
          <RegistrationProgress />
        ) : (
          <p className="hint">
            Before selling coverage, the contract checks whether this flight is already showing
            trouble. That check only finds anything for near-term flights — advance bookings
            register instantly.
          </p>
        )}
      </div>
    </form>
  );
}
