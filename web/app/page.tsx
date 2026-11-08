import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center gap-6" style={{ zoom: 1.5 }}>
      <h1 className="text-3xl font-bold text-star-white">Every reader needs a north star.</h1>
      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/quiz" className="px-5 py-2 text-sm bg-nebula-teal text-space-deep rounded font-medium hover:opacity-90 transition-opacity">
          Find your reading style
        </Link>
        <Link href="/saved" className="px-5 py-2 text-sm border border-white/20 text-star-white rounded hover:bg-white/10 transition-colors">
          View saved responses
        </Link>
      </div>
    </div>
  );
}
