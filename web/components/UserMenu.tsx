"use client";

import { useState, useRef, useEffect } from "react";

type Props = {
  email: string;
  signOutForm: React.ReactNode;
};

export default function UserMenu({ email, signOutForm }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-[4.5rem] h-[4.5rem] rounded-full bg-nebula-teal text-space-deep font-bold text-3xl flex items-center justify-center hover:opacity-80 transition-opacity"
        aria-label="User menu"
      >
        {email[0].toUpperCase()}
      </button>

      {open && (
        <div className="absolute right-0 top-20 bg-space-mid rounded-2xl shadow-lg border border-nebula-teal/10 py-4 z-50" style={{ width: "32rem" }}>
          <p className="px-8 py-4 text-2xl text-star-white truncate">{email}</p>
          <hr className="border-nebula-teal/10 my-2" />
          {signOutForm}
        </div>
      )}
    </div>
  );
}
