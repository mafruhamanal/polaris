"use client";

// Dropdown on a saved item to file it into a catalog (or back to Unsorted).
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  itemId: string;
  catalogId: string | null;
  catalogs: { id: string; name: string }[];
};

export default function MoveToCatalog({ itemId, catalogId, catalogs }: Props) {
  const router = useRouter();
  const [value, setValue] = useState(catalogId ?? "");
  const [saving, setSaving] = useState(false);

  async function move(next: string) {
    setValue(next);
    setSaving(true);
    const res = await fetch(`/api/saved/${itemId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ catalogId: next || null }),
    });
    setSaving(false);
    if (!res.ok) setValue(catalogId ?? "");
    router.refresh();
  }

  if (catalogs.length === 0) return null;
  return (
    <select
      value={value}
      disabled={saving}
      onChange={(e) => move(e.target.value)}
      aria-label="Catalog"
      className="text-xl rounded-full border border-space-light bg-space-mid px-3 py-1 text-star-white"
    >
      <option value="">Unsorted</option>
      {catalogs.map((c) => (
        <option key={c.id} value={c.id}>{c.name}</option>
      ))}
    </select>
  );
}
