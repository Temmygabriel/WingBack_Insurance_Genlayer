export function Logo({ size = 28, color = "#9FE1CB" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size * 0.7} viewBox="0 0 100 70" aria-hidden="true">
      <path
        d="M8,58 C22,26 48,10 82,14 L60,46 L94,12"
        fill="none"
        stroke={color}
        strokeWidth="11"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}