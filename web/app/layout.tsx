import type { Metadata } from "next";
import "./globals.css";
import { auth, signOut } from "@/lib/auth";
import Link from "next/link";
import { Logo } from "@/components/Logo";

export const metadata: Metadata = {
  title: "Polaris",
  description: "Every reader needs a north star.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&family=Lexend:wght@400;600&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen bg-peach text-ink" style={{ fontFamily: "'Atkinson Hyperlegible', Verdana, sans-serif" }}>
        <header className="sticky top-0 z-10 bg-peach/90 backdrop-blur">
          <nav className="max-w-4xl mx-auto px-6 h-16 flex items-center gap-6">
            <Link href="/" className="inline-block">
              <Logo className="text-2xl" />
            </Link>
            {session && (
              <div className="ml-auto flex items-center gap-4 text-sm">
                <span className="text-ink-soft hidden sm:block">{session.user?.email}</span>
                <form action={async () => { "use server"; await signOut({ redirectTo: "/" }); }}>
                  <button className="font-medium hover:underline">Sign out</button>
                </form>
              </div>
            )}
          </nav>
        </header>
        <div className="max-w-4xl mx-auto px-6 py-8">{children}</div>
      </body>
    </html>
  );
}
