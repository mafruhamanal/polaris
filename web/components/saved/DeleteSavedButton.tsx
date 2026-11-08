"use client";

// Trash button on a saved item: asks to confirm, deletes it, and refreshes the list.
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DeleteSavedButton({ itemId, label }: { itemId: string; label: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function remove() {
    if (!confirm(`Delete this ${label}? This can't be undone.`)) return;
    setDeleting(true);
    const res = await fetch(`/api/saved/${itemId}`, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) return alert("Couldn't delete it. Please try again.");
    router.refresh();
  }

  return (
    <button
      onClick={remove}
      disabled={deleting}
      aria-label={`Delete ${label}`}
      title={`Delete ${label}`}
      className="p-2 rounded-full text-star-white hover:text-nebula-gold hover:bg-space-light transition-colors disabled:opacity-40"
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 6h18" />
        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
        <path d="M10 11v6M14 11v6" />
      </svg>
    </button>
  );
}
