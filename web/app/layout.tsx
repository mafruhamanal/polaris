import type { Metadata } from "next";
import "./globals.css";
import { auth, signOut } from "@/lib/auth";
import { db } from "@/lib/db";
import { BACKGROUNDS, SAVED_DEFAULTS, savedSettingsToStyle, type BackgroundId } from "@/lib/settings";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Polaris",
  description: "Every reader needs a north star.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  let bodyStyle: React.CSSProperties = {
    backgroundColor: BACKGROUNDS.white.bg,
    color: BACKGROUNDS.white.text,
    fontFamily: "system-ui, sans-serif",
  };

  if (session?.user?.email) {
    const rows = await db`
      SELECT rs.font_family, rs.font_size, rs.letter_spacing, rs.line_spacing,
             rs.background, rs.voice, rs.reading_speed, rs.reading_level
      FROM reader_settings rs
      JOIN users u ON u.id = rs.user_id
      WHERE u.email = ${session.user.email}
      LIMIT 1
    `;
    const s = rows.length > 0 ? {
      fontFamily: rows[0].font_family,
      fontSize: rows[0].font_size,
      letterSpacing: rows[0].letter_spacing,
      lineSpacing: rows[0].line_spacing,
      background: rows[0].background as BackgroundId,
      voice: rows[0].voice,
      readingSpeed: rows[0].reading_speed,
      readingLevel: rows[0].reading_level,
    } : SAVED_DEFAULTS;
    const full = savedSettingsToStyle(s);
    bodyStyle = {
      backgroundColor: full.backgroundColor,
      color: full.color,
      fontFamily: full.fontFamily,
    };
  }

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&family=Lexend:wght@400;600&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen" style={bodyStyle}>
        <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-gray-100">
          <nav className="max-w-4xl mx-auto px-6 h-14 flex items-center gap-6">
            <Link href="/" className="text-lg font-bold tracking-tight text-blue-700">⭐ Polaris</Link>
            <div className="flex items-center gap-5 text-sm font-medium text-gray-600 ml-2">
              <Link href="/quiz" className="hover:text-blue-700 transition-colors">Quiz</Link>
              {session && (
                <>
                  <Link href="/saved" className="hover:text-blue-700 transition-colors">Saved</Link>
                  <Link href="/settings" className="hover:text-blue-700 transition-colors">Settings</Link>
                </>
              )}
            </div>
            <div className="ml-auto flex items-center gap-3 text-sm">
              {session ? (
                <>
                  <span className="text-gray-400 hidden sm:block">{session.user?.email}</span>
                  <form action={async () => { "use server"; await signOut({ redirectTo: "/" }); }}>
                    <button className="text-gray-500 hover:text-red-600 transition-colors">Sign out</button>
                  </form>
                </>
              ) : (
                <Link href="/sign-in" className="bg-blue-600 text-white px-4 py-1.5 rounded-full text-sm font-medium hover:bg-blue-700 transition-colors">Sign in</Link>
              )}
            </div>
          </nav>
        </header>
        <div className="max-w-4xl mx-auto px-6 py-8">{children}</div>
      </body>
    </html>
  );
}
