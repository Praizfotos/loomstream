import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Loomstream",
  description: "Token streaming and vesting primitive for Stellar Soroban",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}