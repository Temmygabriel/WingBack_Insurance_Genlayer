"use client";

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
  return (
    <form className="card" onSubmit={onSubmit}>
      <div className="card-header">
        <span className="card-label">Register a flight</span>
      </div>
      <div className="card-body" style={{ display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div className="field" style={{ flex: "1 1 160px" }}>
          <span className="label">Flight number</span>
          <input
            className="input mono"
            placeholder="BA178"
            value={flightNumber}
            onChange={(e) => onFlightNumberChange(e.target.value)}
            required
          />
        </div>
        <div className="field" style={{ flex: "1 1 160px" }}>
          <span className="label">Departure date</span>
          <input
            className="input"
            type="date"
            value={departureDate}
            onChange={(e) => onDepartureDateChange(e.target.value)}
            required
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
          />
        </div>
        <button className="btn btn-primary" type="submit" disabled={buying}>
          {buying && <span className="spinner" style={{ width: 14, height: 14 }} />}
          {buying ? "Registering…" : "Register flight"}
        </button>
      </div>
    </form>
  );
}