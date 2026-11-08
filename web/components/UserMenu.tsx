"use client";

import { useState, useRef, useEffect } from "react";

type Props = {
  name: string;
  email: string;
  signOutForm: React.ReactNode;
};

export default function UserMenu({ name, email, signOutForm }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const initial = (name?.[0] ?? email?.[0] ?? "?").toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-12 h-12 rounded-full bg-nebula-teal text-space-deep font-bold text-xl flex items-center justify-center hover:opacity-80 transition-opacity"
        aria-label="User menu"
        aria-expanded={open}
      >
        {initial}
      </button>

      {open && (
        <div className="absolute right-0 top-14 w-72 bg-space-mid border border-star-white/10 rounded-xl shadow-lg overflow-hidden z-[200]">
          <div className="px-5 py-4 border-b border-star-white/10">
            <p className="text-base font-semibold text-star-white truncate">{name}</p>
            <p className="text-sm text-star-dim truncate">{email}</p>
          </div>
          <div className="p-2">
            {signOutForm}
          </div>
        </div>
      )}
    </div>
  );
}
