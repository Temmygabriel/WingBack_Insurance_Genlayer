"use client";

const COLORS: Record<string, string> = {
  active: "var(--amber)",
  not_delayed: "var(--teal)",
  paid: "var(--teal)",
  delayed_unfunded: "var(--red)",
  unresolved: "var(--text-muted)",
};

export function SplitFlap({
  text,
  tone = "default",
  size = 15,
}: {
  text: string;
  tone?: string;
  size?: number;
}) {
  const chars = text.toUpperCase().split("");
  const color = COLORS[tone] || "var(--text)";

  return (
    <span className="flap-row" aria-label={text}>
      {chars.map((c, i) => (
        <span
          key={`${text}-${i}`}
          className="flap-tile"
          style={{
            fontSize: size,
            color,
            animationDelay: `${i * 0.035}s`,
          }}
        >
          {c === " " ? "\u00A0" : c}
        </span>
      ))}
    </span>
  );
}
