"use client";
import { useEffect, useState } from "react";

const STEPS = [
  "Checking this flight isn't already in trouble",
  "Writing your policy on-chain",
];

export function RegistrationProgress() {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const currentIndex = elapsed < 20 ? 0 : 1;

  return (
    <div className="progress-steps" style={{ marginTop: 10 }}>
      {STEPS.map((label, i) => (
        <div
          key={label}
          className={`progress-step ${i < currentIndex ? "done" : i === currentIndex ? "current" : ""}`}
        >
          <span className="progress-dot" />
          {label}
        </div>
      ))}
    </div>
  );
}
