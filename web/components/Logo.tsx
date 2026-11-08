// Polaris wordmark: wide black italic caps with a star cut out of the "O".
import { useId } from "react";
import { Archivo } from "next/font/google";

const archivo = Archivo({ subsets: ["latin"], style: "italic", axes: ["wdth"] });

export function Logo({ className = "" }: { className?: string }) {
  const maskId = useId();

  return (
    <span
      role="img"
      aria-label="Polaris"
      className={`${archivo.className} inline-flex items-baseline font-black uppercase italic leading-none tracking-wide ${className}`}
      style={{ fontVariationSettings: '"wdth" 125' }}
    >
      P
      <svg
        viewBox="0 0 30 24"
        aria-hidden="true"
        className="mx-[0.03em] h-[0.72em] w-[0.9em] self-baseline -skew-x-12"
        fill="currentColor"
      >
        <mask id={maskId}>
          <rect width="30" height="24" fill="white" />
          <path
            transform="translate(7.2 4.2) scale(0.65)"
            d="M12 0c.6 5.6 2.4 9.4 12 12-9.6 2.6-11.4 6.4-12 12-.6-5.6-2.4-9.4-12-12C9.6 9.4 11.4 5.6 12 0Z"
            fill="black"
          />
        </mask>
        <ellipse cx="15" cy="12" rx="15" ry="12" mask={`url(#${maskId})`} />
      </svg>
      LARIS
    </span>
  );
}
