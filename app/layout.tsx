import type { Metadata } from "next";
import "../globals.css";

export const metadata: Metadata = {
  title: "Wingback — Flight Delay Adjudication",
  description: "Decentralized, AI-adjudicated proof of flight delay, verified on GenLayer.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
