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
      style={{ width: "6.75rem", height: "3.75rem" }}
    >
      {/* Track */}
      <span
        className="absolute inset-0 rounded-full transition-colors duration-300"
        style={{
          background: isLight
            ? "linear-gradient(135deg, #fde68a, #fbbf24)"
            : "linear-gradient(135deg, #1a1f38, #2d3561)",
          border: isLight ? "2px solid #fbbf24" : "2px solid #bd93f9",
        }}
      />

      {/* Stars (dark mode) */}
      {mounted && !isLight && (
        <span className="absolute inset-0 rounded-full overflow-hidden pointer-events-none">
          <span className="absolute w-1.5 h-1.5 rounded-full bg-white/70" style={{ top: "30%", left: "20%" }} />
          <span className="absolute w-1 h-1 rounded-full bg-white/50" style={{ top: "55%", left: "32%" }} />
          <span className="absolute w-1.5 h-1.5 rounded-full bg-white/60" style={{ top: "20%", left: "42%" }} />
        </span>
      )}

      {/* Thumb */}
      <span
        className="absolute top-1.5 rounded-full shadow-md transition-all duration-300 flex items-center justify-center text-xl"
        style={{
          width: "2.625rem",
          height: "2.625rem",
          left: isLight ? "calc(100% - 2.625rem - 0.375rem)" : "0.375rem",
          background: isLight
            ? "linear-gradient(135deg, #fef3c7, #fde68a)"
            : "linear-gradient(135deg, #c4b5fd, #bd93f9)",
          boxShadow: isLight
            ? "0 0 10px 3px rgba(251,191,36,0.5)"
            : "0 0 10px 3px rgba(189,147,249,0.4)",
        }}
      >
        {isLight ? "☀️" : "🌙"}
      </span>
    </button>
  );
}
