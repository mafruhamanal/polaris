"use client";

// A saved card that opens to show more when you click it (used for Ask conversations).
// The header, preview and full view are drawn on the server and passed in; this only holds open/closed.
import { useState, type ReactNode } from "react";

type Props = {
  header: ReactNode;
  /** Shown while closed. */
  preview: ReactNode;
  /** Shown while open. */
  full: ReactNode;
  /** How many messages (questions and answers) the full view holds. */
  messages: number;
};

export default function ExpandableCard({ header, preview, full, messages }: Props) {
  const [open, setOpen] = useState(false);

  function onCardClick(e: React.MouseEvent) {
    // Buttons and links in the card (like delete) do their own thing; selecting text to copy it isn't a click.
    if ((e.target as HTMLElement).closest("button:not([data-toggle]), a")) return;
    if (window.getSelection()?.toString()) return;
    setOpen((o) => !o);
  }

  return (
    <div
      onClick={onCardClick}
      className="bg-space-mid rounded-2xl border border-space-light shadow-sm p-8 space-y-6 cursor-pointer hover:border-nebula-teal/60 transition-colors"
    >
      {header}
      {open ? full : preview}
      {/* No handler of its own: the click reaches the card, so mouse and keyboard toggle it the same way. */}
      <button
        type="button"
        data-toggle
        aria-expanded={open}
        className="text-xl font-medium text-nebula-teal hover:underline"
      >
        {open ? "Hide the conversation ▲" : `See the whole conversation (${messages} message${messages !== 1 ? "s" : ""}) ▼`}
      </button>
    </div>
  );
}
