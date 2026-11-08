import type { Metadata } from "next";
import "./globals.css";
import { auth, signOut } from "@/lib/auth";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import UserMenu from "@/components/UserMenu";

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
          <nav className="w-full px-12 h-32 flex items-center gap-12">
            <Link href="/" className="inline-block shrink-0">
              <Logo className="text-5xl" />
            </Link>
            <div className="flex items-center gap-2 text-2xl font-medium text-ink-soft whitespace-nowrap">
              <Link href="/quiz" className="px-6 py-3 rounded-lg hover:bg-ink/5 hover:text-ink transition-colors">Quiz</Link>
              {session && (
                <>
                  <Link href="/saved" className="px-6 py-3 rounded-lg hover:bg-ink/5 hover:text-ink transition-colors">Saved Responses</Link>
                  <Link href="/settings" className="px-6 py-3 rounded-lg hover:bg-ink/5 hover:text-ink transition-colors">Settings</Link>
                  <Link href="/connect" className="px-6 py-3 rounded-lg hover:bg-ink/5 hover:text-ink transition-colors">Connect Mac</Link>
                </>
              )}
            </div>
            <div className="ml-auto flex items-center">
              {session ? (
                <UserMenu
                  email={session.user?.email ?? ""}
                  signOutForm={
                    <form action={async () => { "use server"; await signOut({ redirectTo: "/" }); }}>
                      <button className="w-full text-left px-8 py-4 text-base font-medium text-ink hover:bg-ink/5 transition-colors">
                        Sign out
                      </button>
                    </form>
                  }
                />
              ) : (
                <Link href="/sign-in" className="bg-ember text-white px-8 py-3 rounded-full text-2xl font-medium hover:opacity-90 transition-opacity">Sign in</Link>
              )}
            </div>
          </nav>
        </header>
        <div className="max-w-4xl mx-auto px-6 py-8">{children}</div>
      </body>
    </html>
  );
}
