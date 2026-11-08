// Home page: intro to Polaris and links to the quiz and saved responses.
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
      <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
        Every reader needs a north star.
      </h1>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Link
          href="/quiz"
          className="rounded-full bg-ink px-6 py-3 font-medium text-peach-light transition hover:bg-ink/85"
        >
          Find your reading style
        </Link>
        <Link
          href="/saved"
          className="rounded-full border-2 border-ink px-6 py-3 font-medium transition hover:bg-ink/5"
        >
          View saved responses
        </Link>
      </div>
    </div>
  );
}
