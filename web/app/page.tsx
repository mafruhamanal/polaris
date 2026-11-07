import { auth } from "@/lib/auth";
import Link from "next/link";

export default async function HomePage() {
  const session = await auth();

  return (
    <div className="py-12 space-y-16">
      {/* Hero */}
      <section className="text-center space-y-6 max-w-2xl mx-auto">
        <h1 className="text-5xl font-bold tracking-tight text-gray-900 leading-tight">
          Your north star<br />for reading
        </h1>
        <p className="text-xl text-gray-600 leading-relaxed">
          Polaris finds the font, spacing, and reading speed that works best for <em>you</em> — then brings that experience to your Mac.
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          <Link
            href="/quiz"
            className="bg-blue-600 text-white px-8 py-3 rounded-full text-lg font-semibold hover:bg-blue-700 transition-colors shadow-sm"
          >
            Start the quiz →
          </Link>
          {!session && (
            <Link
              href="/sign-in"
              className="border border-gray-300 text-gray-700 px-8 py-3 rounded-full text-lg font-medium hover:bg-white transition-colors"
            >
              Sign in
            </Link>
          )}
        </div>
      </section>

      {/* Features */}
      <section className="grid sm:grid-cols-3 gap-6">
        {[
          { icon: "🔤", title: "Find your font", body: "A short A/B quiz compares fonts, sizes, and spacing until you find what's easiest to read." },
          { icon: "💾", title: "Save responses", body: "Every time the Mac app simplifies or explains text, the result is saved here for later." },
          { icon: "🍎", title: "Syncs to your Mac", body: "Your settings travel to the Polaris menu bar app, so every selection feels right." },
        ].map(({ icon, title, body }) => (
          <div key={title} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-2">
            <div className="text-3xl">{icon}</div>
            <h3 className="font-semibold text-lg">{title}</h3>
            <p className="text-gray-600 text-sm leading-relaxed">{body}</p>
          </div>
        ))}
      </section>

      {session && (
        <section className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <p className="text-sm text-gray-500 mb-3">Signed in as {session.user?.email}</p>
          <div className="flex gap-4 flex-wrap">
            <Link href="/saved" className="text-blue-600 font-medium hover:underline">View saved responses →</Link>
            <Link href="/settings" className="text-blue-600 font-medium hover:underline">View your settings →</Link>
            <Link href="/connect" className="text-blue-600 font-medium hover:underline">Connect Mac app →</Link>
          </div>
        </section>
      )}
    </div>
  );
}
