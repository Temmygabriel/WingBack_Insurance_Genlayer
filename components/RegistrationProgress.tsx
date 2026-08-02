"use client";
import { useEffect, useState } from "react";

export function RegistrationProgress() {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="progress-steps" style={{ marginTop: 10 }}>
      <div className="progress-step current">
        <span className="progress-dot" />
        Registering…
      </div>
      <p className="hint" style={{ marginTop: 8 }}>
        {elapsed < 8
          ? "Usually instant for flights booked a few days out or more."
          : "This flight is close enough that the contract is checking its live status before selling coverage — this can take a few minutes for near-term flights."}
      </p>
    </div>
  );
}
