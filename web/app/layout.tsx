import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Polaris",
  description: "Every reader needs a north star.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
