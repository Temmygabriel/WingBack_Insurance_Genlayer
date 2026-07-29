export function WalletIcon({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 7.5C3 6.11929 4.11929 5 5.5 5H17C18.1046 5 19 5.89543 19 7V7.5"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M3 7.5V17C3 18.1046 3.89543 19 5 19H19C20.1046 19 21 18.1046 21 17V10C21 8.89543 20.1046 8 19 8H5C3.89543 8 3 8.89543 3 7.5Z"
        stroke={color}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="16.5" cy="13.5" r="1.25" fill={color} />
    </svg>
  );
}
