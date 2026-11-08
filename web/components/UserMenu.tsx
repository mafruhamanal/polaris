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
        className="w-12 h-12 rounded-full bg-ink text-peach font-bold text-lg flex items-center justify-center hover:opacity-80 transition-opacity"
        aria-label="User menu"
      >
        {email[0].toUpperCase()}
      </button>

      {open && (
        <div className="absolute right-0 top-14 w-64 bg-white rounded-2xl shadow-lg border border-ink/10 py-2 z-50">
          <p className="px-4 py-2 text-sm text-ink-soft truncate">{email}</p>
          <hr className="border-ink/10 my-1" />
          {signOutForm}
        </div>
      )}
    </div>
  );
}
