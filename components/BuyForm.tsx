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
    <form className="ticket" onSubmit={onSubmit}>
      <div className="ticket__stub">
        <span className="ticket__eyebrow">Register a flight</span>
        <div className="ticket__row">
          <label className="ticket__field">
            <span>Flight number</span>
            <input
              className="mono"
              placeholder="BA178"
              value={flightNumber}
              onChange={(e) => onFlightNumberChange(e.target.value)}
              required
            />
          </label>
          <label className="ticket__field">
            <span>Departure date</span>
            <input
              className="mono"
              type="date"
              value={departureDate}
              onChange={(e) => onDepartureDateChange(e.target.value)}
              required
            />
          </label>
        </div>
      </div>

      <div className="ticket__perforation" aria-hidden="true" />

      <div className="ticket__coupon">
        <label className="ticket__field">
          <span>Premium (GEN)</span>
          <input
            className="mono"
            type="number"
            step="0.1"
            min="0.01"
            value={premium}
            onChange={(e) => onPremiumChange(e.target.value)}
            required
          />
        </label>
        <button className="btn btn--primary" type="submit" disabled={buying}>
          {buying ? "Registering…" : "Register flight"}
        </button>
      </div>
    </form>
  );
}
