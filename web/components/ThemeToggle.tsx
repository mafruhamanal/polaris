"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("theme") as "dark" | "light" | null;
    if (stored) setTheme(stored);
    setMounted(true);
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.setAttribute("data-theme", next);
  }

  const isLight = theme === "light";

  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${isLight ? "dark" : "light"} mode`}
      className="relative inline-flex items-center shrink-0"
      style={{ width: "9rem", height: "5rem" }}
    >
      {/* Track */}
      <span
        className="absolute inset-0 rounded-full transition-colors duration-300"
        style={{
          background: isLight
            ? "linear-gradient(135deg, #fde68a, #fbbf24)"
            : "linear-gradient(135deg, #1a1f38, #2d3561)",
          border: isLight ? "3px solid #fbbf24" : "3px solid #bd93f9",
        }}
      />

      {/* Stars (dark mode) */}
      {mounted && !isLight && (
        <span className="absolute inset-0 rounded-full overflow-hidden pointer-events-none">
          <span className="absolute w-2 h-2 rounded-full bg-white/70" style={{ top: "30%", left: "20%" }} />
          <span className="absolute w-1 h-1 rounded-full bg-white/50" style={{ top: "55%", left: "32%" }} />
          <span className="absolute w-2 h-2 rounded-full bg-white/60" style={{ top: "20%", left: "42%" }} />
        </span>
      )}

      {/* Thumb */}
      <span
        className="absolute top-2 rounded-full shadow-md transition-all duration-300 flex items-center justify-center text-3xl"
        style={{
          width: "3.5rem",
          height: "3.5rem",
          left: isLight ? "calc(100% - 3.5rem - 0.5rem)" : "0.5rem",
          background: isLight
            ? "linear-gradient(135deg, #fef3c7, #fde68a)"
            : "linear-gradient(135deg, #c4b5fd, #bd93f9)",
          boxShadow: isLight
            ? "0 0 16px 4px rgba(251,191,36,0.5)"
            : "0 0 16px 4px rgba(189,147,249,0.4)",
        }}
      >
        {isLight ? "☀️" : "🌙"}
      </span>
    </button>
  );
}
