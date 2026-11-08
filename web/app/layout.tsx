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
        <link href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen bg-space-deep text-star-white" style={{ fontFamily: "'Atkinson Hyperlegible', Verdana, sans-serif" }}>
        <header className="sticky top-0 z-50 bg-space-deep border-b border-white/10">
          <nav className="max-w-5xl mx-auto px-3 h-28 flex items-center justify-between">
            <Link href="/" className="shrink-0">
              <Logo className="text-4xl" />
            </Link>
            <div className="flex items-center gap-6">
              <Link href="/quiz" className="px-4 py-2 text-2xl rounded hover:bg-white/10 transition-colors">Quiz</Link>
              {session && (
                <>
                  <Link href="/saved" className="px-4 py-2 text-2xl rounded hover:bg-white/10 transition-colors">Saved</Link>
                  <Link href="/settings" className="px-4 py-2 text-2xl rounded hover:bg-white/10 transition-colors">Settings</Link>
                  <Link href="/connect" className="px-4 py-2 text-2xl rounded hover:bg-white/10 transition-colors">Connect Mac</Link>
                </>
              )}
              {session ? (
                <UserMenu
                  name={session.user?.name ?? ""}
                  email={session.user?.email ?? ""}
                  signOutForm={
                    <form action={async () => { "use server"; await signOut({ redirectTo: "/" }); }}>
                      <button className="w-full text-left px-4 py-2.5 text-base text-star-white rounded-lg hover:bg-white/10 transition-colors">
                        Sign out
                      </button>
                    </form>
                  }
                />
              ) : (
                <Link href="/sign-in" className="px-4 py-2 text-2xl bg-nebula-teal text-space-deep rounded font-medium hover:opacity-90 transition-opacity">Sign in</Link>
              )}
            </div>
          </nav>
        </header>
        <main className="max-w-5xl mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
