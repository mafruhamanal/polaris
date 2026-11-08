"use client";

// Catalog tabs above the saved list: All, Unsorted, one per catalog, plus "New catalog"
// and deleting the catalog you're looking at (its items stay saved, just unsorted).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Catalog } from "@/lib/catalogs";

type Props = {
  catalogs: Catalog[];
  /** "all", "unsorted", or a catalog id. */
  selected: string;
  total: number;
  unsorted: number;
};

export default function CatalogBar({ catalogs, selected, total, unsorted }: Props) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const current = catalogs.find((c) => c.id === selected);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const res = await fetch("/api/catalogs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) return setError("Couldn't create that catalog.");
    const catalog = await res.json();
    setAdding(false);
    setName("");
    setError("");
    router.push(`/saved?catalog=${catalog.id}`);
    router.refresh();
  }

  async function remove() {
    if (!current || !confirm(`Delete the "${current.name}" catalog? Its ${current.count} item(s) stay saved under Unsorted.`)) return;
    const res = await fetch(`/api/catalogs/${current.id}`, { method: "DELETE" });
    if (!res.ok) return setError("Couldn't delete that catalog.");
    router.push("/saved");
    router.refresh();
  }

  const tab = (id: string, label: string, count: number) => (
    <Link
      key={id}
      href={id === "all" ? "/saved" : `/saved?catalog=${id}`}
      className={`px-5 py-2 rounded-full text-xl font-medium border transition-colors ${
        selected === id ? "bg-nebula-teal text-space-deep border-nebula-teal" : "bg-space-mid text-star-white border-space-light hover:border-nebula-teal"
      }`}
    >
      {label} <span className="opacity-60">{count}</span>
    </Link>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/saved"
          style={{ zoom: 1.5 }}
          className={`px-5 py-2 rounded-full text-xl font-medium border transition-colors ${
            selected === "all" ? "bg-nebula-teal text-space-deep border-nebula-teal" : "bg-space-mid text-star-white border-space-light hover:border-nebula-teal"
          }`}
        >
          All <span className="opacity-60">{total}</span>
        </Link>
        {catalogs.map((c) => tab(c.id, c.name, c.count))}
        {unsorted > 0 && catalogs.length > 0 && tab("unsorted", "Unsorted", unsorted)}
        {adding ? (
          <form onSubmit={create} className="flex items-center gap-2">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Catalog name"
              maxLength={60}
              className="px-4 py-2 rounded-full text-xl bg-space-mid text-star-white border border-space-light outline-none focus:border-nebula-teal"
            />
            <button type="submit" className="px-5 py-2 rounded-full text-xl font-medium bg-nebula-teal text-space-deep">Add</button>
            <button type="button" onClick={() => setAdding(false)} className="text-xl text-star-white">Cancel</button>
          </form>
        ) : (
          <button
            onClick={() => setAdding(true)}
            style={{ zoom: 1.5 }}
            className="px-5 py-2 rounded-full text-xl font-medium border border-dashed border-space-light text-star-white hover:border-nebula-teal"
          >
            + New catalog
          </button>
        )}
        {current && (
          <button onClick={remove} className="ml-auto text-xl text-star-white hover:text-nebula-teal">
            Delete catalog
          </button>
        )}
      </div>
      {error && <p className="text-xl text-nebula-gold">{error}</p>}
    </div>
  );
}
