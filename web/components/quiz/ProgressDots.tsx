type Props = { total: number; current: number; className?: string };

export default function ProgressDots({ total, current, className = "" }: Props) {
  return (
    <div className={`flex gap-2 justify-center ${className}`}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`rounded-full transition-all duration-300 ${
            i < current
              ? "w-2.5 h-2.5 bg-nebula-teal"
              : i === current
              ? "w-3 h-3 bg-nebula-purple"
              : "w-2.5 h-2.5 bg-space-light"
          }`}
        />
      ))}
    </div>
  );
}
