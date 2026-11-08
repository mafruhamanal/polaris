import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
      <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl bg-gradient-to-r from-nebula-teal to-nebula-purple bg-clip-text text-transparent">
        Every reader needs a north star.
      </h1>
      <div className="mt-10 flex flex-wrap justify-center gap-6">
        <Link
          href="/quiz"
          className="rounded-full bg-nebula-teal px-12 py-6 text-2xl font-semibold text-space-deep transition hover:opacity-90"
        >
          Find your reading style
        </Link>
        <Link
          href="/saved"
          className="rounded-full border-2 border-nebula-teal/50 text-star-white px-12 py-6 text-2xl font-medium transition hover:border-nebula-teal hover:bg-nebula-teal/5"
        >
          View saved responses
        </Link>
      </div>
    </div>
  );
}
