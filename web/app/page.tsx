import { auth, signOut } from "@/lib/auth";
import Link from "next/link";

export default async function HomePage() {
  const session = await auth();

  return (
    <main className="p-8 max-w-md">
      <h1 className="text-2xl font-bold mb-6">Polaris</h1>
      {!session ? (
        <Link href="/sign-in" className="underline">Sign in with Google</Link>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">{session.user?.email}</p>
          <nav className="flex flex-col gap-2">
            <Link href="/saved" className="underline">Saved responses</Link>
            <Link href="/settings" className="underline">Settings</Link>
            <Link href="/connect" className="underline">Connect Mac app</Link>
          </nav>
          <form action={async () => { "use server"; await signOut({ redirectTo: "/" }); }}>
            <button type="submit" className="text-sm text-red-600 underline">Sign out</button>
          </form>
        </div>
      )}
    </main>
  );
}
