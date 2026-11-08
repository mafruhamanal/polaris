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
        <div className="absolute right-0 top-14 bg-white rounded-2xl shadow-lg border border-ink/10 py-4 z-50" style={{ width: "32rem" }}>
          <p className="px-8 py-4 text-2xl text-ink-soft truncate">{email}</p>
          <hr className="border-ink/10 my-2" />
          {signOutForm}
        </div>
      )}
    </div>
  );
}
