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
        <header className="sticky top-0 z-10 bg-peach/90 backdrop-blur border-b border-ink/10">
          <nav className="max-w-4xl mx-auto px-6 h-14 flex items-center gap-6">
            <Link href="/" className="inline-block shrink-0">
              <span style={{ color: "#2563EB" }}><Logo className="text-2xl" /></span>
            </Link>
            <div className="flex items-center gap-1 text-sm font-medium text-ink-soft">
              <Link href="/quiz" className="px-3 py-1.5 rounded-lg hover:bg-ink/5 hover:text-ink transition-colors">Quiz</Link>
              {session && (
                <>
                  <Link href="/saved" className="px-3 py-1.5 rounded-lg hover:bg-ink/5 hover:text-ink transition-colors">Saved</Link>
                  <Link href="/settings" className="px-3 py-1.5 rounded-lg hover:bg-ink/5 hover:text-ink transition-colors">Settings</Link>
                </>
              )}
            </div>
            <div className="ml-auto flex items-center gap-4 text-sm">
              {session ? (
                <>
                  <span className="text-ink-soft hidden sm:block truncate max-w-[220px]">{session.user?.email}</span>
                  <form action={async () => { "use server"; await signOut({ redirectTo: "/" }); }}>
                    <button className="font-semibold text-ink hover:underline transition-colors">Sign out</button>
                  </form>
                </>
              ) : (
                <Link href="/sign-in" className="bg-ember text-white px-4 py-1.5 rounded-full font-medium hover:opacity-90 transition-opacity">Sign in</Link>
              )}
            </div>
          </nav>
        </header>
        <div className="max-w-4xl mx-auto px-6 py-8">{children}</div>
      </body>
    </html>
  );
}
