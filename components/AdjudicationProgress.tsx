"use client";
import { useEffect, useState } from "react";

const STEPS = [
  { label: "Fetching the official flight record", after: 0 },
  { label: "Validators reconciling your claim", after: 45 },
  { label: "Reaching consensus and writing the verdict", after: 150 },
];

export function AdjudicationProgress() {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const currentIndex = STEPS.reduce((idx, step, i) => (elapsed >= step.after ? i : idx), 0);

  return (
    <div>
      <div className="progress-steps">
        {STEPS.map((step, i) => (
          <div
            key={step.label}
            className={`progress-step ${i < currentIndex ? "done" : i === currentIndex ? "current" : ""}`}
          >
            <span className="progress-dot" />
            {step.label}
          </div>
        ))}
      </div>
      <p className="hint" style={{ marginTop: 8 }}>
        Usually takes 3–5 minutes. Timings are approximate — this reflects a typical pace, not a live status feed.
      </p>
    </div>
  );
}