const STEPS = [
  "Register a flight with a small GEN premium",
  "Wait for it to land",
  "File a claim describing what happened",
  "Validators reconcile it against the official record and reach consensus",
];

export function HowItWorks() {
  return (
    <div className="how-it-works">
      {STEPS.map((label, i) => (
        <div className="how-step" key={i}>
          <div className="how-step-num">{String(i + 1).padStart(2, "0")}</div>
          <div className="how-step-label">{label}</div>
        </div>
      ))}
    </div>
  );
}