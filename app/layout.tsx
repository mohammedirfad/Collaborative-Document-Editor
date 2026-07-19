import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "House of Edtech Local-First Editor",
  description: "Offline-first collaborative editor with deterministic sync and granular versions."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
